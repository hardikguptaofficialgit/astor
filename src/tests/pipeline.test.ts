import test from 'node:test';
import assert from 'node:assert';
import {
  normalizeUrl,
  extractDomain,
  formatModelOutput,
} from '../lib/search/pipeline';
import { NumberedSource } from '../lib/db';

test('normalizeUrl: strips www, fragments, trailing slashes, and tracking query params', () => {
  const url1 = 'https://www.example.com/pricing/?utm_source=twitter&utm_medium=cpc#pricing-table';
  assert.strictEqual(normalizeUrl(url1), 'https://example.com/pricing');

  const url2 = 'HTTP://WWW.TEST.ORG/article/?ref=newsletter&gclid=12345';
  assert.strictEqual(normalizeUrl(url2), 'http://test.org/article');

  const url3 = 'https://example.com/';
  assert.strictEqual(normalizeUrl(url3), 'https://example.com/');
});

test('extractDomain: returns clean hostname without www', () => {
  assert.strictEqual(extractDomain('https://www.neon.tech/pricing'), 'neon.tech');
  assert.strictEqual(extractDomain('http://subdomain.domain.co.uk/path'), 'subdomain.domain.co.uk');
  assert.strictEqual(extractDomain('invalid-url'), 'web');
});

test('formatModelOutput: caps snippets at 600 chars and includes dates', () => {
  const longSnippet = 'A'.repeat(800);
  const sources: NumberedSource[] = [
    {
      n: 1,
      url: 'https://neon.tech/pricing',
      title: 'Neon Pricing',
      domain: 'neon.tech',
      snippet: longSnippet,
      published_date: '2026-10-02',
      retrieved_at: Date.now(),
      score: 0.95,
    },
    {
      n: 2,
      url: 'https://supabase.com/pricing',
      title: 'Supabase Pricing',
      domain: 'supabase.com',
      snippet: 'Short snippet about pricing.',
      retrieved_at: Date.now(),
      score: 0.88,
    },
  ];

  const output = formatModelOutput(sources);

  // Check source [1] header
  assert.ok(output.includes('[1] Neon Pricing — neon.tech — published 2026-10-02'));
  // Snippet capped to <= 600 chars + '...'
  assert.ok(output.includes('A'.repeat(600) + '...'));
  assert.ok(!output.includes('A'.repeat(601) + '...'));

  // Check source [2] header without published date
  assert.ok(output.includes('[2] Supabase Pricing — supabase.com — (retrieved'));
  assert.ok(output.includes('Short snippet about pricing.'));
});

test('Search pipeline dedupe, ranking, per-domain cap, and top 8 logic', async () => {
  // Test pipeline dedupe and ranking logic with recorded Tavily fixtures
  const { setCachedSearchResults } = await import('../lib/search/cache');
  const { runSearchPipeline } = await import('../lib/search/pipeline');

  // Seed cache with mock Tavily results for 2 parallel queries
  const mockQuery1 = 'test query alpha';
  const mockQuery2 = 'test query beta';

  const mockResults1 = [
    {
      title: 'Duplicate Page - Hit 1',
      url: 'https://www.example.com/item/?utm_source=google',
      content: 'Content from first search.',
      score: 0.8,
      published_date: '2026-10-01',
    },
    {
      title: 'Domain A Page 1',
      url: 'https://domain-a.com/page1',
      content: 'Domain A page 1 content.',
      score: 0.9,
    },
    {
      title: 'Domain A Page 2',
      url: 'https://domain-a.com/page2',
      content: 'Domain A page 2 content.',
      score: 0.85,
    },
    {
      title: 'Domain A Page 3 (should be capped out by 2/domain rule)',
      url: 'https://domain-a.com/page3',
      content: 'Domain A page 3 content.',
      score: 0.7,
    },
    {
      title: 'Low score result (< 0.25)',
      url: 'https://lowscore.com/junk',
      content: 'Spam content.',
      score: 0.1,
    },
  ];

  const mockResults2 = [
    {
      title: 'Duplicate Page - Hit 2 (higher score and new content)',
      url: 'https://example.com/item#hash',
      content: 'Additional content from second search.',
      score: 0.95,
      published_date: '2026-10-01',
    },
    {
      title: 'Domain B Page 1',
      url: 'https://domain-b.com/page1',
      content: 'Domain B page 1 content.',
      score: 0.88,
    },
    {
      title: 'Domain C Page 1',
      url: 'https://domain-c.com/page1',
      content: 'Domain C page 1 content.',
      score: 0.82,
    },
    {
      title: 'Domain D Page 1',
      url: 'https://domain-d.com/page1',
      content: 'Domain D page 1 content.',
      score: 0.75,
    },
    {
      title: 'Domain E Page 1',
      url: 'https://domain-e.com/page1',
      content: 'Domain E page 1 content.',
      score: 0.72,
    },
  ];

  // Store in cache so no network is called
  setCachedSearchResults(mockQuery1, {}, mockResults1);
  setCachedSearchResults(mockQuery2, {}, mockResults2);

  const { sources, creditsUsed } = await runSearchPipeline([mockQuery1, mockQuery2]);

  // Credits used is 0 because all queries hit cache
  assert.strictEqual(creditsUsed, 0);

  // Total results should not exceed 8
  assert.ok(sources.length <= 8, `Expected <= 8 sources, got ${sources.length}`);

  // Duplicate URL was merged: score updated to max (0.95) and snippets merged
  const mergedSource = sources.find((s) => s.url === 'https://example.com/item');
  assert.ok(mergedSource, 'Merged duplicate URL should exist in sources');
  assert.strictEqual(mergedSource.score, 0.95);
  assert.ok(mergedSource.snippet?.includes('Content from first search.'));
  assert.ok(mergedSource.snippet?.includes('Additional content from second search.'));

  // Max 2 per domain cap: domain-a.com has 3 hits, only top 2 should remain
  const domainAHits = sources.filter((s) => s.domain === 'domain-a.com');
  assert.strictEqual(domainAHits.length, 2);

  // Low score result (<0.25) dropped
  const lowScoreHit = sources.find((s) => s.domain === 'lowscore.com');
  assert.strictEqual(lowScoreHit, undefined);

  // Sequential numbering [1]..[n]
  for (let i = 0; i < sources.length; i++) {
    assert.strictEqual(sources[i].n, i + 1);
  }
});
