import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

/**
 * Model provider configuration for Astor.
 * All model provider creation is centralized in this module.
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
