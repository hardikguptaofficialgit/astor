import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { saveMessage, saveSources, createConversation, deleteConversation } from '../lib/memory/log';
import { recallPastTurns } from '../lib/memory/recall';
import { resolveDateRange } from '../lib/memory/date-resolver';

// Fixed reference: Friday 20 Nov 2026
const FIXED_NOW = new Date('2026-11-20T12:00:00+05:30');

describe('Dated Memory Recall (SQLite + Supermemory)', () => {
  const convId = 'conv-fixture-m3';

  before(() => {
    // Seed fixtures into SQLite (clean up previous test runs if any)
    deleteConversation(convId);
    createConversation(convId, 'Test Database Fixtures', '2026-11-03T10:00:00.000Z');

    // Turn 1: 3 November 2026 (Postgres hosting on Neon)
    saveMessage(
      'user-3nov',
      convId,
      'user',
      'What are the Postgres hosting pricing options on Neon?',
      '2026-11-03T13:12:00.000Z', // 18:42 IST
      {
        seq: 0,
        local_date: '2026-11-03',
        mode: 'normal',
      }
    );

    saveMessage(
      'asst-3nov',
      convId,
      'assistant',
      'Neon offers a Free tier with 0.5 GB storage, and a Launch plan at $19/month [1]. Scale plan starts at $69/month.',
      '2026-11-03T13:12:30.000Z',
      {
        seq: 1,
        local_date: '2026-11-03',
        mode: 'normal',
      }
    );

    saveSources('asst-3nov', [
      {
        n: 1,
        url: 'https://neon.tech/pricing',
        title: 'Neon Serverless Postgres Pricing',
        domain: 'neon.tech',
        retrieved_at: 1762175520000,
        published_date: '2026-11-03',
      },
    ]);

    // Turn 2: 4 November 2026 (DISTRACTOR on nearby date: Supabase storage limits)
    saveMessage(
      'user-4nov-distractor',
      convId,
      'user',
      'What is the Supabase storage limit on free tier?',
      '2026-11-04T09:00:00.000Z',
      {
        seq: 2,
        local_date: '2026-11-04',
        mode: 'normal',
      }
    );

    saveMessage(
      'asst-4nov-distractor',
      convId,
      'assistant',
      'Supabase free tier provides 1 GB of file storage and 500 MB database.',
      '2026-11-04T09:00:20.000Z',
      {
        seq: 3,
        local_date: '2026-11-04',
        mode: 'normal',
      }
    );

    // Turn 3: Monday 16 November 2026 (Shortlist of 5 CRM tools)
    saveMessage(
      'user-16nov-crm',
      convId,
      'user',
      'Can we shortlist 5 CRM tools for our B2B SaaS startup?',
      '2026-11-16T10:00:00.000Z',
      {
        seq: 4,
        local_date: '2026-11-16',
        mode: 'normal',
      }
    );

    const crmAnswer = `Here is the shortlist of 5 CRM tools for B2B SaaS startups:
1. HubSpot CRM - Best all-in-one free starter CRM with marketing integration.
2. Salesforce Sales Cloud - Industry standard enterprise CRM with deepest customization.
3. Pipedrive - Highly visual sales pipeline CRM focused on deal velocity.
4. Zoho CRM - Best value for money with extensive multichannel integrations.
5. Freshsales - AI-powered deal insights and modern built-in phone capabilities.`;

    saveMessage(
      'asst-16nov-crm',
      convId,
      'assistant',
      crmAnswer,
      '2026-11-16T10:00:45.000Z',
      {
        seq: 5,
        local_date: '2026-11-16',
        mode: 'normal',
      }
    );
  });

  // Test 1: Recall on 3 November picks exact turn id, ignores 4 Nov distractor
  test('picks the right turn id for "3 November" and ignores 4 Nov distractor', async () => {
    const dateRange = resolveDateRange('What did I ask on 3 November?', FIXED_NOW);
    assert.ok(dateRange);

    const recall = await recallPastTurns({
      dateRange,
      query: 'What did I ask on 3 November?',
    });

    assert.ok(recall);
    assert.ok(recall.recalledTurns.length >= 1);
    const turn3Nov = recall.recalledTurns.find((t) => t.localDate === '2026-11-03');
    assert.ok(turn3Nov, 'Must find 3 Nov turn');
    assert.equal(turn3Nov.question, 'What are the Postgres hosting pricing options on Neon?');

    // Must NOT contain distractor
    const distractor = recall.recalledTurns.find((t) => t.localDate === '2026-11-04');
    assert.equal(distractor, undefined, 'Must ignore 4 Nov distractor when querying 3 Nov');

    // XML check
    assert.ok(recall.pastTurnsXml.includes('<past_turns'));
    assert.ok(recall.pastTurnsXml.includes('Neon offers a Free tier'));
    // Letters [a], [b] for sources
    assert.ok(recall.pastTurnsXml.includes('[a] neon.tech'));
  });

  // Test 2: If 0 hits, widens by ±1 day and states so
  test('widens by ±1 day when 0 hits on target date (e.g. 5 Nov -> finds 4 Nov)', async () => {
    const dateRange = resolveDateRange('What did I ask on 5 November?', FIXED_NOW);
    assert.ok(dateRange);

    const recall = await recallPastTurns({
      dateRange,
      query: 'What did I ask on 5 November?',
    });

    assert.ok(recall);
    assert.ok(recall.widenedNote, 'Expected widenedNote to be set');
    assert.ok(recall.widenedNote.includes('widened to'));
    assert.ok(recall.recalledTurns.length >= 1);
    assert.equal(recall.recalledTurns[0].localDate, '2026-11-04');
    assert.ok(recall.pastTurnsXml.includes('Supabase storage limit'));
  });

  // Test 3: Lists ("On Monday we shortlisted 5 CRM tools") preserves full answer (<=2k chars)
  test('preserves full past answer (<= 2k chars) with exact 5 CRM names for shortlist query', async () => {
    const dateRange = resolveDateRange('On Monday we shortlisted 5 CRM tools', FIXED_NOW);
    assert.ok(dateRange);
    assert.equal(dateRange.from, '2026-11-16');

    const recall = await recallPastTurns({
      dateRange,
      query: 'On Monday we shortlisted 5 CRM tools',
    });

    assert.ok(recall);
    assert.ok(recall.recalledTurns.length >= 1);
    const crmTurn = recall.recalledTurns[0];

    // Check all 5 CRM names are present in fullAnswer / answerExcerpt
    assert.ok(crmTurn.answerExcerpt.includes('HubSpot'));
    assert.ok(crmTurn.answerExcerpt.includes('Salesforce'));
    assert.ok(crmTurn.answerExcerpt.includes('Pipedrive'));
    assert.ok(crmTurn.answerExcerpt.includes('Zoho'));
    assert.ok(crmTurn.answerExcerpt.includes('Freshsales'));
  });

  // Test 4: Past sources use letters [a], [b] so they never clash with [n]
  test('formats past sources using letters [a], [b] rather than numbers', async () => {
    const dateRange = resolveDateRange('3 November', FIXED_NOW);
    const recall = await recallPastTurns({
      dateRange,
      query: '3 November Postgres',
    });

    assert.ok(recall);
    assert.ok(recall.pastTurnsXml.includes('<sources_then>[a] neon.tech'));
    assert.ok(!recall.pastTurnsXml.includes('<sources_then>[1]'));
  });

  // Test 5: No date given, memory cue ("What did we decide about Postgres earlier?")
  test('recalls turn using memory cue and FTS5 when no date is specified', async () => {
    const recall = await recallPastTurns({
      dateRange: null,
      query: 'What did we decide about Postgres hosting earlier?',
    });

    assert.ok(recall);
    assert.ok(recall.recalledTurns.length >= 1);
    assert.ok(recall.recalledTurns.some((t) => t.question.includes('Postgres')));
  });
});
