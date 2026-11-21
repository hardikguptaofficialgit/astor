import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateExpression } from '../lib/agent/calculator';
import { createCalculateTool, createReadSourceTool } from '../lib/agent/tools';
import { extractReadableText, fetchPageText, isPrivateHost } from '../lib/search/read-page';
import type { AgentStep } from '../lib/chat-types';

test('calculator: precedence, unary minus, powers and functions', () => {
  assert.equal(evaluateExpression('2 + 3 * 4'), 14);
  assert.equal(evaluateExpression('(2 + 3) * 4'), 20);
  assert.equal(evaluateExpression('-2 ^ 2'), -4);
  assert.equal(evaluateExpression('2 ^ 3 ^ 2'), 512);
  assert.equal(evaluateExpression('2 ** 10'), 1024);
  assert.equal(evaluateExpression('(19 * 12) * 1.18'), 19 * 12 * 1.18);
  assert.equal(evaluateExpression('sqrt(16) + max(1, 200)'), 204);
  assert.equal(evaluateExpression('10 % 4'), 2);
  assert.ok(Math.abs(evaluateExpression('pi * 2') - Math.PI * 2) < 1e-12);
});

test('calculator: rejects unsafe or invalid input instead of evaluating it', () => {
  assert.throws(() => evaluateExpression('process.exit(1)'));
  assert.throws(() => evaluateExpression('constructor'));
  assert.throws(() => evaluateExpression('alert(1)'), /Unknown function/);
  assert.throws(() => evaluateExpression('1 +'));
  assert.throws(() => evaluateExpression('(1 + 2'));
  assert.throws(() => evaluateExpression('1 / 0'), /finite/);
  assert.throws(() => evaluateExpression(''));
});

test('calculate tool: reports steps and results', async () => {
  const steps: AgentStep[] = [];
  const calc = createCalculateTool((s) => steps.push(s));
  const ok = await calc.execute!(
    { expression: '12 * 12' },
    { toolCallId: 'c1', messages: [] } as never
  );
  assert.deepEqual(ok, { ok: true, expression: '12 * 12', result: 144 });
  const bad = await calc.execute!(
    { expression: '2 +' },
    { toolCallId: 'c2', messages: [] } as never
  );
  assert.equal((bad as { ok: boolean }).ok, false);
  assert.deepEqual(
    steps.map((s) => s.kind),
    ['calculate', 'calculate']
  );
});

test('isPrivateHost: blocks local and private addresses, allows public hosts', () => {
  for (const host of [
    'localhost',
    'foo.localhost',
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.13',
    '169.254.169.254',
    '0.0.0.0',
    '[::1]',
    'fd12::1',
    'printer.local',
    'intranet',
  ]) {
    assert.equal(isPrivateHost(host), true, `${host} should be blocked`);
  }
  for (const host of ['example.com', 'neon.tech', '8.8.8.8', '172.32.0.1']) {
    assert.equal(isPrivateHost(host), false, `${host} should be allowed`);
  }
});

test('extractReadableText: strips scripts, styles and tags', () => {
  const { title, text } = extractReadableText(`
    <html><head><title>Neon &amp; Postgres</title><style>.a{color:red}</style></head>
    <body><nav>menu</nav><script>alert(1)</script>
    <h1>Pricing</h1><p>Launch plan is <b>$19</b>/month.</p><footer>copyright</footer></body></html>
  `);
  assert.equal(title, 'Neon & Postgres');
  assert.ok(text.includes('Pricing'));
  assert.ok(text.includes('Launch plan is $19 /month.') || text.includes('Launch plan is $19/month.'));
  assert.ok(!text.includes('alert'));
  assert.ok(!text.includes('color:red'));
  assert.ok(!text.includes('menu'));
  assert.ok(!text.includes('copyright'));
});

function fakeResponse(body: string, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': 'text/html; charset=utf-8', ...(init.headers ?? {}) },
  });
}

test('fetchPageText: reads pages, follows safe redirects, refuses private targets', async () => {
  const seen: string[] = [];
  const fakeFetch = (async (url: string | URL | Request) => {
    const u = String(url);
    seen.push(u);
    if (u === 'https://short.example/a') {
      return fakeResponse('', { status: 302, headers: { location: 'https://example.com/final' } });
    }
    if (u === 'https://evil.example/x') {
      return fakeResponse('', { status: 302, headers: { location: 'http://127.0.0.1:3000/api/conversations' } });
    }
    return fakeResponse('<title>Final</title><p>Hello world</p>');
  }) as typeof fetch;

  const page = await fetchPageText('https://short.example/a', undefined, fakeFetch);
  assert.equal(page.url, 'https://example.com/final');
  assert.equal(page.title, 'Final');
  assert.ok(page.text.includes('Hello world'));

  await assert.rejects(
    fetchPageText('https://evil.example/x', undefined, fakeFetch),
    /private or local/
  );
  assert.ok(!seen.some((u) => u.startsWith('http://127.0.0.1')), 'must never request the private target');

  await assert.rejects(fetchPageText('file:///etc/passwd', undefined, fakeFetch), /http\(s\)/);
  await assert.rejects(fetchPageText('not a url', undefined, fakeFetch), /Invalid URL/);
});

test('read_source tool: only opens known source numbers', async () => {
  const steps: AgentStep[] = [];
  const fakeFetch = (async () => fakeResponse('<title>Neon</title><p>Launch $19</p>')) as typeof fetch;
  const readSource = createReadSourceTool({
    getSource: (n) =>
      n === 1
        ? {
            n: 1,
            url: 'https://neon.tech/pricing',
            title: 'Neon Pricing',
            domain: 'neon.tech',
            retrieved_at: Date.now(),
          }
        : undefined,
    fetchImpl: fakeFetch,
    onStep: (s) => steps.push(s),
  });

  const ok = (await readSource.execute!({ n: 1 }, { toolCallId: 'r1', messages: [] } as never)) as {
    ok: boolean;
    text?: string;
  };
  assert.equal(ok.ok, true);
  assert.ok(ok.text?.includes('Launch $19'));

  const missing = (await readSource.execute!({ n: 7 }, { toolCallId: 'r2', messages: [] } as never)) as {
    ok: boolean;
    error?: string;
  };
  assert.equal(missing.ok, false);
  assert.ok(missing.error?.includes('[7]'));
  assert.deepEqual(steps, [{ kind: 'read', n: 1, title: 'Neon', domain: 'neon.tech', ok: true }]);
});
