export interface ConversationItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  pinned_at?: string | null;
  user_id?: string | null;
}

export interface ConversationGroup {
  label: string;
  items: ConversationItem[];
}

/**
 * Groups conversations into pinned items and date-based buckets:
 * - Pinned (ordered by pinned_at DESC)
 * - Today (ordered by updated_at DESC)
 * - Yesterday
 * - Previous 7 days
 * - Previous 30 days
 * - Older
 *
 * Empty buckets are omitted. Pinned conversations never appear in date buckets.
 */
export function groupConversations(
  conversations: ConversationItem[],
  now = new Date()
): ConversationGroup[] {
  if (!conversations || conversations.length === 0) {
    return [];
  }

  // Calculate day boundaries based on the reference local date
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  ).getTime();

  const oneDayMs = 24 * 60 * 60 * 1000;
  const startOfYesterday = startOfToday - oneDayMs;
  const startOf7Days = startOfToday - 6 * oneDayMs;
  const startOf30Days = startOfToday - 29 * oneDayMs;

  const pinnedItems: ConversationItem[] = [];
  const todayItems: ConversationItem[] = [];
  const yesterdayItems: ConversationItem[] = [];
  const weekItems: ConversationItem[] = [];
  const monthItems: ConversationItem[] = [];
  const olderItems: ConversationItem[] = [];

  for (const conv of conversations) {
    if (conv.pinned_at) {
      pinnedItems.push(conv);
      continue;
    }

    const updatedTime = new Date(conv.updated_at).getTime();

    if (updatedTime >= startOfToday) {
      todayItems.push(conv);
    } else if (updatedTime >= startOfYesterday) {
      yesterdayItems.push(conv);
    } else if (updatedTime >= startOf7Days) {
      weekItems.push(conv);
    } else if (updatedTime >= startOf30Days) {
      monthItems.push(conv);
    } else {
      olderItems.push(conv);
    }
  }

  // Sort pinned by most recently pinned first
  pinnedItems.sort(
    (a, b) =>
      new Date(b.pinned_at!).getTime() - new Date(a.pinned_at!).getTime()
  );

  // Sort date buckets by updated_at descending (newest activity first)
  const sortByUpdated = (a: ConversationItem, b: ConversationItem) =>
    new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();

  todayItems.sort(sortByUpdated);
  yesterdayItems.sort(sortByUpdated);
  weekItems.sort(sortByUpdated);
  monthItems.sort(sortByUpdated);
  olderItems.sort(sortByUpdated);

  const groups: ConversationGroup[] = [];

  if (pinnedItems.length > 0) {
    groups.push({ label: 'Pinned', items: pinnedItems });
  }
  if (todayItems.length > 0) {
    groups.push({ label: 'Today', items: todayItems });
  }
  if (yesterdayItems.length > 0) {
    groups.push({ label: 'Yesterday', items: yesterdayItems });
  }
  if (weekItems.length > 0) {
    groups.push({ label: 'Previous 7 days', items: weekItems });
  }
  if (monthItems.length > 0) {
    groups.push({ label: 'Previous 30 days', items: monthItems });
  }
  if (olderItems.length > 0) {
    groups.push({ label: 'Older', items: olderItems });
  }

  return groups;
}
