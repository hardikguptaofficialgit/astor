import test from 'node:test';
import assert from 'node:assert';
import {
  getConversationById,
  getAllConversations,
  getSourcesByMessageId,
  createConversation,
  saveMessage,
  saveSources,
  deleteConversation,
} from '../lib/db';

test('Conversation loader returns plain objects with Object.prototype', () => {
  const testId = `test-conv-prototype-${Date.now()}`;
  const testMsgId = `test-msg-prototype-${Date.now()}`;

  try {
    createConversation(testId, 'Prototype Test');
    saveMessage(testMsgId, testId, 'user', 'Hello world');
    saveSources(testMsgId, [
      {
        n: 1,
        url: 'https://example.com',
        title: 'Example',
        domain: 'example.com',
        snippet: 'Snippet test',
        retrieved_at: Date.now(),
        score: 0.99,
      },
    ]);

    const conv = getConversationById(testId);
    assert.ok(conv !== null, 'Conversation should be found');
    assert.strictEqual(
      Object.getPrototypeOf(conv),
      Object.prototype,
      'Conversation object must inherit from Object.prototype'
    );

    assert.ok(conv.messages.length > 0, 'Conversation should have messages');
    const msg = conv.messages[0];
    assert.strictEqual(
      Object.getPrototypeOf(msg),
      Object.prototype,
      'Message object must inherit from Object.prototype'
    );

    assert.ok(msg.sources && msg.sources.length > 0, 'Message should have sources');
    const source = msg.sources[0];
    assert.strictEqual(
      Object.getPrototypeOf(source),
      Object.prototype,
      'Source object must inherit from Object.prototype'
    );

    // Also verify getAllConversations returns plain objects
    const allConvs = getAllConversations();
    const foundInAll = allConvs.find((c) => c.id === testId);
    assert.ok(foundInAll, 'Found conversation in getAllConversations');
    assert.strictEqual(
      Object.getPrototypeOf(foundInAll),
      Object.prototype,
      'All conversations items must inherit from Object.prototype'
    );

    // Also verify getSourcesByMessageId returns plain objects
    const directSources = getSourcesByMessageId(testMsgId);
    assert.strictEqual(directSources.length, 1);
    assert.strictEqual(
      Object.getPrototypeOf(directSources[0]),
      Object.prototype,
      'Direct sources item must inherit from Object.prototype'
    );
  } finally {
    deleteConversation(testId);
  }
});

test('Existing conversation live-test-1795187143731 returns objects with Object.prototype', () => {
  const conv = getConversationById('live-test-1795187143731');
  if (!conv) return;

  assert.strictEqual(
    Object.getPrototypeOf(conv),
    Object.prototype,
    'Conversation live-test must have Object.prototype'
  );

  for (const msg of conv.messages) {
    assert.strictEqual(
      Object.getPrototypeOf(msg),
      Object.prototype,
      'Message must have Object.prototype'
    );

    if (msg.sources) {
      for (const src of msg.sources) {
        assert.strictEqual(
          Object.getPrototypeOf(src),
          Object.prototype,
          'Source must have Object.prototype'
        );
      }
    }
  }
});
