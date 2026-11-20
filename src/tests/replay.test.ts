import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildReplayMessages } from '../lib/history/replay';
import { Message, NumberedSource } from '../lib/memory/log';

describe('History Replay (pure function, Meta prefix cache stability)', () => {
  test('replays user messages preserving model_text', () => {
    const messages: Message[] = [
      {
        id: 'u1',
        conversation_id: 'c1',
        role: 'user',
        content: 'Original user text',
        model_text: 'Original user text\n\n<context now="Fri 20 Nov 2026, 12:00 IST" mode="normal">\n</context>',
        created_at: new Date().toISOString(),
      },
    ];

    const replayed = buildReplayMessages(messages);
    assert.equal(replayed.length, 1);
    assert.equal(replayed[0].role, 'user');
    assert.equal(
      replayed[0].content,
      'Original user text\n\n<context now="Fri 20 Nov 2026, 12:00 IST" mode="normal">\n</context>'
    );
  });

  test('caps historical assistant answers at 3000 chars', () => {
    const longText = 'A'.repeat(5000);
    const messages: Message[] = [
      {
        id: 'a1',
        conversation_id: 'c1',
        role: 'assistant',
        content: longText,
        created_at: new Date().toISOString(),
      },
    ];

    const replayed = buildReplayMessages(messages);
    assert.equal(replayed.length, 1);
    assert.equal(replayed[0].role, 'assistant');
    assert.equal((replayed[0].content as string).length, 3000);
  });

  test('appends cited source context (<=800 chars) only for cited [n] sources', () => {
    const sources: NumberedSource[] = [
      {
        n: 1,
        url: 'https://neon.tech/pricing',
        title: 'Neon Serverless Postgres Pricing',
        domain: 'neon.tech',
        snippet: 'Neon provides a serverless PostgreSQL database with pay-per-use billing.',
        retrieved_at: Date.now(),
      },
      {
        n: 2,
        url: 'https://supabase.com/pricing',
        title: 'Supabase Pricing',
        domain: 'supabase.com',
        snippet: 'Supabase pricing starts with a free tier.',
        retrieved_at: Date.now(),
      },
      {
        n: 3,
        url: 'https://aws.amazon.com/rds',
        title: 'AWS RDS Postgres',
        domain: 'aws.amazon.com',
        snippet: 'Not cited in the text.',
        retrieved_at: Date.now(),
      },
    ];

    // Assistant text only cites [1] and [2], not [3]
    const assistantText = 'Neon costs $19/mo [1], whereas Supabase has a free tier [2].';

    const messages: Message[] = [
      {
        id: 'a2',
        conversation_id: 'c1',
        role: 'assistant',
        content: assistantText,
        created_at: new Date().toISOString(),
        sources,
      },
    ];

    const replayed = buildReplayMessages(messages);
    assert.equal(replayed.length, 1);
    const content = replayed[0].content as string;

    assert.ok(content.startsWith(assistantText));
    assert.ok(content.includes('Context from cited sources'));
    assert.ok(content.includes('neon.tech'));
    assert.ok(content.includes('supabase.com'));
    assert.ok(!content.includes('aws.amazon.com'), 'Uncited source [3] must not be included');
  });

  test('skips specified message id (e.g. current user message)', () => {
    const messages: Message[] = [
      {
        id: 'u1',
        conversation_id: 'c1',
        role: 'user',
        content: 'First question',
        created_at: new Date().toISOString(),
      },
      {
        id: 'u2',
        conversation_id: 'c1',
        role: 'user',
        content: 'Current question',
        created_at: new Date().toISOString(),
      },
    ];

    const replayed = buildReplayMessages(messages, { skipMessageId: 'u2' });
    assert.equal(replayed.length, 1);
    assert.equal(replayed[0].content, 'First question');
  });
});
