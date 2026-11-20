import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { routeUserMessage } from '../lib/agent/router';

const FIXED_NOW = new Date('2026-11-20T12:00:00+05:30');

describe('Agent Router Labels (cheap regex/heuristics, NO LLM)', () => {
  // Pure Recall
  test('routes "What did I ask you on 3 November?" as recall (isPureRecall = true)', () => {
    const route = routeUserMessage('What did I ask you on 3 November?', FIXED_NOW);
    assert.equal(route.label, 'recall');
    assert.equal(route.isPureRecall, true);
    assert.ok(route.hasDate);
  });

  test('routes "On Monday we shortlisted 5 CRM tools" as recall (isPureRecall = true)', () => {
    const route = routeUserMessage('On Monday we shortlisted 5 CRM tools', FIXED_NOW);
    assert.equal(route.label, 'recall');
    assert.equal(route.isPureRecall, true);
    assert.ok(route.hasDate);
    assert.ok(route.hasMemoryCue);
  });

  test('routes "What did we decide about Postgres earlier?" as recall', () => {
    const route = routeUserMessage('What did we decide about Postgres earlier?', FIXED_NOW);
    assert.equal(route.label, 'recall');
    assert.equal(route.isPureRecall, true);
    assert.ok(route.hasMemoryCue);
  });

  test('routes "What did I ask yesterday?" as recall', () => {
    const route = routeUserMessage('What did I ask yesterday?', FIXED_NOW);
    assert.equal(route.label, 'recall');
    assert.equal(route.isPureRecall, true);
  });

  // Re-verify Cue (leaves tools enabled, isPureRecall = false)
  test('routes "Is the Postgres pricing we discussed on 3 Nov still correct today?" as reverify-cue', () => {
    const route = routeUserMessage(
      'Is the Postgres pricing we discussed on 3 Nov still correct today?',
      FIXED_NOW
    );
    assert.equal(route.label, 'reverify-cue');
    assert.equal(route.isPureRecall, false);
    assert.ok(route.hasReverifyCue);
    assert.ok(route.hasDate);
  });

  test('routes "Has anything changed about the 5 CRM tools since Monday?" as reverify-cue', () => {
    const route = routeUserMessage(
      'Has anything changed about the 5 CRM tools since Monday?',
      FIXED_NOW
    );
    assert.equal(route.label, 'reverify-cue');
    assert.equal(route.isPureRecall, false);
    assert.ok(route.hasReverifyCue);
  });

  test('routes "Check if the Neon pricing from yesterday is still valid" as reverify-cue', () => {
    const route = routeUserMessage(
      'Check if the Neon pricing from yesterday is still valid',
      FIXED_NOW
    );
    assert.equal(route.label, 'reverify-cue');
    assert.equal(route.isPureRecall, false);
  });

  // General Search
  test('routes "What is the latest pricing of Neon Postgres?" as search', () => {
    const route = routeUserMessage('What is the latest pricing of Neon Postgres?', FIXED_NOW);
    assert.equal(route.label, 'search');
    assert.equal(route.isPureRecall, false);
  });

  test('routes "Who is the CEO of Anthropic?" as search', () => {
    const route = routeUserMessage('Who is the CEO of Anthropic?', FIXED_NOW);
    assert.equal(route.label, 'search');
  });

  // Chat / Greetings / Math
  test('routes "Hi Astor" as chat', () => {
    const route = routeUserMessage('Hi Astor', FIXED_NOW);
    assert.equal(route.label, 'chat');
  });

  test('routes "Good morning!" as chat', () => {
    const route = routeUserMessage('Good morning!', FIXED_NOW);
    assert.equal(route.label, 'chat');
  });

  test('routes "What is 25 * 4?" as chat', () => {
    const route = routeUserMessage('What is 25 * 4?', FIXED_NOW);
    assert.equal(route.label, 'chat');
  });
});
