import { ModelMessage } from 'ai';
import { Message, NumberedSource } from '../memory/log';

export interface ReplayOptions {
  maxAnswerChars?: number;
  maxSourceContextChars?: number;
  skipMessageId?: string;
}

/**
 * Replays past conversation history into model-compatible messages:
 * - User messages retain their exact model_text (or content).
 * - Assistant answers are capped (max 3k chars), stripped of internal reasoning or tool payloads.
 * - If sources were cited in the assistant message, appends a bounded cited-source context (<=800 chars).
 * - Each historical message's replayed output depends only on that message, so the prompt
 *   only grows at the end and preserves Meta prefix caching across turns.
 */
export function buildReplayMessages(
  messages: Message[],
  options: ReplayOptions = {}
): ModelMessage[] {
  const maxAnswerChars = options.maxAnswerChars ?? 3000;
  const maxSourceContextChars = options.maxSourceContextChars ?? 800;
  const skipId = options.skipMessageId;

  const result: ModelMessage[] = [];

  for (const m of messages) {
    if (skipId && m.id === skipId) {
      continue;
    }

    if (m.role === 'user') {
      result.push({
        role: 'user',
        content: m.model_text || m.content,
      });
    } else if (m.role === 'assistant') {
      let cleanText = (m.content || '').slice(0, maxAnswerChars);

      // Extract which sources were actually cited in the answer (e.g. [1], [2])
      if (m.sources && m.sources.length > 0) {
        const citedNums = new Set(
          Array.from(cleanText.matchAll(/\[(\d+)\]/g), (match) => parseInt(match[1], 10))
        );

        const citedSources = m.sources.filter((s: NumberedSource) => citedNums.has(s.n));
        if (citedSources.length > 0) {
          const sourceNotes = citedSources
            .map((s: NumberedSource) => {
              const snippetExcerpt = s.snippet ? `: "${s.snippet.slice(0, 150)}..."` : '';
              return `[${s.n}] ${s.domain}${snippetExcerpt}`;
            })
            .join('; ');

          const boundedSources = `\n[Context from cited sources: ${sourceNotes}]`.slice(0, maxSourceContextChars);
          cleanText += boundedSources;
        }
      }

      result.push({
        role: 'assistant',
        content: cleanText,
      });
    }
  }

  return result;
}
