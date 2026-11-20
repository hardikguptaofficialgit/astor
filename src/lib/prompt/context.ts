import { getNowIST } from '../utils/date';

export interface TurnContextOptions {
  nowFormatted?: string;
  mode?: 'normal' | 'recall' | 'reverify';
  pastTurns?: string;
  searchesLeft?: number;
}

/**
 * Builds the per-turn volatile context block appended to the current user message.
 * Putting dynamic date/time and past context here ensures the system prompt and tools
 * prefix remain completely static for Meta prompt caching.
 */
export function buildTurnContext(options: TurnContextOptions = {}): string {
  const now = options.nowFormatted || getNowIST().formatted;
  const mode = options.mode || 'normal';

  let context = `\n\n<context now="${now}" mode="${mode}">`;

  if (options.pastTurns) {
    context += `\n${options.pastTurns}`;
  }

  if (options.searchesLeft !== undefined) {
    context += `\n<searches_left>${options.searchesLeft}</searches_left>`;
  }

  context += `\n</context>`;

  // 2-line reminder chunk (proven most adhered to by LLMs at end of prompt)
  const reminder = `\n<reminder>\nCite with [n] only from results. Mention dates for anything time-sensitive.\n</reminder>`;

  return `${context}${reminder}`;
}
