import test from 'node:test';
import assert from 'node:assert';
import { createWebSearchTool } from '../lib/search/tool';
import { STATIC_SYSTEM_PROMPT } from '../lib/prompt/system';
import { buildTurnContext } from '../lib/prompt/context';

test('createWebSearchTool: description injects date and year for Meta cache stability', () => {
  const webSearch = createWebSearchTool({
    date: '2026-11-20',
    year: 2026,
  });

  const desc = typeof webSearch.description === 'string' ? webSearch.description : '';
  assert.ok(desc.includes('Today is 2026-11-20, the year is 2026.'));
  assert.ok(desc.includes('Pass 1–3 short keyword queries'));
});

test('STATIC_SYSTEM_PROMPT: remains completely static with no date or time stamps', () => {
  assert.ok(!STATIC_SYSTEM_PROMPT.includes('2026'));
  assert.ok(!STATIC_SYSTEM_PROMPT.includes('IST'));
  assert.ok(!STATIC_SYSTEM_PROMPT.includes('AM'));
  assert.ok(!STATIC_SYSTEM_PROMPT.includes('PM'));
  assert.ok(STATIC_SYSTEM_PROMPT.includes('You are Astor, a fast, accurate research assistant with one tool: web_search.'));
});

test('buildTurnContext: formats volatile context block cleanly', () => {
  const context = buildTurnContext({
    nowFormatted: 'Fri 20 Nov 2026, 20:30 IST',
    mode: 'normal',
  });

  assert.ok(context.includes('<context now="Fri 20 Nov 2026, 20:30 IST" mode="normal">'));
  assert.ok(context.includes('<reminder>'));
  assert.ok(context.includes('Cite with [n] only from results.'));
});
