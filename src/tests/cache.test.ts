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

test('getTTLSeconds: respects ASTOR_SEARCH_CACHE_TTL_GENERAL and ASTOR_SEARCH_CACHE_TTL_NEWS env vars', () => {
  const origGeneral = process.env.ASTOR_SEARCH_CACHE_TTL_GENERAL;
  const origNews = process.env.ASTOR_SEARCH_CACHE_TTL_NEWS;

  try {
    process.env.ASTOR_SEARCH_CACHE_TTL_GENERAL = '7200';
    process.env.ASTOR_SEARCH_CACHE_TTL_NEWS = '1800';

    assert.strictEqual(getTTLSeconds({ topic: 'general' }), 7200);
    assert.strictEqual(getTTLSeconds({}), 7200);
    assert.strictEqual(getTTLSeconds({ topic: 'news' }), 1800);
    assert.strictEqual(getTTLSeconds({ topic: 'finance' }), 1800);
    assert.strictEqual(getTTLSeconds({ time_range: 'day' }), 1800);
  } finally {
    if (origGeneral !== undefined) {
      process.env.ASTOR_SEARCH_CACHE_TTL_GENERAL = origGeneral;
    } else {
      delete process.env.ASTOR_SEARCH_CACHE_TTL_GENERAL;
    }

    if (origNews !== undefined) {
      process.env.ASTOR_SEARCH_CACHE_TTL_NEWS = origNews;
    } else {
      delete process.env.ASTOR_SEARCH_CACHE_TTL_NEWS;
    }
  }
});
