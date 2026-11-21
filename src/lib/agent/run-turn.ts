import {
  streamText,
  isStepCount,
  ModelMessage,
  UIMessage,
  toUIMessageStream,
  createUIMessageStream,
  createUIMessageStreamResponse,
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
  getUserMemories,
  saveUserMemory,
} from '../db';
import { getNowIST } from '../utils/date';
import { routeUserMessage, RouteResult } from './router';
import { recallPastTurns, RecallResult } from '../memory/recall';
import { buildReplayMessages } from '../history/replay';
import { getSupermemoryClient } from '../memory/supermemory';
import { extractUserFacts, isDuplicateMemory, ExtractedFact } from '../memory/extractor';
import { rankUserMemories } from '../memory/ranking';

export interface RunTurnOptions {
  conversationId: string;
  messages: UIMessage[];
  signal?: AbortSignal;
  userId?: string | null;
  webSearch?: boolean;
  memory?: boolean;
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
 * Runs a turn for the Astor agent.
 * Steps (§2.2):
 * 1. Persist user message immediately in SQLite.
 * 2. Router + date resolver detects intent (chat | search | recall | reverify-cue).
 * 3. Recall executes in code before model if mode != normal, injected as <past_turns>.
 * 4. Build stable request (static system prompt + append-only history + volatile user context).
 * 5. Run streamText with bounded steps (at most 3).
 *    If pure recall: toolChoice 'none' to answer directly from history without web search.
 * 6. web_search runs parallel queries if enabled, dedupes, caps 2/domain, top 8, assigns [n].
 * 7. On finish: save assistant reply, persist sources, validate [n] citations.
 *    Fire-and-forget: Supermemory outbox enqueue and background process.
 */
export async function runTurn({
  conversationId,
  messages,
  signal,
  userId,
  webSearch = true,
  memory = true,
}: RunTurnOptions) {
  const { localDate: todayDate, formatted: nowFormatted, epochMs } = getNowIST();

  // Find latest user message
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) {
    throw new Error('No user message provided in conversation turn.');
  }

  const userText = extractUserText(lastUserMsg);
  const userMsgId = lastUserMsg.id || crypto.randomUUID();
  const userSeq = getNextMessageSeq(conversationId);

  // Step 2 & 3: Route user message & run recall if needed
  const route: RouteResult = routeUserMessage(userText);
  let recallResult: RecallResult | null = null;

  if (memory && (route.label === 'recall' || route.label === 'reverify-cue')) {
    recallResult = await recallPastTurns({
      dateRange: route.dateRange,
      query: userText,
      currentConversationId: conversationId,
    });
  }

  // Determine mode
  const mode = route.label === 'reverify-cue'
    ? 'reverify'
    : route.label === 'recall'
      ? 'recall'
      : 'normal';

  // Autonomous Memory Extraction: scan user turn for personal facts, tech stack, preferences
  const effectiveUserId = userId || 'guest_local';
  const newlyExtractedFacts: ExtractedFact[] = [];
  if (memory) {
    try {
      const candidates = extractUserFacts(userText);
      if (candidates.length > 0) {
        const existingFacts = getUserMemories(effectiveUserId).map((m) => m.fact);
        for (const candidate of candidates) {
          if (!isDuplicateMemory(candidate.fact, existingFacts)) {
            newlyExtractedFacts.push(candidate);
            existingFacts.push(candidate.fact);
            const memId = crypto.randomUUID();
            saveUserMemory(memId, effectiveUserId, candidate.fact, candidate.category);
            // Async sync to Supermemory
            getSupermemoryClient().addFact(effectiveUserId, candidate.fact, candidate.category).catch(() => {});
          }
        }
      }
    } catch {
      // Fail-open
    }
  }

  // Build smart user personalization & memory context ranked by relevance to this query
  let userContext: string | undefined;
  if (memory) {
    try {
      const allMemories = getUserMemories(effectiveUserId);
      const ranked = rankUserMemories(allMemories, userText);
      if (ranked.contextXml) {
        userContext = ranked.contextXml;
      }
    } catch {
      // Fail-open on memory lookup
    }
  }

  // Per-turn volatile context appended to user message
  const turnContext = buildTurnContext({
    nowFormatted,
    mode,
    pastTurns: recallResult?.pastTurnsXml,
    userContext,
  });
  const modelUserText = `${userText}${turnContext}`;

  // Extract any image parts attached to the user message
  const userImageParts: Array<{ type: 'image'; image: string }> = [];
  if (lastUserMsg.parts && Array.isArray(lastUserMsg.parts)) {
    for (const p of lastUserMsg.parts) {
      const part = p as Record<string, unknown>;
      if (part.type === 'image' && typeof part.image === 'string') {
        userImageParts.push({ type: 'image', image: part.image });
      } else if (
        part.type === 'file' &&
        typeof part.url === 'string' &&
        typeof part.mediaType === 'string' &&
        part.mediaType.startsWith('image/')
      ) {
        userImageParts.push({ type: 'image', image: part.url });
      }
    }
  }

