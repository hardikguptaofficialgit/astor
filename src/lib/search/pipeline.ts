import { tavilySearch, TavilyResultItem } from './tavily';
import { getCachedSearchResults, setCachedSearchResults } from './cache';
import { NumberedSource } from '../db';
import { getNowIST } from '../utils/date';

export interface SearchPipelineOptions {
  topic?: 'general' | 'news' | 'finance';
  recency?: 'day' | 'week' | 'month' | 'year';
  since?: string;
  fresh?: boolean;
  startIndex?: number;
  apiKey?: string;
  signal?: AbortSignal;
}

export interface PipelineExecutionResult {
  sources: NumberedSource[];
  creditsUsed: number;
}

const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
  'ref',
  'ref_src',
  'source',
]);

/**
 * Normalizes URL:
 * - lowercase host
 * - strip www.
 * - strip fragment (#)
 * - strip tracking parameters
 * - strip trailing slash (except root)
 */
export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    parsed.protocol = parsed.protocol.toLowerCase();
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    parsed.hash = '';

    // Filter tracking query params
    const keysToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lower = key.toLowerCase();
      if (TRACKING_PARAMS.has(lower) || lower.startsWith('utm_')) {
        keysToDelete.push(key);
      }
    });
    for (const key of keysToDelete) {
      parsed.searchParams.delete(key);
    }

    let result = parsed.toString();
    if (result.endsWith('/') && parsed.pathname !== '/') {
      result = result.slice(0, -1);
    }
    return result;
  } catch {
    return rawUrl.trim();
  }
}

/**
 * Extracts clean domain name for display.
 */
export function extractDomain(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return 'web';
  }
}

/**
 * Merges two snippet strings, avoiding duplicate content.
 */
function mergeSnippets(existing: string, incoming: string): string {
  if (!incoming || existing.includes(incoming)) return existing;
  if (!existing || incoming.includes(existing)) return incoming;
  return `${existing}\n${incoming}`.trim();
}

/**
 * Runs the search pipeline:
 * 1. Parallel execution of 1-3 queries (with SQLite cache first)
 * 2. URL normalization
 * 3. Duplicate merging (keeps max score, concatenates snippets)
 * 4. Drop results with score < 0.25 (unless < 3 would remain)
 * 5. Sort by score descending
 * 6. Cap 2 results per domain
 * 7. Keep top 8 results
 * 8. Assign sequential numbered sources [n]
 */
export async function runSearchPipeline(
  queries: string[],
  options: SearchPipelineOptions = {}
): Promise<PipelineExecutionResult> {
  const cleanQueries = queries.map((q) => q.trim()).filter((q) => q.length > 0).slice(0, 3);
  if (cleanQueries.length === 0) {
    return { sources: [], creditsUsed: 0 };
  }

  const cacheParams = {
    topic: options.topic,
    time_range: options.recency,
    start_date: options.since,
  };

  let totalCredits = 0;

  // 1. Run parallel queries with cache check
  const queryPromises = cleanQueries.map(async (query) => {
    // Check SQLite cache
    const cached = getCachedSearchResults(query, cacheParams, options.fresh);
    if (cached) {
      return { query, results: cached, credits: 0 };
    }

    // Cache miss -> call Tavily
    const resp = await tavilySearch({
      query,
      topic: options.topic,
      time_range: options.recency,
      start_date: options.since,
      apiKey: options.apiKey,
      signal: options.signal,
    });

    // Save to SQLite cache
    setCachedSearchResults(query, cacheParams, resp.results);
    return { query, results: resp.results, credits: resp.creditsUsed };
  });

  const queryResults = await Promise.all(queryPromises);

  // Accumulate credits used
  for (const r of queryResults) {
    totalCredits += r.credits;
  }

  // 2. Combine and normalize results
  const rawItems: TavilyResultItem[] = [];
  for (const qr of queryResults) {
    for (const item of qr.results) {
      rawItems.push(item);
    }
  }

  // 3. Deduplicate by normalized URL (merge duplicate snippets and keep highest score)
  const dedupedMap = new Map<string, TavilyResultItem>();

  for (const item of rawItems) {
    const norm = normalizeUrl(item.url);
    if (!norm) continue;

    const existing = dedupedMap.get(norm);
    if (existing) {
      existing.content = mergeSnippets(existing.content, item.content);
      existing.score = Math.max(existing.score, item.score);
      if (!existing.published_date && item.published_date) {
        existing.published_date = item.published_date;
      }
      if (!existing.favicon && item.favicon) {
        existing.favicon = item.favicon;
      }
      if ((!existing.title || existing.title === 'Untitled') && item.title) {
        existing.title = item.title;
      }
    } else {
      dedupedMap.set(norm, { ...item, url: norm });
    }
  }

  let candidates = Array.from(dedupedMap.values());

  // 4. Drop results with score < 0.25 unless fewer than 3 would remain
  if (candidates.length > 3) {
    const highQuality = candidates.filter((c) => c.score >= 0.25);
    candidates = highQuality.length >= 3 ? highQuality : candidates;
  }

  // 5. Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // 6. Cap max 2 results per domain
  const domainCount = new Map<string, number>();
  const domainFiltered: TavilyResultItem[] = [];

  for (const item of candidates) {
    const domain = extractDomain(item.url);
    const count = domainCount.get(domain) || 0;
    if (count < 2) {
      domainCount.set(domain, count + 1);
      domainFiltered.push(item);
    }
  }

  // 7. Keep top 8 results
  const top8 = domainFiltered.slice(0, 8);

  // 8. Assign numbering [n]
  const startIndex = options.startIndex || 1;
  const retrievedAt = Date.now();

  const numberedSources: NumberedSource[] = top8.map((item, index) => ({
    n: startIndex + index,
    url: item.url,
    title: item.title,
    domain: extractDomain(item.url),
    snippet: item.content,
    published_date: item.published_date,
    retrieved_at: retrievedAt,
    score: item.score,
    favicon: item.favicon,
  }));

  return {
    sources: numberedSources,
    creditsUsed: totalCredits,
  };
}

/**
 * Formats numbered sources for model output.
 * Each snippet is capped at 600 characters per source.
 * Includes published date where available and retrieval date.
 */
export function formatModelOutput(sources: NumberedSource[]): string {
  if (!sources || sources.length === 0) {
    return 'NO_RESULTS';
  }

  const { localDate: today } = getNowIST();

  return sources
    .map((s) => {
      const pubPart = s.published_date ? `published ${s.published_date} ` : '';
      const header = `[${s.n}] ${s.title} — ${s.domain} — ${pubPart}(retrieved ${today})`;
      const cleanSnippet = (s.snippet || '').trim().replace(/\s+/g, ' ');
      const cappedSnippet = cleanSnippet.length > 600 ? `${cleanSnippet.slice(0, 600)}...` : cleanSnippet;
      return `${header}\n${cappedSnippet}`;
    })
    .join('\n\n');
}
