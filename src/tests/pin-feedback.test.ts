import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createConversation,
  saveMessage,
  getConversationById,
  getAllConversations,
  setConversationPinned,
  setMessageFeedback,
  deleteMessagesAfterSeq,
  getMessageRowById,
  deleteConversation,
} from '../lib/db';

test('pinning a conversation sets and clears pinned_at without touching updated_at', () => {
  const id = `test-pin-${Date.now()}`;
  try {
    const created = createConversation(id, 'Pin me');
    assert.equal(getConversationById(id)?.pinned_at, null);

    assert.equal(setConversationPinned(id, true), true);
    const pinned = getAllConversations().find((c) => c.id === id);
    assert.ok(pinned?.pinned_at, 'pinned_at should be set');
    assert.equal(pinned?.updated_at, created.updated_at);

    assert.equal(setConversationPinned(id, false), true);
    assert.equal(getConversationById(id)?.pinned_at, null);
    assert.equal(setConversationPinned('does-not-exist', true), false);
  } finally {
    deleteConversation(id);
  }
});

test('message feedback persists, can be cleared, and rejects unknown ids', () => {
  const id = `test-fb-${Date.now()}`;
  try {
    createConversation(id, 'Feedback');
    saveMessage(`${id}-a`, id, 'assistant', 'Answer', undefined, { seq: 0 });

    assert.equal(setMessageFeedback(`${id}-a`, 'up'), true);
    assert.equal(getConversationById(id)?.messages[0].feedback, 'up');

    assert.equal(setMessageFeedback(`${id}-a`, 'down'), true);
    assert.equal(getConversationById(id)?.messages[0].feedback, 'down');

    assert.equal(setMessageFeedback(`${id}-a`, null), true);
    assert.equal(getConversationById(id)?.messages[0].feedback, null);

    assert.equal(setMessageFeedback('missing-message', 'up'), false);
  } finally {
    deleteConversation(id);
  }
});

test('regenerate cleanup removes answers after a user turn but keeps the turn itself', () => {
  const id = `test-regen-${Date.now()}`;
  try {
    createConversation(id, 'Regenerate');
    saveMessage(`${id}-u1`, id, 'user', 'Question 1', undefined, { seq: 0 });
    saveMessage(`${id}-a1`, id, 'assistant', 'Answer 1', undefined, { seq: 1 });
    saveMessage(`${id}-u2`, id, 'user', 'Question 2', undefined, { seq: 2 });
    saveMessage(`${id}-a2`, id, 'assistant', 'Answer 2', undefined, { seq: 3 });

    assert.equal(getMessageRowById(`${id}-u2`)?.seq, 2);
    assert.equal(deleteMessagesAfterSeq(id, 2), 1);

    const ids = getConversationById(id)?.messages.map((m) => m.id);
    assert.deepEqual(ids, [`${id}-u1`, `${id}-a1`, `${id}-u2`]);
  } finally {
    deleteConversation(id);
  }
});
