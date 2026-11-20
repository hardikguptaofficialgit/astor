import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  SupermemoryClient,
  setCustomSupermemoryClientForTesting,
} from '../lib/memory/supermemory';
import { getPendingMemoryOutbox, getDb } from '../lib/memory/log';

describe('Supermemory Client & Outbox (fail-open)', () => {
  beforeEach(() => {
    // Reset test client
    setCustomSupermemoryClientForTesting(null);
  });

  test('uses containerTag from ASTOR_MEMORY_CONTAINER env var or defaults to astor_local', () => {
    const originalEnv = process.env.ASTOR_MEMORY_CONTAINER;
    try {
      delete process.env.ASTOR_MEMORY_CONTAINER;
      const clientDefault = new SupermemoryClient();
      assert.equal(clientDefault.getContainerTag(), 'astor_local');

      process.env.ASTOR_MEMORY_CONTAINER = 'custom_tag_123';
      const clientCustom = new SupermemoryClient();
      assert.equal(clientCustom.getContainerTag(), 'custom_tag_123');
    } finally {
      process.env.ASTOR_MEMORY_CONTAINER = originalEnv;
    }
  });

  test('fails open when SUPERMEMORY_API_KEY is missing (enqueues to outbox without throwing)', async () => {
    const client = new SupermemoryClient({ apiKey: '' });
    const msgId = `test-msg-${Date.now()}`;

    const res = await client.add({
      conversationId: 'conv-1',
      userMessageId: 'user-1',
      assistantMessageId: msgId,
      question: 'What is Postgres?',
      answer: 'Postgres is an open-source relational database.',
      dateStr: '2026-11-03',
      formattedDate: 'Mon 3 Nov 2026',
      epochMs: Date.now(),
    });

    assert.equal(res.success, false);
    // Check outbox has the pending entry
    const pending = getPendingMemoryOutbox(50);
    const item = pending.find((p) => p.message_id === msgId);
    assert.ok(item, 'Expected message to be queued in memory_outbox');
  });

  test('fails open when Supermemory API endpoint fails or returns HTTP 500', async () => {
    // Mock failing fetchFn
    const failingFetch: typeof fetch = async () => {
      return new Response('Internal Server Error', { status: 500, statusText: 'Server Error' });
    };

    const client = new SupermemoryClient({
      apiKey: 'test-api-key',
      fetchFn: failingFetch,
    });

    const msgId = `test-failing-msg-${Date.now()}`;

    // Should NOT throw!
    const res = await client.add({
      conversationId: 'conv-2',
      userMessageId: 'user-2',
      assistantMessageId: msgId,
      question: 'Shortlist 5 CRM tools',
      answer: 'HubSpot, Salesforce, Pipedrive, Zoho, Freshsales',
      dateStr: '2026-11-16',
      formattedDate: 'Mon 16 Nov 2026',
      epochMs: Date.now(),
    });

    assert.equal(res.success, false);
    const pending = getPendingMemoryOutbox(50);
    const item = pending.find((p) => p.message_id === msgId);
    assert.ok(item, 'Failing Supermemory call must enqueue to memory_outbox');
  });

  test('search() fails open and returns empty array on network failure or 500', async () => {
    const failingFetch: typeof fetch = async () => {
      throw new Error('Network connection refused');
    };

    const client = new SupermemoryClient({
      apiKey: 'test-api-key',
      fetchFn: failingFetch,
    });

    // Should NOT throw!
    const results = await client.search('Postgres');
    assert.deepEqual(results, []);
  });

  test('processOutbox() retries pending items and marks success on resolution', async () => {
    let callCount = 0;
    const workingFetch: typeof fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ id: 'sm-doc-success-123' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    const client = new SupermemoryClient({
      apiKey: 'test-api-key',
      fetchFn: workingFetch,
    });

    const msgId = `test-retry-msg-${Date.now()}`;
    // Directly add outbox item
    const db = getDb();
    db.prepare(`
      INSERT OR REPLACE INTO memory_outbox (message_id, payload_json, attempts)
      VALUES (?, ?, 0)
    `).run(msgId, JSON.stringify({ content: 'test content' }));

    const outcome = await client.processOutbox(10);
    assert.ok(outcome.succeeded >= 1);
    assert.ok(callCount >= 1);

    const pending = getPendingMemoryOutbox(50);
    const item = pending.find((p) => p.message_id === msgId);
    assert.equal(item, undefined, 'Item should no longer be pending after success');
  });
});
