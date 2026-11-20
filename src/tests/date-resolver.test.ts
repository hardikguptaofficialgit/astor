import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDateRange } from '../lib/memory/date-resolver';

// Fixed "now": Friday, 20 November 2026, 12:00:00 IST
const FIXED_NOW = new Date('2026-11-20T12:00:00+05:30');

describe('Date Resolver (~30 unit tests against fixed now: Fri 20 Nov 2026)', () => {
  // 1. "3 November"
  test('resolves "3 November" to 2026-11-03', () => {
    const res = resolveDateRange('3 November', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 2. "on 3 Nov"
  test('resolves "on 3 Nov" to 2026-11-03', () => {
    const res = resolveDateRange('on 3 Nov', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 3. "Nov 3rd"
  test('resolves "Nov 3rd" to 2026-11-03', () => {
    const res = resolveDateRange('Nov 3rd', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 4. "November 3"
  test('resolves "November 3" to 2026-11-03', () => {
    const res = resolveDateRange('November 3', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 5. "3rd Nov"
  test('resolves "3rd Nov" to 2026-11-03', () => {
    const res = resolveDateRange('3rd Nov', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 6. "3rd of November"
  test('resolves "3rd of November" to 2026-11-03', () => {
    const res = resolveDateRange('3rd of November', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 7. "3/11" (UK / Indian format: 3rd Nov)
  test('resolves "3/11" to 2026-11-03', () => {
    const res = resolveDateRange('3/11', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 8. "03/11"
  test('resolves "03/11" to 2026-11-03', () => {
    const res = resolveDateRange('03/11', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 9. "03/11/2026"
  test('resolves "03/11/2026" to 2026-11-03', () => {
    const res = resolveDateRange('03/11/2026', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.equal(res.to, '2026-11-03');
  });

  // 10. "yesterday"
  test('resolves "yesterday" to 2026-11-19', () => {
    const res = resolveDateRange('yesterday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-19');
    assert.equal(res.to, '2026-11-19');
  });

  // 11. "today"
  test('resolves "today" to 2026-11-20', () => {
    const res = resolveDateRange('today', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-20');
    assert.equal(res.to, '2026-11-20');
  });

  // 12. "last Tuesday" (Fri Nov 20 -> past Tue Nov 17)
  test('resolves "last Tuesday" to 2026-11-17', () => {
    const res = resolveDateRange('last Tuesday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-17');
    assert.equal(res.to, '2026-11-17');
  });

  // 13. "on Monday" (most recent past Monday -> Nov 16)
  test('resolves "on Monday" to most recent past Monday: 2026-11-16', () => {
    const res = resolveDateRange('on Monday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-16');
    assert.equal(res.to, '2026-11-16');
  });

  // 14. "Monday" alone
  test('resolves "Monday" to 2026-11-16', () => {
    const res = resolveDateRange('what did we discuss on Monday?', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-16');
    assert.equal(res.to, '2026-11-16');
  });

  // 15. "last week" (Mon Nov 9 to Sun Nov 15)
  test('resolves "last week" to 2026-11-09 through 2026-11-15', () => {
    const res = resolveDateRange('last week', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-09');
    assert.equal(res.to, '2026-11-15');
  });

  // 16. "2 days ago" (Nov 18)
  test('resolves "2 days ago" to 2026-11-18', () => {
    const res = resolveDateRange('2 days ago', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-18');
    assert.equal(res.to, '2026-11-18');
  });

  // 17. "1 day ago"
  test('resolves "1 day ago" to 2026-11-19', () => {
    const res = resolveDateRange('1 day ago', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-19');
    assert.equal(res.to, '2026-11-19');
  });

  // 18. "3 days ago"
  test('resolves "3 days ago" to 2026-11-17', () => {
    const res = resolveDateRange('3 days ago', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-17');
    assert.equal(res.to, '2026-11-17');
  });

  // 19. "5 days ago"
  test('resolves "5 days ago" to 2026-11-15', () => {
    const res = resolveDateRange('5 days ago', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-15');
    assert.equal(res.to, '2026-11-15');
  });

  // 20. "earlier this week" (Mon Nov 16 to Thu Nov 19)
  test('resolves "earlier this week" to 2026-11-16 through 2026-11-19', () => {
    const res = resolveDateRange('earlier this week', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-16');
    assert.equal(res.to, '2026-11-19');
  });

  // 21. "this week"
  test('resolves "this week" to 2026-11-16 through 2026-11-20', () => {
    const res = resolveDateRange('this week', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-16');
    assert.equal(res.to, '2026-11-20');
  });

  // 22. "last Wednesday" (Nov 18)
  test('resolves "last Wednesday" to 2026-11-18', () => {
    const res = resolveDateRange('last Wednesday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-18');
    assert.equal(res.to, '2026-11-18');
  });

  // 23. "on Thursday" (Nov 19)
  test('resolves "on Thursday" to 2026-11-19', () => {
    const res = resolveDateRange('on Thursday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-19');
    assert.equal(res.to, '2026-11-19');
  });

  // 24. "last Friday" (Fri Nov 13)
  test('resolves "last Friday" to 2026-11-13', () => {
    const res = resolveDateRange('last Friday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-13');
    assert.equal(res.to, '2026-11-13');
  });

  // 25. "on Sunday" (past Sunday: Nov 15)
  test('resolves "on Sunday" to 2026-11-15', () => {
    const res = resolveDateRange('on Sunday', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-15');
    assert.equal(res.to, '2026-11-15');
  });

  // 26. Sentence extraction: "What did I ask you on 3 November about Postgres?"
  test('extracts remainingText cleanly for keyword search', () => {
    const res = resolveDateRange('What did I ask you on 3 November about Postgres?', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-03');
    assert.ok(res.remainingText.includes('Postgres'));
    assert.ok(!res.remainingText.toLowerCase().includes('3 november'));
  });

  // 27. Sentence extraction: "On Monday we shortlisted 5 CRM tools"
  test('extracts matched phrase and remaining text for CRM query', () => {
    const res = resolveDateRange('On Monday we shortlisted 5 CRM tools', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2026-11-16');
    assert.ok(res.remainingText.includes('shortlisted 5 CRM tools'));
  });

  // 28. Future date backdating: "December 25" asked on Nov 20 2026 -> 2025-12-25
  test('backdates future month when year not specified', () => {
    const res = resolveDateRange('25 December', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2025-12-25');
  });

  // 29. Explicit past year: "3 November 2025"
  test('honors explicit year in "3 November 2025"', () => {
    const res = resolveDateRange('3 November 2025', FIXED_NOW);
    assert.ok(res);
    assert.equal(res.from, '2025-11-03');
  });

  // 30. No date query returns null
  test('returns null when no date is present', () => {
    const res = resolveDateRange('How does Next.js 15 App Router work?', FIXED_NOW);
    assert.equal(res, null);
  });

  // 31. Empty input returns null
  test('returns null for empty string', () => {
    const res = resolveDateRange('', FIXED_NOW);
    assert.equal(res, null);
  });
});
