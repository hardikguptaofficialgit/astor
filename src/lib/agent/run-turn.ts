import {
  streamText,
  isStepCount,
  smoothStream,
  ModelMessage,
  UIMessage,
} from 'ai';
import { getModelProvider, effort } from '../llm/provider';
import { STATIC_SYSTEM_PROMPT } from '../prompt/system';
import { buildTurnContext } from '../prompt/context';
import { createWebSearchTool } from '../search/tool';
import { validateCitations } from '../search/citations';
import {
  saveMessage,
  saveSources,
  getConversationById,
  NumberedSource,
  getNextMessageSeq,
} from '../db';
import { getNowIST } from '../utils/date';

export interface RunTurnOptions {
  conversationId: string;
  messages: UIMessage[];
  signal?: AbortSignal;
}

/**
 * Extracts plain text from a UIMessage.
 */
function extractUserText(msg: UIMessage): string {
  if (msg.parts && Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
  }
  if (typeof (msg as unknown as { content?: string }).content === 'string') {
    return (msg as unknown as { content: string }).content;
  }
  return '';
}

/**
 * Replays past conversation history into model-compatible messages:
 * - Assistant answers are capped (max 3k chars), stripped of internal reasoning or tool payloads.
 * - User messages retain their original text.
 * - This creates an append-only, deterministic prefix that maximizes Meta prefix caching.
 */
function buildReplayMessages(
  conversationId: string,
  currentUserMessageId: string
): ModelMessage[] {
  const conv = getConversationById(conversationId);
  if (!conv || !conv.messages || conv.messages.length === 0) {
    return [];
  }

  const result: ModelMessage[] = [];

  for (const m of conv.messages) {
    // Skip the current user message being processed (it will be added with fresh volatile context)
    if (m.id === currentUserMessageId) {
      continue;
    }

    if (m.role === 'user') {
      result.push({
        role: 'user',
        content: m.model_text || m.content,
      });
    } else if (m.role === 'assistant') {
      // Replay clean assistant answer text only (never reasoning or raw tool payloads)
      const cleanText = (m.content || '').slice(0, 3000);
      result.push({
        role: 'assistant',
        content: cleanText,
      });
    }
  }

  return result;
}

/**
 * Runs a turn for the Astor agent.
 * Steps:
 * 1. Persist user message immediately in SQLite.
 * 2. Build stable request (static system prompt + append-only history + volatile user context).
 * 3. Run streamText with at most 3 steps and low reasoning effort.
 * 4. web_search runs parallel queries, dedupes, caps 2/domain, top 8, assigns [n].
 * 5. On finish: save assistant reply, persist sources, and validate [n] citations.
 */
export async function runTurn({ conversationId, messages, signal }: RunTurnOptions) {
  const { localDate: todayDate, formatted: nowFormatted } = getNowIST();

  // Find latest user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) {
    throw new Error('No user message provided in conversation turn.');
  }

  const userText = extractUserText(lastUserMsg);
  const userMsgId = lastUserMsg.id || crypto.randomUUID();
  const userSeq = getNextMessageSeq(conversationId);

  // Per-turn volatile context appended to user message
  const turnContext = buildTurnContext({
    nowFormatted,
    mode: 'normal',
  });
  const modelUserText = `${userText}${turnContext}`;

  // Step 1: Persist user message NOW in SQLite
  saveMessage(userMsgId, conversationId, 'user', userText, new Date().toISOString(), {
    seq: userSeq,
    local_date: todayDate,
    mode: 'normal',
    model_text: modelUserText,
  });

  // Build model messages: replayed history + current user message
  const replayMessages = buildReplayMessages(conversationId, userMsgId);
  const modelMessages: ModelMessage[] = [
    ...replayMessages,
    {
      role: 'user',
      content: modelUserText,
    },
  ];

  // Discovered sources and Tavily credit tracker for this turn
  const discoveredSources: NumberedSource[] = [];
  let totalTavilyCredits = 0;

  const webSearchTool = createWebSearchTool({
    date: todayDate,
    onSourcesFound: (sources, credits) => {
      discoveredSources.push(...sources);
      totalTavilyCredits += credits;
    },
    signal,
  });

  const assistantMsgId = crypto.randomUUID();

  // Step 5: streamText agent loop (stopWhen <= 3 steps)
  const result = streamText({
    model: getModelProvider(),
    system: STATIC_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: {
      web_search: webSearchTool,
    },
    stopWhen: isStepCount(3),
    prepareStep: ({ stepNumber }) => {
      // Step 0: low effort to generate search queries (or quick direct answer)
      // Step 1: low/medium effort to answer after search
      // Step >= 2: toolChoice 'none' to force final answer while keeping tools in schema for prompt caching
      const effortLevel = stepNumber === 0 ? 'low' : 'low';
      return {
        providerOptions: effort(effortLevel),
        toolChoice: stepNumber >= 2 ? 'none' : 'auto',
      };
    },
    maxOutputTokens: 1500,
    maxRetries: 2,
    abortSignal: signal,
    experimental_transform: smoothStream({ chunking: 'word' }),
    onFinish: async ({ text, finishReason, usage }) => {
      if (!text || text.trim().length === 0) {
        return;
      }

      // Step 8: Citation validation: every [n] must map to a real source
      const validNumbers = new Set(discoveredSources.map((s) => s.n));
      const { validatedText } = validateCitations(text, validNumbers);

      const assistantSeq = getNextMessageSeq(conversationId);

      // Persist assistant message in SQLite
      saveMessage(
        assistantMsgId,
        conversationId,
        'assistant',
        validatedText,
        new Date().toISOString(),
        {
          seq: assistantSeq,
          local_date: todayDate,
          mode: 'normal',
          finish: typeof finishReason === 'object' ? JSON.stringify(finishReason) : String(finishReason),
          tokens_in: usage?.inputTokens,
          tokens_cached: (usage as unknown as { cachedTokens?: number })?.cachedTokens ?? 0,
          tokens_out: usage?.outputTokens,
          tokens_reasoning: (usage as unknown as { reasoningTokens?: number })?.reasoningTokens ?? 0,
          tavily_credits: totalTavilyCredits,
        }
      );

      // Persist sources
      if (discoveredSources.length > 0) {
        saveSources(assistantMsgId, discoveredSources);
      }

      // Clean hooks for Memory (M3) and Re-verify (M4):
      // - Supermemory outbox row enqueue
      // - Compaction check if history exceeds token budget
    },
  });

  return result;
}
