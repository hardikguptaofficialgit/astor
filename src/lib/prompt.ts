import { STATIC_SYSTEM_PROMPT } from './prompt/system';

export * from './prompt/system';
export * from './prompt/context';

export function getSystemPrompt(): string {
  return STATIC_SYSTEM_PROMPT;
}
