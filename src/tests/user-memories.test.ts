import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  getUserMemories,
  saveUserMemory,
  deleteUserMemory,
  clearUserMemories,
} from '../lib/memory/log';
import { SupermemoryClient } from '../lib/memory/supermemory';
import { buildTurnContext } from '../lib/prompt/context';

describe('User Memories & Personalization', () => {
  test('saveUserMemory and getUserMemories work with proper user scoping', () => {
    const userA = `user_mem_${crypto.randomUUID()}_a`;
    const userB = `user_mem_${crypto.randomUUID()}_b`;

    saveUserMemory(crypto.randomUUID(), userA, 'User prefers TypeScript and strict mode', 'preference');
    saveUserMemory(crypto.randomUUID(), userA, 'User is building Astor AI', 'project');
    saveUserMemory(crypto.randomUUID(), userB, 'User writes exclusively in Rust', 'preference');

    const memoriesA = getUserMemories(userA);
    assert.equal(memoriesA.length, 2);
    assert.ok(memoriesA.some((m) => m.fact.includes('TypeScript')));
    assert.ok(memoriesA.some((m) => m.fact.includes('Astor AI')));
    // User B's facts should not bleed into User A
    assert.ok(!memoriesA.some((m) => m.fact.includes('Rust')));

    const memoriesB = getUserMemories(userB);
    assert.equal(memoriesB.length, 1);
    assert.equal(memoriesB[0].fact, 'User writes exclusively in Rust');
  });

  test('deleteUserMemory removes specific memory cleanly', () => {
    const user = `user_mem_${crypto.randomUUID()}_del`;
    const idKeep = crypto.randomUUID();
    const idDelete = crypto.randomUUID();

    saveUserMemory(idKeep, user, 'Fact to keep');
    saveUserMemory(idDelete, user, 'Fact to delete');

    assert.equal(getUserMemories(user).length, 2);

    const deleted = deleteUserMemory(idDelete, user);
    assert.equal(deleted, true);

    const remaining = getUserMemories(user);
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0].id, idKeep);
  });

  test('clearUserMemories wipes all facts for a user', () => {
    const user = `user_mem_${crypto.randomUUID()}_clear`;
    saveUserMemory(crypto.randomUUID(), user, 'Fact 1');
    saveUserMemory(crypto.randomUUID(), user, 'Fact 2');
    saveUserMemory(crypto.randomUUID(), user, 'Fact 3');

    assert.equal(getUserMemories(user).length, 3);

    clearUserMemories(user);
    assert.equal(getUserMemories(user).length, 0);
  });

  test('SupermemoryClient.addFact fails open cleanly without crashing when key is absent', async () => {
    const client = new SupermemoryClient({ apiKey: '' });
    const res = await client.addFact('user_test', 'User likes dark mode');
    assert.equal(res.success, false);
  });

  test('SupermemoryClient.addFact posts correctly to Supermemory API when configured', async () => {
    let capturedBody: Record<string, unknown> | null = null;
    const mockFetch = async (_url: unknown, options: unknown) => {
      const opts = options as { body: string };
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: 'supermemory_doc_999' }),
      } as Response;
    };

    const client = new SupermemoryClient({
      apiKey: 'test_key',
      fetchFn: mockFetch as unknown as typeof fetch,
    });

    const res = await client.addFact('u123', 'Hardik is the author of Astor');
    assert.equal(res.success, true);
    assert.equal(res.supermemoryId, 'supermemory_doc_999');
    assert.ok(capturedBody);
    assert.equal(capturedBody.containerTag, 'astor_user_u123');
    assert.ok(String(capturedBody.content).includes('Hardik is the author of Astor'));
  });

  test('buildTurnContext injects userContext into <user_preferences_and_memory>', () => {
    const context = buildTurnContext({
      nowFormatted: 'Sun 22 Nov 2026',
      userContext: 'Known user facts:\n- Prefers TypeScript\n- Role: Software Engineer',
    });

    assert.ok(context.includes('<user_preferences_and_memory>'));
    assert.ok(context.includes('Prefers TypeScript'));
    assert.ok(context.includes('Role: Software Engineer'));
    assert.ok(context.includes('</user_preferences_and_memory>'));
  });
});
