import {
  getMessagesByDateRange,
  searchMessagesFTS,
  getTurnContext,
  NumberedSource,
} from './log';
import { ResolvedDateRange } from './date-resolver';
import { getSupermemoryClient } from './supermemory';
import { formatISTDateTime, shiftDate, formatISTDate } from '../utils/date';

export interface RecalledTurn {
  id: string; // assistant message id
  userMessageId: string;
  conversationId: string;
  conversationTitle: string;
  dateFormatted: string; // e.g. "Mon 3 Nov, 6:42 PM IST"
  localDate: string; // "YYYY-MM-DD"
  question: string;
  answerExcerpt: string;
  fullAnswer?: string;
  sources?: string[];
  isList?: boolean;
}

export interface RecallResult {
  pastTurnsXml: string;
  recalledTurns: RecalledTurn[];
  widenedNote?: string;
}

const LIST_KEYWORDS_REGEX = /\b(?:shortlist(?:ed)?|5\s+crm|list|crm\s+tools|options|recommendations|candidates|tools)\b/i;

function isListIntent(question: string, answerText: string): boolean {
  if (LIST_KEYWORDS_REGEX.test(question)) return true;
  // If answer contains numbered lists like 1. 2. 3. 4. 5. or Markdown table
  if (/\b1\.\s+[\s\S]*\b2\.\s+[\s\S]*\b3\.\s+/.test(answerText)) return true;
  if (/\|[\s\S]*\|[\s\S]*\|/.test(answerText)) return true;
  return false;
}

function formatLetterSources(sources: NumberedSource[]): string {
  if (!sources || sources.length === 0) return '';
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const formatted = sources.map((s, idx) => {
    const letter = alphabet[idx % alphabet.length];
    const retrievedDate = s.published_date || (s.retrieved_at ? new Date(s.retrieved_at).toISOString().split('T')[0] : '');
    const dateStr = retrievedDate ? ` (retrieved ${retrievedDate})` : '';
    return `[${letter}] ${s.domain || s.url}${dateStr}`;
  });
  return `<sources_then>${formatted.join(' ')}</sources_then>`;
}

/**
 * Recalls relevant past turns from SQLite (and Supermemory if no date given).
 * Rules:
 * - Memory is NOT a tool; recall runs in code before the model.
 * - Dates always come from SQLite metadata, never model text.
 * - Timezone is Asia/Kolkata.
 * - If 0 hits on date range, widens by ±1 day and notes it.
 * - Lists include full past answer (<= 2k chars).
 */
