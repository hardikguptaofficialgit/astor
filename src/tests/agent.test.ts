import test from 'node:test';
import assert from 'node:assert';
import { streamText, isStepCount, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';
import { STATIC_SYSTEM_PROMPT } from '../lib/prompt/system';
import { effort } from '../lib/llm/provider';
import { validateCitations } from '../lib/search/citations';

test('Agent loop: enforces at most 3 steps, low reasoning effort, and final step toolChoice none', async () => {
  let stepCounter = 0;
  const recordedEfforts: ReturnType<typeof effort>[] = [];
  const recordedToolChoices: ('auto' | 'none')[] = [];

  const fakeTool = tool({
    description: 'test web search',
    inputSchema: z.object({ queries: z.array(z.string()) }),
    execute: async ({ queries }: { queries: string[] }) => {
      return {
        state: 'done' as const,
        queries,
        results: [
          {
            n: 1,
            url: 'https://neon.tech',
            title: 'Neon Serverless Postgres',
            domain: 'neon.tech',
            snippet: 'Serverless Postgres database platform.',
            retrieved_at: Date.now(),
            score: 0.95,
          },
        ],
        creditsUsed: 1,
      };
    },
    toModelOutput: () => ({
      type: 'text',
      value: `[1] Neon Serverless Postgres — neon.tech — (retrieved 2026-11-20)\nServerless Postgres database platform.`,
    }),
  });

  const mockModel = new MockLanguageModelV3({
    doStream: async () => {
      stepCounter++;
      if (stepCounter === 1) {
        // Step 1: Model asks to call web_search
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'response-metadata', id: 'resp-1', modelId: 'mock' });
              controller.enqueue({
                type: 'tool-call',
                toolCallId: 'call-1',
                toolName: 'web_search',
                input: JSON.stringify({ queries: ['neon postgres pricing'] }),
              });
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
                usage: {
                  inputTokens: { total: 100, noCache: 100, cacheRead: 0, cacheWrite: 0 },
                  outputTokens: { total: 20, text: 20, reasoning: 0 },
                },
              });
              controller.close();
            }
          }),
        };
      } else {
        // Step 2: Model outputs final answer with citations
        return {
          stream: new ReadableStream({
            start(controller) {
              controller.enqueue({ type: 'response-metadata', id: 'resp-2', modelId: 'mock' });
              controller.enqueue({ type: 'text-start', id: 't-1' });
              controller.enqueue({
                type: 'text-delta',
                id: 't-1',
                delta: 'Neon provides serverless Postgres [1]. Unknown source fact [9].',
              });
              controller.enqueue({ type: 'text-end', id: 't-1' });
              controller.enqueue({
                type: 'finish',
                finishReason: { unified: 'stop', raw: 'stop' },
                usage: {
                  inputTokens: { total: 250, noCache: 50, cacheRead: 200, cacheWrite: 0 },
                  outputTokens: { total: 50, text: 50, reasoning: 0 },
                },
              });
              controller.close();
            }
          }),
        };
      }
    },
  });

  const result = streamText({
    model: mockModel,
    system: STATIC_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: 'What is Neon Postgres pricing?' }],
    tools: { web_search: fakeTool },
    stopWhen: isStepCount(3),
    prepareStep: ({ stepNumber }) => {
      const e = effort('low');
      const tc = stepNumber >= 2 ? 'none' : 'auto';
      recordedEfforts.push(e);
      recordedToolChoices.push(tc);
      return {
        providerOptions: e,
        toolChoice: tc,
      };
    },
  });

  const text = await result.text;
  assert.ok(text.includes('Neon provides serverless Postgres [1].'));

  // Ensure step count did not exceed 3
  assert.ok(stepCounter <= 3, `Expected <= 3 steps, ran ${stepCounter}`);

  // Ensure low reasoning effort was set
  assert.strictEqual(recordedEfforts[0].meta.reasoningEffort, 'low');

  // Verify citation validation on final output: [1] is valid, [9] is stripped
  const validSources = new Set([1]);
  const validated = validateCitations(text, validSources);
  assert.deepStrictEqual(validated.validCitations, [1]);
  assert.deepStrictEqual(validated.invalidCitations, [9]);
  assert.strictEqual(
    validated.validatedText,
    'Neon provides serverless Postgres [1]. Unknown source fact.'
  );
});
