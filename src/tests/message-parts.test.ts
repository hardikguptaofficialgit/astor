import test from 'node:test';
import assert from 'node:assert/strict';
import type { UIMessage } from 'ai';
import {
  getActivityItems,
  getMessageSources,
  getMessageText,
  hasRunningActivity,
  summarizeActivity,
  toPlainText,
} from '../components/chat/message-parts';

function msg(parts: unknown[], id = 'm1'): UIMessage {
  return { id, role: 'assistant', parts } as unknown as UIMessage;
}

const source = (n: number) => ({
  n,
  url: `https://example.com/${n}`,
  title: `Source ${n}`,
  domain: 'example.com',
  retrieved_at: 1,
});

test('live streaming message: search in flight is a running step', () => {
  const m = msg([
    { type: 'reasoning', text: 'Need fresh data', state: 'done' },
    { type: 'tool-web_search', toolCallId: 't1', state: 'input-available', input: { queries: ['neon pricing'] } },
  ]);
  const items = getActivityItems(m);
  assert.deepEqual(
    items.map((i) => [i.kind, i.status]),
    [
      ['thinking', 'done'],
      ['search', 'running'],
    ]
  );
  assert.equal(hasRunningActivity(items), true);
  assert.equal(summarizeActivity(items), 'Searching the web…');
});

test('finished multi-tool turn is summarised and sources are merged by number', () => {
  const m = msg([
    {
      type: 'tool-web_search',
      toolCallId: 't1',
      state: 'output-available',
      input: { queries: ['a'] },
      output: { state: 'done', queries: ['a'], results: [source(1), source(2)] },
    },
    {
      type: 'tool-web_search',
      toolCallId: 't2',
      state: 'output-available',
      input: { queries: ['b'] },
      output: { state: 'done', queries: ['b'], results: [source(3)] },
    },
    {
      type: 'tool-read_source',
      toolCallId: 't3',
      state: 'output-available',
      input: { n: 1 },
      output: { ok: true, n: 1, title: 'Pricing', domain: 'example.com', text: '…' },
    },
    {
      type: 'tool-calculate',
      toolCallId: 't4',
      state: 'output-available',
      input: { expression: '2*3' },
      output: { ok: true, expression: '2*3', result: 6 },
    },
    { type: 'text', text: 'Answer [1][3]' },
  ]);

  assert.deepEqual(
    getMessageSources(m).map((s) => s.n),
    [1, 2, 3]
  );
  const items = getActivityItems(m);
  assert.equal(hasRunningActivity(items), false);
  assert.equal(summarizeActivity(items), 'Searched 2 times · Read 1 page · Ran 1 calculation');
  assert.equal(items.at(-1)?.detail, '2*3 = 6');
  assert.equal(getMessageText(m), 'Answer [1][3]');
});

test('failed tools show as errors', () => {
  const m = msg([
    { type: 'tool-read_source', toolCallId: 't1', state: 'output-available', input: { n: 4 }, output: { ok: false, n: 4, error: 'HTTP 403' } },
    { type: 'tool-calculate', toolCallId: 't2', state: 'output-error', input: { expression: '1/0' }, errorText: 'x' },
  ]);
  const items = getActivityItems(m);
  assert.deepEqual(
    items.map((i) => i.status),
    ['error', 'error']
  );
  assert.ok(summarizeActivity(items).includes('2 steps failed'));
});

test('history message: persisted agent steps replace the synthetic sources stub', () => {
  const m = msg([
    { type: 'text', text: 'Old answer [1]' },
    { type: 'data-agent', data: { steps: [{ kind: 'search', queries: ['q'], count: 1 }] } },
    {
      type: 'dynamic-tool',
      toolName: 'web_search',
      toolCallId: 'hist-call-m1',
      state: 'output-available',
      output: { state: 'done', results: [source(1)] },
    },
  ]);
  const items = getActivityItems(m);
  assert.equal(items.length, 1);
  assert.equal(items[0].label, 'Searched the web');
  assert.equal(getMessageSources(m).length, 1);
});

test('older history message without saved steps still shows a search step from the stub', () => {
  const m = msg([
    { type: 'text', text: 'Old answer' },
    {
      type: 'dynamic-tool',
      toolName: 'web_search',
      toolCallId: 'hist-call-m1',
      state: 'output-available',
      output: { state: 'done', results: [source(1), source(2)] },
    },
  ]);
  const items = getActivityItems(m);
  assert.equal(items.length, 1);
  assert.ok(items[0].detail?.includes('2 sources'));
});

test('answer text ignores narration written before tool calls', () => {
  const m = msg([
    { type: 'text', text: 'Let me look that up.' },
    { type: 'tool-web_search', toolCallId: 't1', state: 'input-available', input: { queries: ['a'] } },
    { type: 'text', text: 'Now checking the docs.' },
    { type: 'tool-read_source', toolCallId: 't2', state: 'input-available', input: { n: 1 } },
  ]);
  assert.equal(getMessageText(m), '', 'nothing to show until the final answer starts');

  const done = msg([
    ...(m.parts as unknown[]),
    { type: 'text', text: 'Final ' },
    { type: 'text', text: 'answer.' },
  ]);
  assert.equal(getMessageText(done), 'Final answer.');

  // History messages keep the text first and a synthetic sources stub after it.
  const history = msg([
    { type: 'text', text: 'Saved answer' },
    { type: 'dynamic-tool', toolName: 'web_search', toolCallId: 'hist-call-m1', state: 'output-available', output: { state: 'done', results: [] } },
  ]);
  assert.equal(getMessageText(history), 'Saved answer');
});

test('plain message has no activity', () => {
  assert.deepEqual(getActivityItems(msg([{ type: 'text', text: 'Hi' }])), []);
});

test('toPlainText strips markdown, citations and code for read-aloud', () => {
  const out = toPlainText('## Title\n\n**Bold** claim [1] with `code` and [link](https://x.y).\n\n```js\nconsole.log(1)\n```');
  assert.ok(!out.includes('['));
  assert.ok(!out.includes('**'));
  assert.ok(!out.includes('console.log'));
  assert.ok(out.includes('Bold claim'));
  assert.ok(out.includes('link'));
});
