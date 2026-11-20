import { tool } from 'ai';
import { z } from 'zod';
import { runSearchPipeline, formatModelOutput } from './pipeline';
import { NumberedSource } from '../db';
import { getNowIST } from '../utils/date';

export interface WebSearchToolOptions {
  date?: string;
  year?: number;
  startIndex?: number;
  onSourcesFound?: (sources: NumberedSource[], creditsUsed: number) => void;
  signal?: AbortSignal;
  apiKey?: string;
  fresh?: boolean;
}

export interface WebSearchToolOutput {
  state: 'done';
  queries: string[];
  results: NumberedSource[];
  creditsUsed: number;
  error?: string;
}

export const searchParameters = z.object({
  queries: z
    .array(z.string())
    .min(1)
    .max(3)
    .describe('1-3 short keyword queries covering different aspects of the topic. Run in parallel.'),
  topic: z
    .enum(['general', 'news', 'finance'])
    .optional()
    .describe('Search topic category.'),
  recency: z
    .enum(['day', 'week', 'month', 'year'])
    .optional()
    .describe('Time range for recency filtering.'),
  since: z
    .string()
    .optional()
    .describe('Filter results published on or after YYYY-MM-DD.'),
});

export type SearchParameters = z.infer<typeof searchParameters>;

/**
 * Creates the single web_search tool for the agent.
 * Hard rule: Exactly ONE tool for the model: web_search.
 */
export function createWebSearchTool(options: WebSearchToolOptions = {}) {
  const { localDate: today, year: currentYear } = getNowIST();
  const dateStr = options.date || today;
  const yearNum = options.year || currentYear;

  // Description injects today's date and year (date-only, so changes at most once a day to protect cache)
  const description = `Search the web for current facts. Pass 1–3 short keyword queries covering different aspects; they run in parallel. Today is ${dateStr}, the year is ${yearNum}. Use recency/since for time-sensitive questions.`;

  return tool({
    description,
    inputSchema: searchParameters,
    execute: async function* ({ queries, topic, recency, since }: SearchParameters) {
      // Enforce max 3 queries
      const sanitizedQueries = (queries || []).map((q) => q.trim()).filter((q) => q.length > 0).slice(0, 3);

      // Yield immediate searching state for UI
      yield {
        state: 'searching' as const,
        queries: sanitizedQueries,
      };

      try {
        const { sources, creditsUsed } = await runSearchPipeline(sanitizedQueries, {
          topic,
          recency,
          since,
          fresh: options.fresh,
          startIndex: options.startIndex || 1,
          apiKey: options.apiKey,
          signal: options.signal,
        });

        if (options.onSourcesFound) {
          options.onSourcesFound(sources, creditsUsed);
        }

        // Yield final full results for UI source chips
        yield {
          state: 'done' as const,
          queries: sanitizedQueries,
          results: sources,
          creditsUsed,
        };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        yield {
          state: 'done' as const,
          queries: sanitizedQueries,
          results: [] as NumberedSource[],
          creditsUsed: 0,
          error: errorMsg,
        };
      }
    },
    toModelOutput: (result) => {
      // result in AI SDK v7 tool generator has { output }
      const output = (result as { output?: WebSearchToolOutput })?.output || (result as unknown as WebSearchToolOutput);

      if (!output) {
        return {
          type: 'text',
          value: 'NO_RESULTS',
        };
      }

      if (output.error) {
        return {
          type: 'text',
          value: `SEARCH_FAILED: ${output.error}. Answer from the conversation and general knowledge, say clearly that live search failed, and do not invent citations.`,
        };
      }

      if (!output.results || output.results.length === 0) {
        const qList = (output.queries || []).join(', ');
        return {
          type: 'text',
          value: `NO_RESULTS for "${qList}". Try different keywords once, or answer with the limitation.`,
        };
      }

      return {
        type: 'text',
        value: formatModelOutput(output.results),
      };
    },
  });
}
