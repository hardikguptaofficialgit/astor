import test from 'node:test';
import assert from 'node:assert/strict';
import { groupConversations, ConversationItem } from '../components/sidebar-groups';

const NOW = new Date(2026, 10, 21, 15, 0, 0); // Sat 21 Nov 2026, local time

function conv(id: string, daysAgo: number, pinnedAt: string | null = null, hour = 10): ConversationItem {
  const d = new Date(2026, 10, 21 - daysAgo, hour, 0, 0).toISOString();
  return { id, title: id, created_at: d, updated_at: d, pinned_at: pinnedAt };
}

test('groups conversations into pinned and date buckets in display order', () => {
  const groups = groupConversations(
    [
      conv('old', 90),
      conv('today-early', 0, null, 8),
      conv('yesterday', 1),
      conv('week', 5),
      conv('month', 20),
      conv('today-late', 0, null, 14),
      conv('pin-a', 40, '2026-11-01T00:00:00.000Z'),
      conv('pin-b', 3, '2026-11-10T00:00:00.000Z'),
    ],
    NOW
  );

  assert.deepEqual(
    groups.map((g) => g.label),
    ['Pinned', 'Today', 'Yesterday', 'Previous 7 days', 'Previous 30 days', 'Older']
  );
  // Most recently pinned first, regardless of activity date
  assert.deepEqual(groups[0].items.map((c) => c.id), ['pin-b', 'pin-a']);
  // Newest activity first within a bucket
  assert.deepEqual(groups[1].items.map((c) => c.id), ['today-late', 'today-early']);
  // Pinned chats never also appear in a date bucket
  const allIds = groups.flatMap((g) => g.items.map((c) => c.id));
  assert.equal(new Set(allIds).size, allIds.length);
});

test('empty buckets are omitted and an empty list yields no groups', () => {
  assert.deepEqual(groupConversations([], NOW), []);
  const groups = groupConversations([conv('a', 0)], NOW);
  assert.deepEqual(groups.map((g) => g.label), ['Today']);
});
