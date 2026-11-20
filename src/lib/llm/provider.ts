import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * Model provider configuration for Astor.
 * Centralized client creation for Meta Model API.
 */
export const META_BASE_URL = process.env.META_BASE_URL || 'https://api.meta.ai/v1';
export const ASTOR_MODEL = process.env.ASTOR_MODEL || 'muse-spark-1.3';

export function isApiKeyConfigured(): boolean {
  const key = process.env.META_API_KEY;
  return typeof key === 'string' && key.trim().length > 0;
}

export function getModelProvider() {
  const apiKey = process.env.META_API_KEY || '';
  const provider = createOpenAICompatible({
    name: 'meta',
    baseURL: META_BASE_URL,
    apiKey,
  });
  return provider(ASTOR_MODEL);
}

/**
 * Helper to set reasoning effort for Meta Muse model.
 * Muse Spark reasons at 'high' effort by default, which consumes excessive tokens.
 * Supported: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'
 */
export function effort(level: 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' | 'max' = 'low') {
  return {
    meta: {
      reasoningEffort: level,
    },
  };
}
