/**
 * Thin Tavily search API client with billing-safe retry logic.
 */

export interface TavilySearchOptions {
  query: string;
  search_depth?: 'basic' | 'advanced';
  max_results?: number;
  chunks_per_source?: number;
  topic?: 'general' | 'news' | 'finance';
  time_range?: 'day' | 'week' | 'month' | 'year';
  start_date?: string; // 'YYYY-MM-DD'
  signal?: AbortSignal;
  apiKey?: string;
}

export interface TavilyResultItem {
  title: string;
  url: string;
  content: string;
  score: number;
  published_date?: string;
  favicon?: string;
}

export interface TavilySearchResponse {
  query: string;
  results: TavilyResultItem[];
  creditsUsed: number;
}

const TAVILY_ENDPOINT = 'https://api.tavily.com/search';

/**
 * Execute a Tavily search query.
 * Enforces an 8-second timeout and 1 billing-safe retry on 429/503/network error.
 */
export async function tavilySearch(options: TavilySearchOptions): Promise<TavilySearchResponse> {
  const apiKey = options.apiKey || process.env.TAVILY_API_KEY;
  if (!apiKey || apiKey.trim().length === 0) {
    throw new Error('TAVILY_API_KEY is not configured in environment.');
  }

  const searchDepth = options.search_depth || 'basic';
  const credits = searchDepth === 'advanced' ? 2 : 1;

  const requestBody: Record<string, unknown> = {
    api_key: apiKey,
    query: options.query,
    search_depth: searchDepth,
    max_results: options.max_results ?? 5,
    chunks_per_source: options.chunks_per_source ?? 2,
    include_answer: false,
    include_raw_content: false,
    include_favicon: true,
  };

  if (options.topic) {
    requestBody.topic = options.topic;
  }
  if (options.time_range) {
    requestBody.time_range = options.time_range;
  }
  if (options.start_date) {
    requestBody.start_date = options.start_date;
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort(new Error('Tavily request timed out after 8000ms'));
    }, 8000);

    // Chain abort signals if external signal is provided
    const combinedSignal = abortController.signal;
    if (options.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        throw options.signal.reason;
      }
      options.signal.addEventListener('abort', () => abortController.abort(options.signal?.reason), {
        once: true,
      });
    }

    try {
      const res = await fetch(TAVILY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: combinedSignal,
      });

      clearTimeout(timeoutId);

      // Handle 429 Rate Limit or 503 Service Unavailable (billing-safe retry)
      if ((res.status === 429 || res.status === 503) && attempt < maxAttempts) {
        const retryAfterHeader = res.headers.get('retry-after');
        let waitMs = 1500;
        if (retryAfterHeader) {
          const parsed = parseInt(retryAfterHeader, 10);
          if (!isNaN(parsed) && parsed > 0) {
            waitMs = Math.min(parsed * 1000, 3000); // clamp to at most 3s
          }
        }
        // Add random jitter 200-500ms
        waitMs += Math.floor(Math.random() * 300) + 200;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const errorText = await res.text().catch(() => '');
        throw new Error(`Tavily API returned HTTP ${res.status}: ${errorText || res.statusText}`);
      }

      const data = (await res.json()) as {
        query?: string;
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
          score?: number;
          published_date?: string;
          favicon?: string;
        }>;
      };

      const results: TavilyResultItem[] = (data.results || []).map((item) => ({
        title: item.title || 'Untitled',
        url: item.url || '',
        content: item.content || '',
        score: typeof item.score === 'number' ? item.score : 0.5,
        published_date: item.published_date,
        favicon: item.favicon,
      }));

      return {
        query: options.query,
        results,
        creditsUsed: credits,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);

      // If aborted by caller, rethrow immediately
      if (options.signal?.aborted) {
        throw options.signal.reason;
      }

      // If it's the first attempt and network/timeout error, retry once with jitter
      if (attempt < maxAttempts) {
        const jitter = Math.floor(Math.random() * 400) + 200;
        await new Promise((r) => setTimeout(r, jitter));
        continue;
      }

      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Tavily search failed: ${msg}`);
    }
  }

  throw new Error('Tavily search failed after retries.');
}