export async function recallPastTurns(options: {
  dateRange?: ResolvedDateRange | null;
  query: string;
  currentConversationId?: string;
}): Promise<RecallResult | null> {
  const { dateRange, query, currentConversationId } = options;
  const turnsToFormat: RecalledTurn[] = [];
  let widenedNote: string | undefined;

  // Case A: Date range provided
  if (dateRange) {
    let candidateUserMsgs = getMessagesByDateRange(dateRange.from, dateRange.to, 'user');

    // Filter out current turn if it's the only one
    if (currentConversationId) {
      candidateUserMsgs = candidateUserMsgs.filter(
        (m) => m.content.trim() !== query.trim()
      );
    }

    // If 0 hits, widen by ±1 day
    if (candidateUserMsgs.length === 0) {
      const widenedFrom = shiftDate(dateRange.from, -1);
      const widenedTo = shiftDate(dateRange.to, 1);
      candidateUserMsgs = getMessagesByDateRange(widenedFrom, widenedTo, 'user');

      if (currentConversationId) {
        candidateUserMsgs = candidateUserMsgs.filter(
          (m) => m.content.trim() !== query.trim()
        );
      }

      if (candidateUserMsgs.length > 0) {
        widenedNote = `No history found on ${dateRange.label}; widened to ${formatISTDate(widenedFrom)} – ${formatISTDate(widenedTo)}`;
      }
    }

    // If more than 3 hits and remaining keywords exist, rank with FTS5 bm25
    if (candidateUserMsgs.length > 3 && dateRange.remainingText) {
      const ftsHits = searchMessagesFTS(dateRange.remainingText, {
        from: dateRange.from,
        to: dateRange.to,
        role: 'user',
        limit: 3,
      });

      if (ftsHits.length > 0) {
        const hitIds = new Set(ftsHits.map((h) => h.id));
        candidateUserMsgs = candidateUserMsgs.filter((m) => hitIds.has(m.id));
      }
    }

    // Take top 3 candidate turns
    const topCandidates = candidateUserMsgs.slice(0, 3);
    for (const userMsg of topCandidates) {
      const turn = getTurnContext(userMsg.id);
      if (!turn) continue;

      const userText = turn.userMessage.content;
      const asstText = turn.assistantMessage?.content || '';
      const isList = isListIntent(userText, asstText) || isListIntent(query, asstText);

      // Lists preserve full answer up to 2k chars, otherwise excerpt up to 900 chars
      const answerExcerpt = isList ? asstText.slice(0, 2000) : asstText.slice(0, 900);
      const dateFormatted = formatISTDateTime(turn.userMessage.created_at, false);

      turnsToFormat.push({
        id: turn.assistantMessage?.id || turn.userMessage.id,
        userMessageId: turn.userMessage.id,
        conversationId: turn.userMessage.conversation_id,
        conversationTitle: turn.conversationTitle,
        dateFormatted,
        localDate: turn.userMessage.local_date || dateRange.from,
        question: userText,
        answerExcerpt,
        fullAnswer: asstText.slice(0, 2000),
        sources: turn.sources.map((s) => s.domain || s.url),
        isList,
      });
    }
  } else {
    // Case B: No date given, memory cue present
    // Parallel: Supermemory semantic search + SQLite FTS5 search
    const supermemory = getSupermemoryClient();
    const [smResults, ftsResults] = await Promise.all([
      supermemory.search(query, { limit: 5 }),
      Promise.resolve(searchMessagesFTS(query, { role: 'user', limit: 5 })),
    ]);

    const candidateIds = new Set<string>();

    for (const sm of smResults) {
      if (sm.metadata?.userMessageId) {
        candidateIds.add(sm.metadata.userMessageId);
      }
    }
    for (const fts of ftsResults) {
      candidateIds.add(fts.id);
    }

    for (const userMsgId of Array.from(candidateIds).slice(0, 3)) {
      const turn = getTurnContext(userMsgId);
      if (!turn) continue;

      // Skip identical current question
      if (turn.userMessage.content.trim() === query.trim()) continue;

      const userText = turn.userMessage.content;
      const asstText = turn.assistantMessage?.content || '';
      const isList = isListIntent(userText, asstText) || isListIntent(query, asstText);
      const answerExcerpt = isList ? asstText.slice(0, 2000) : asstText.slice(0, 900);
      const dateFormatted = formatISTDateTime(turn.userMessage.created_at, false);

      turnsToFormat.push({
        id: turn.assistantMessage?.id || turn.userMessage.id,
        userMessageId: turn.userMessage.id,
        conversationId: turn.userMessage.conversation_id,
        conversationTitle: turn.conversationTitle,
        dateFormatted,
        localDate: turn.userMessage.local_date || '',
        question: userText,
        answerExcerpt,
        fullAnswer: asstText.slice(0, 2000),
        sources: turn.sources.map((s) => s.domain || s.url),
        isList,
      });
    }
  }

  if (turnsToFormat.length === 0) {
    if (widenedNote) {
      return {
        pastTurnsXml: `<past_turns note="${widenedNote}">\n<empty>No matching past conversations found.</empty>\n</past_turns>`,
        recalledTurns: [],
        widenedNote,
      };
    }
    return null;
  }

  // Build <past_turns> XML
  let resolvedAttr = '';
  if (dateRange) {
    resolvedAttr = ` resolved="'${dateRange.matchedText}' → ${dateRange.label}"`;
  }
  let noteAttr = '';
  if (widenedNote) {
    noteAttr = ` note="${widenedNote}"`;
  }

  let xml = `<past_turns${resolvedAttr}${noteAttr}>`;
  for (const turn of turnsToFormat) {
    const fullTurnContext = getTurnContext(turn.userMessageId);
    const sourcesFormatted = fullTurnContext ? formatLetterSources(fullTurnContext.sources) : '';

    xml += `\n <turn date="${turn.dateFormatted}" conversation="${turn.conversationTitle}">`;
    xml += `\n  <question>${turn.question}</question>`;
    xml += `\n  <answer_excerpt>${turn.answerExcerpt}</answer_excerpt>`;
    if (sourcesFormatted) {
      xml += `\n  ${sourcesFormatted}`;
    }
    xml += `\n </turn>`;
  }
  xml += `\n</past_turns>`;

  return {
    pastTurnsXml: xml,
    recalledTurns: turnsToFormat,
    widenedNote,
  };
}