  // Step 1: Persist user message NOW in SQLite with model_text for stable replay
  saveMessage(userMsgId, conversationId, 'user', userText, new Date().toISOString(), {
    seq: userSeq,
    local_date: todayDate,
    mode,
    model_text: modelUserText,
    text: userText,
    parts_json: lastUserMsg.parts && lastUserMsg.parts.length > 0 ? JSON.stringify(lastUserMsg.parts) : undefined,
    userId,
  });

  // Fetch full conversation history from SQLite for replay
  const conv = getConversationById(conversationId);
  const convMessages = conv?.messages || [];

  // Build model messages: replayed history + current user message
  const replayMessages = buildReplayMessages(convMessages, { skipMessageId: userMsgId });
  const modelUserContent: ModelMessage['content'] =
    userImageParts.length > 0
      ? [{ type: 'text', text: modelUserText }, ...userImageParts]
      : modelUserText;

  const modelMessages: ModelMessage[] = [
    ...replayMessages,
    {
      role: 'user',
      content: modelUserContent,
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

  // Step 5: streamText agent loop
  const result = streamText({
    model: getModelProvider(),
    system: STATIC_SYSTEM_PROMPT,
    messages: modelMessages,
    tools: webSearch
      ? {
          web_search: webSearchTool,
        }
      : undefined,
    stopWhen: isStepCount(3),
    prepareStep: () => {
      // Note: Meta Model API only supports tool_choice: "auto".
      // "none", "required", and named function choices throw 400 invalid_request_error.
      return {
        providerOptions: effort('low'),
        toolChoice: 'auto',
      };
    },
    maxOutputTokens: 1500,
    maxRetries: 2,
    abortSignal: signal,
    onFinish: async ({ text, finishReason, usage }) => {
      if (!text || text.trim().length === 0) {
        return;
      }

      // Step 8: Citation validation: every [n] must map to a real source
      const validNumbers = new Set(discoveredSources.map((s) => s.n));
      const { validatedText } = validateCitations(text, validNumbers);

      const assistantSeq = getNextMessageSeq(conversationId);

      // Build parts_json for persistence
      const savedParts: unknown[] = [{ type: 'text', text: validatedText }];
      if (recallResult?.recalledTurns && recallResult.recalledTurns.length > 0) {
        savedParts.push({
          type: 'data-recall',
          data: { turns: recallResult.recalledTurns },
        });
      }
      if (newlyExtractedFacts.length > 0) {
        savedParts.push({
          type: 'data-memory-updated',
          data: { facts: newlyExtractedFacts.map((f) => f.fact) },
        });
      }

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
          mode,
          text: validatedText,
          parts_json: JSON.stringify(savedParts),
          finish: typeof finishReason === 'object' ? JSON.stringify(finishReason) : String(finishReason),
          tokens_in: usage?.inputTokens,
          tokens_cached: (usage as unknown as { cachedTokens?: number })?.cachedTokens ?? 0,
          tokens_out: usage?.outputTokens,
          tokens_reasoning: (usage as unknown as { reasoningTokens?: number })?.reasoningTokens ?? 0,
          tavily_credits: totalTavilyCredits,
          userId,
        }
      );

      // Persist sources
      if (discoveredSources.length > 0) {
        saveSources(assistantMsgId, discoveredSources);
      }

      // Step 8 fire-and-forget: Supermemory add and process outbox
      try {
        const supermemory = getSupermemoryClient();
        await supermemory.add({
          conversationId,
          userMessageId: userMsgId,
          assistantMessageId: assistantMsgId,
          question: userText,
          answer: validatedText,
          dateStr: todayDate,
          formattedDate: nowFormatted,
          epochMs,
          sources: discoveredSources.map((s) => ({ title: s.title, domain: s.domain })),
        });
        // Non-blocking outbox check
        supermemory.processOutbox().catch(() => {});
      } catch (smErr) {
        console.error('Supermemory background error (fail-open):', smErr);
      }
    },
  });

  return {
    ...result,
    recallResult,
    route,
    toUIMessageStreamResponse: (options?: { sendReasoning?: boolean }) => {
      const stream = createUIMessageStream({
        originalMessages: messages,
        execute: async ({ writer }) => {
          if (recallResult) {
            // Transient status part for "Checking your history…"
            const writeChunk = writer.write as (chunk: unknown) => void;
            writeChunk({
              type: 'data-status',
              data: { text: 'Checking your history…' },
              transient: true,
            });

            if (recallResult.recalledTurns.length > 0) {
              writeChunk({
                type: 'data-recall',
                data: { turns: recallResult.recalledTurns },
              });
            }
          }

          if (newlyExtractedFacts.length > 0) {
            const writeChunk = writer.write as (chunk: unknown) => void;
            writeChunk({
              type: 'data-memory-updated',
              data: { facts: newlyExtractedFacts.map((f) => f.fact) },
            });
          }

          writer.merge(
            toUIMessageStream({
              stream: result.stream,
              sendReasoning: options?.sendReasoning ?? true,
              originalMessages: messages,
            })
          );
        },
      });

      return createUIMessageStreamResponse({
        stream,
      });
    },
  };
}
