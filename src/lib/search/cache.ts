import crypto from 'node:crypto';
import { getSearchCache, setSearchCache } from '../db';
import { TavilyResultItem } from './tavily';

export interface CacheKeyParams {
  topic?: string;
  time_range?: string;
  start_date?: string;
  search_depth?: string;
}

/**
 * Normalize search query for caching (lowercase, collapse whitespace, trim).
 */
export function normalizeQuery(query: string): string {
  return query.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Computes sha256 cache key based on normalized query and parameters.
 */
export function computeCacheKey(query: string, params: CacheKeyParams = {}): string {
  const normalized = normalizeQuery(query);
  const rawKey = `${normalized}:${params.topic || 'general'}:${params.time_range || ''}:${params.start_date || ''}:${params.search_depth || 'basic'}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function parseTTL(envVal: string | undefined, defaultValue: number): number {
  if (!envVal) return defaultValue;
  const parsed = parseInt(envVal, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

/**
 * Determines TTL in seconds:
 * - news/finance or daily recency: 1 hour (3600 seconds default, or ASTOR_SEARCH_CACHE_TTL_NEWS)
 * - general topic: 24 hours (86400 seconds default, or ASTOR_SEARCH_CACHE_TTL_GENERAL)
 */
export function getTTLSeconds(params: CacheKeyParams = {}): number {
  if (params.topic === 'news' || params.topic === 'finance' || params.time_range === 'day') {
    return parseTTL(process.env.ASTOR_SEARCH_CACHE_TTL_NEWS, 3600);
  }
  return parseTTL(process.env.ASTOR_SEARCH_CACHE_TTL_GENERAL, 86400);
}

/**
 * Looks up cached search results.
 * Returns results array if found and within TTL, or null if missed/expired.
 */
export function getCachedSearchResults(
  query: string,
  params: CacheKeyParams = {},
  fresh = false
): TavilyResultItem[] | null {
  if (fresh) {
    return null;
  }

  const key = computeCacheKey(query, params);
  const cached = getSearchCache(key);
  if (!cached) {
    return null;
  }

  const now = Date.now();
  const expiresAt = cached.fetched_at + cached.ttl_s * 1000;
  if (now > expiresAt) {
    return null; // Expired
  }

  try {
    return JSON.parse(cached.results_json) as TavilyResultItem[];
  } catch {
    return null;
  }
}

/**
 * Stores search results in the SQLite cache.
 */
export function setCachedSearchResults(
  query: string,
  params: CacheKeyParams = {},
  results: TavilyResultItem[]
): void {
  const key = computeCacheKey(query, params);
  const ttlS = getTTLSeconds(params);
  const paramsJson = JSON.stringify(params);
  const resultsJson = JSON.stringify(results);
  setSearchCache(key, query, paramsJson, resultsJson, ttlS);
}
