import { resolveDateRange, ResolvedDateRange } from '../memory/date-resolver';

export type RouteLabel = 'chat' | 'search' | 'recall' | 'reverify-cue';

export interface RouteResult {
  label: RouteLabel;
  hasMemoryCue: boolean;
  hasReverifyCue: boolean;
  hasDate: boolean;
  dateRange: ResolvedDateRange | null;
  recalledKeywords?: string;
  isPureRecall: boolean;
}

// Regex heuristics for detecting user memory intent
const MEMORY_CUE_REGEX = /\b(?:what\s+did\s+(?:i|we)|did\s+i\s+ask|i\s+asked|we\s+discussed|we\s+shortlisted|shortlisted|last\s+time|earlier|remember|in\s+(?:our|my)\s+(?:previous|past|last)\s+chat|from\s+my\s+history|what\s+were\s+the|what\s+was\s+the\s+crm|what\s+was\s+the\s+decision|what\s+was\s+the\s+answer|my\s+question\s+about|my\s+previous\s+question)\b/i;

// Regex heuristics for detecting re-verification intent
const REVERIFY_CUE_REGEX = /\b(?:is\s+(?:it|this|that|the\s+pricing|the\s+info)\s+still\s+(?:correct|true|valid|accurate|the\s+same)|has\s+(?:it|anything|this|pricing|the\s+price)\s+changed|still\s+(?:correct|the\s+same|valid|active|true)|any\s+updates?\s+(?:on|today|now)|re-?verify|check\s+if\s+it(?:'s|\s+is)\s+still|is\s+it\s+still\b|still\s+accurate\s+today)\b/i;

// Simple greetings, chit-chat or math
const GREETING_REGEX = /^(hi|hello|hey|good\s+(?:morning|afternoon|evening)|howdy|sup|greetings)(?:\s+[\w]+)?[!\.\s]*$/i;
const MATH_OR_CODE_REGEX = /^(\d+\s*[\+\-\*\/]\s*\d+|what\s+is\s+\d+\s*[\+\-\*\/]\s*\d+)/i;

/**
 * Deterministic router using cheap regex/heuristics.
 * NO LLM call.
 * Labels:
 * - 'chat': greetings, simple math/trivia, conversational chit-chat
 * - 'search': general factual queries requiring Tavily live search
 * - 'recall': questions asking about user's past turns/chats (pure recall skips web search)
 * - 'reverify-cue': questions asking to verify if past information is still valid today
 */
export function routeUserMessage(
  input: string,
  referenceDate?: Date | number | string
): RouteResult {
  const text = (input || '').trim();

  // 1. Chit-chat / Greeting / Pure Math (evaluated first to avoid false-positive date matches e.g. "morning")
  if (GREETING_REGEX.test(text) || MATH_OR_CODE_REGEX.test(text)) {
    return {
      label: 'chat',
      hasMemoryCue: false,
      hasReverifyCue: false,
      hasDate: false,
      dateRange: null,
      isPureRecall: false,
    };
  }

  const dateRange = resolveDateRange(text, referenceDate);
  const hasDate = dateRange !== null;

  const hasMemoryCue = MEMORY_CUE_REGEX.test(text);
  const hasReverifyCue = REVERIFY_CUE_REGEX.test(text);

  // Remaining keywords after removing date phrase
  const remainingKeywords = dateRange?.remainingText || text;

  // 2. Re-verify cue takes priority if there is also past context or date
  if (hasReverifyCue && (hasMemoryCue || hasDate)) {
    return {
      label: 'reverify-cue',
      hasMemoryCue,
      hasReverifyCue,
      hasDate,
      dateRange,
      recalledKeywords: remainingKeywords,
      isPureRecall: false,
    };
  }

  // 3. Recall: memory cue present (with or without date)
  // E.g. "What did I ask you on 3 November?"
  // "On Monday we shortlisted 5 CRM tools"
  // "What did we decide about Postgres earlier?"
  // If only a date/time phrase is given without a personal memory cue (e.g. "What's new in AI this week?"),
  // it is treated as a general factual search, not personal memory recall.
  if (hasMemoryCue) {
    // Pure recall: user asks about their history without asking about today/now/verification
    const isPureRecall = !hasReverifyCue;
    return {
      label: 'recall',
      hasMemoryCue,
      hasReverifyCue,
      hasDate,
      dateRange,
      recalledKeywords: remainingKeywords,
      isPureRecall,
    };
  }

  // 4. Default: search (per §2.5 "When unsure whether facts are fresh, search")
  return {
    label: 'search',
    hasMemoryCue: false,
    hasReverifyCue: false,
    hasDate: false,
    dateRange: null,
    isPureRecall: false,
  };
}
