import test from 'node:test';
import assert from 'node:assert';
import { extractCitations, validateCitations } from '../lib/search/citations';

test('extractCitations: finds all unique bracketed numbers in order', () => {
  const text = 'Here is fact one [1] and fact two [2]. Repeated fact [1] and fact five [5].';
  const citations = extractCitations(text);
  assert.deepStrictEqual(citations, [1, 2, 5]);
});

test('validateCitations: strips unknown citation numbers and preserves valid ones', () => {
  const text = 'Neon has a free tier [1]. Supabase starts at $25 [2]. Some hallucinated fact [9].';
  const validNumbers = [1, 2, 3];

  const result = validateCitations(text, validNumbers);

  assert.deepStrictEqual(result.validCitations, [1, 2]);
  assert.deepStrictEqual(result.invalidCitations, [9]);

  // [9] must be stripped
  assert.strictEqual(
    result.validatedText,
    'Neon has a free tier [1]. Supabase starts at $25 [2]. Some hallucinated fact.'
  );
});

test('validateCitations: handles multiple consecutive and trailing unknown citations', () => {
  const text = 'Postgres hosting comparison [1][7] and details [8].';
  const validNumbers = new Set([1]);

  const result = validateCitations(text, validNumbers);

  assert.deepStrictEqual(result.validCitations, [1]);
  assert.deepStrictEqual(result.invalidCitations, [7, 8]);
  assert.strictEqual(result.validatedText, 'Postgres hosting comparison [1] and details.');
});
