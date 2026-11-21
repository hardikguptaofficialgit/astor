import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConversation,
  getConversationById,
  getAllConversations,
  searchConversations,
  deleteConversation,
  saveMessage,
} from '../lib/db';
import { isAuthConfigured, isGoogleOAuthConfigured, getAppUrl, getDbName } from '../lib/auth/config';
import {
  getCurrentUser,
  hashPassword,
  verifyPassword,
  hashToken,
} from '../lib/auth/session';

test('Auth config: isAuthConfigured and isGoogleOAuthConfigured return booleans without throwing', () => {
  const authConfigured = isAuthConfigured();
  const googleConfigured = isGoogleOAuthConfigured();
  assert.equal(typeof authConfigured, 'boolean');
  assert.equal(typeof googleConfigured, 'boolean');
  assert.equal(typeof getAppUrl(), 'string');
  assert.equal(typeof getDbName(), 'string');
});

test('Password hashing: hashPassword produces salt:key format and random salts', () => {
  const pwd = 'TestPassword123!';
  const hash1 = hashPassword(pwd);
  const hash2 = hashPassword(pwd);

  assert.ok(hash1.includes(':'), 'Hash must contain salt:key delimiter');
  assert.notEqual(hash1, hash2, 'Subsequent hashes must have different random salts');

  const [salt, key] = hash1.split(':');
  assert.equal(salt.length, 32, '16-byte salt must be 32 hex chars');
  assert.equal(key.length, 128, '64-byte scrypt key must be 128 hex chars');
});

test('Password verification: verifyPassword correctly validates and rejects passwords', () => {
  const pwd = 'CorrectHorseBatteryStaple!';
  const hash = hashPassword(pwd);

  // Correct password verification
  assert.equal(verifyPassword(pwd, hash), true, 'Correct password must verify');

  // Wrong password rejection
  assert.equal(verifyPassword('WrongPassword123', hash), false, 'Wrong password must be rejected');
  assert.equal(verifyPassword(pwd.toLowerCase(), hash), false, 'Case mismatch must be rejected');

  // Corrupted / malformed hashes must fail gracefully without throwing
  assert.equal(verifyPassword(pwd, ''), false);
  assert.equal(verifyPassword(pwd, 'invalidhash'), false);
  assert.equal(verifyPassword(pwd, 'abc:def'), false);
  assert.equal(verifyPassword(pwd, ':'), false);
});

test('Token hashing: hashToken produces deterministic 64-char SHA-256 digest', () => {
  const token = 'astor-secure-random-session-token-12345';
  const hash1 = hashToken(token);
  const hash2 = hashToken(token);

  assert.equal(hash1, hash2, 'hashToken must be deterministic');
  assert.equal(hash1.length, 64, 'SHA-256 digest must be 64 hex characters');

  // Verify against known SHA-256 for string "hello"
  assert.equal(
    hashToken('hello'),
    '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
  );
});

test('Session: getCurrentUser returns null gracefully when DB is unconfigured', async () => {
  // In dev/test with no MONGODB_URI, getCurrentUser must return null safely without throwing
  const user = await getCurrentUser();
  assert.equal(user, null);
});

test('SQLite User Isolation: conversations and search are strictly scoped by user_id', () => {
  const userA = `user-a-${Date.now()}`;
  const userB = `user-b-${Date.now()}`;
  const convA1 = `conv-a1-${Date.now()}`;
  const convA2 = `conv-a2-${Date.now()}`;
  const convB1 = `conv-b1-${Date.now()}`;

  try {
    // Create conversations for user A and user B
    createConversation(convA1, 'User A Secret Project Alpha', undefined, userA);
    createConversation(convA2, 'User A Common Notes', undefined, userA);
    createConversation(convB1, 'User B Confidential Research', undefined, userB);

    saveMessage('msg-a1', convA1, 'user', 'Discussing proprietary roadmap', undefined, {
      userId: userA,
    });
    saveMessage('msg-b1', convB1, 'user', 'Discussing quantum cryptography', undefined, {
      userId: userB,
    });

    // 1. getAllConversations(userId) scoping
    const convsA = getAllConversations(userA);
    const convsB = getAllConversations(userB);

    assert.ok(convsA.some((c) => c.id === convA1));
    assert.ok(convsA.some((c) => c.id === convA2));
    assert.ok(!convsA.some((c) => c.id === convB1), 'User A must not see User B conversations');

    assert.ok(convsB.some((c) => c.id === convB1));
    assert.ok(!convsB.some((c) => c.id === convA1), 'User B must not see User A conversations');
    assert.ok(!convsB.some((c) => c.id === convA2));

    // 2. getConversationById(id, userId) isolation
    const fetchedByA = getConversationById(convA1, userA);
    assert.ok(fetchedByA);
    assert.equal(fetchedByA.id, convA1);

    const fetchedByBUnauthorized = getConversationById(convA1, userB);
    assert.equal(
      fetchedByBUnauthorized,
      null,
      'User B must receive null when requesting User A conversation'
    );

    // 3. searchConversations(query, userId) scoping
    const searchA = searchConversations('Discussing', userA);
    assert.ok(searchA.some((s) => s.id === convA1));
    assert.ok(!searchA.some((s) => s.id === convB1), 'User A search must not return User B hits');

    const searchB = searchConversations('Discussing', userB);
    assert.ok(searchB.some((s) => s.id === convB1));
    assert.ok(!searchB.some((s) => s.id === convA1), 'User B search must not return User A hits');

    // 4. deleteConversation(id, userId) cross-user protection
    deleteConversation(convA1, userB);
    // convA1 must still exist for user A
    assert.ok(getConversationById(convA1, userA));

    // Proper delete by owner
    deleteConversation(convA1, userA);
    assert.equal(getConversationById(convA1, userA), null);
  } finally {
    deleteConversation(convA1);
    deleteConversation(convA2);
    deleteConversation(convB1);
  }
});
