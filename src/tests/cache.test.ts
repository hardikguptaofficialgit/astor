import test from 'node:test';
import assert from 'node:assert';
import {
  computeCacheKey,
  getTTLSeconds,
  normalizeQuery,
} from '../lib/search/cache';

test('normalizeQuery: lowercases and collapses whitespace', () => {
  assert.strictEqual(normalizeQuery('  Neon   POSTGRES  pricing  '), 'neon postgres pricing');
});

test('computeCacheKey: produces deterministic sha256 hashes', () => {
  const key1 = computeCacheKey('Neon Postgres Pricing', { topic: 'general' });
  const key2 = computeCacheKey('neon   postgres pricing', { topic: 'general' });
  assert.strictEqual(key1, key2);

  const keyNews = computeCacheKey('Neon Postgres Pricing', { topic: 'news' });
  assert.notStrictEqual(key1, keyNews);
});

test('getTTLSeconds: enforces 1 hour for news/finance/day and 24 hours for general', () => {
  assert.strictEqual(getTTLSeconds({ topic: 'news' }), 3600);
  assert.strictEqual(getTTLSeconds({ topic: 'finance' }), 3600);
  assert.strictEqual(getTTLSeconds({ time_range: 'day' }), 3600);
  assert.strictEqual(getTTLSeconds({ topic: 'general' }), 86400);
  assert.strictEqual(getTTLSeconds({}), 86400);
});
