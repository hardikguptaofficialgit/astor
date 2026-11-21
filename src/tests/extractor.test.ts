import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractUserFacts, isDuplicateMemory } from '../lib/memory/extractor';
import { rankUserMemories } from '../lib/memory/ranking';
import { UserMemoryItem } from '../lib/memory/log';

describe('Autonomous Memory & Fact Extractor', () => {
  test('extracts explicit "remember that" instruction', () => {
    const text = 'Please remember that I prefer PostgreSQL over MySQL for all projects';
    const facts = extractUserFacts(text);
    assert.equal(facts.length, 1);
    assert.ok(facts[0].fact.includes('prefer PostgreSQL over MySQL'));
    assert.equal(facts[0].category, 'preference');
  });

  test('extracts name and role', () => {
    const text = 'Hi, my name is Alex and I am a Software Engineer at Google';
    const facts = extractUserFacts(text);
    assert.ok(facts.length >= 2);
    assert.ok(facts.some((f) => f.fact === "User's name is Alex" && f.category === 'identity'));
    assert.ok(facts.some((f) => f.fact.includes('Software Engineer')));
  });

  test('extracts project and tech stack', () => {
    const text = "I am building an AI search engine and our stack is Next.js, TypeScript, and MongoDB";
    const facts = extractUserFacts(text);
    assert.ok(facts.length >= 2);
    assert.ok(facts.some((f) => f.fact.includes('AI search engine')));
    assert.ok(facts.some((f) => f.fact.includes('Next.js, TypeScript, and MongoDB')));
  });

  test('isDuplicateMemory flags exact and substring duplicates', () => {
    const existing = [
      "User's name is Hardik",
      'User prefers TypeScript and React',
      'User is building Astor AI',
    ];

    assert.equal(isDuplicateMemory("User's name is Hardik", existing), true);
    assert.equal(isDuplicateMemory('User prefers TypeScript', existing), true);
    assert.equal(isDuplicateMemory('User writes in Python', existing), false);
  });
});

describe('Smart Memory Ranking', () => {
  const sampleMemories: UserMemoryItem[] = [
    {
      id: '1',
      user_id: 'u1',
      fact: 'User prefers PostgreSQL for database schema',
      category: 'workflow',
      created_at: 1000,
      updated_at: 1000,
    },
    {
      id: '2',
      user_id: 'u1',
      fact: 'User is building Astor AI on Google Cloud Run',
      category: 'project',
      created_at: 2000,
      updated_at: 2000,
    },
    {
      id: '3',
      user_id: 'u1',
      fact: 'User lives in Bengaluru, India',
      category: 'general',
      created_at: 3000,
      updated_at: 3000,
    },
    {
      id: '4',
      user_id: 'u1',
      fact: 'User prefers concise responses without pleasantries',
      category: 'preference',
      created_at: 4000,
      updated_at: 4000,
    },
  ];

  test('boosts database memories when query is about PostgreSQL', () => {
    const result = rankUserMemories(sampleMemories, 'How should I structure my database tables in Postgres?');
    assert.ok(result.topMemories.length > 0);
    assert.equal(result.topMemories[0].id, '1', 'Postgres memory must rank first');
    assert.ok(result.contextXml.includes('PostgreSQL'));
  });

  test('boosts project memories when query is about deployment on Cloud Run', () => {
    const result = rankUserMemories(sampleMemories, 'Deploying my container on Cloud Run');
    assert.ok(result.topMemories.length > 0);
    assert.equal(result.topMemories[0].id, '2', 'Cloud Run memory must rank first');
  });

  test('includes all memories and instructions when user asks "What do you know about me?"', () => {
    const result = rankUserMemories(sampleMemories, 'What do you know about me?', {
      name: 'Hardik',
      profession: 'Software Engineer',
      customInstructions: 'Keep code concise',
    });

    assert.equal(result.topMemories.length, 4, 'All memories must be returned on memory inquiry');
    assert.ok(result.contextXml.includes('User Name: Hardik'));
    assert.ok(result.contextXml.includes('Software Engineer'));
    assert.ok(result.contextXml.includes('The user is asking about what you remember about them'));
  });
});
