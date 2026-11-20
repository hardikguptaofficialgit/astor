import {
  enqueueMemoryOutbox,
  getPendingMemoryOutbox,
  markMemoryOutboxSuccess,
  markMemoryOutboxFailure,
} from './log';

export interface TurnDoc {
  conversationId: string;
  userMessageId: string;
  assistantMessageId: string;
  question: string;
  answer: string;
  dateStr: string; // 'YYYY-MM-DD'
  formattedDate: string; // e.g. 'Mon 3 Nov 2026'
  epochMs: number;
  sources?: Array<{ title?: string; domain?: string }>;
}

export interface SupermemorySearchResult {
  id?: string;
  content: string;
  similarity?: number;
  metadata?: {
    conversationId?: string;
    userMessageId?: string;
    assistantMessageId?: string;
    date?: string;
    ts?: number;
    kind?: string;
  };
}

export interface SupermemoryClientOptions {
  apiKey?: string;
  baseUrl?: string;
  containerTag?: string;
  fetchFn?: typeof fetch;
}

let customClientForTesting: SupermemoryClient | null = null;

export class SupermemoryClient {
  private apiKey: string;
  private baseUrl: string;
  private containerTag: string;
  private fetchFn: typeof fetch;

  constructor(options: SupermemoryClientOptions = {}) {
    this.apiKey = options.apiKey ?? (process.env.SUPERMEMORY_API_KEY || '');
    this.baseUrl = options.baseUrl ?? (process.env.SUPERMEMORY_BASE_URL || 'https://api.supermemory.ai');
    this.containerTag = options.containerTag ?? (process.env.ASTOR_MEMORY_CONTAINER || 'astor_local');
    this.fetchFn = options.fetchFn ?? fetch;
  }

  getContainerTag(): string {
    return this.containerTag;
  }

  /**
   * Adds a completed turn document to Supermemory.
   * Fails open: if Supermemory returns an error or is unreachable, enqueues to outbox.
   */
  async add(turnDoc: TurnDoc): Promise<{ success: boolean; supermemoryId?: string }> {
    const sourceSummary = (turnDoc.sources || [])
      .map((s) => `${s.title || ''} (${s.domain || ''})`.trim())
      .filter(Boolean)
      .join(', ');

    const answerExcerpt = (turnDoc.answer || '').slice(0, 800);
    const content = `Asked on ${turnDoc.formattedDate} (IST): ${turnDoc.question}\nAstor answered: ${answerExcerpt}${
      sourceSummary ? `\nSources: ${sourceSummary}` : ''
    }`;

    const payload = {
      content,
      containerTag: this.containerTag,
      metadata: {
        conversationId: turnDoc.conversationId,
        userMessageId: turnDoc.userMessageId,
        assistantMessageId: turnDoc.assistantMessageId,
        date: turnDoc.dateStr,
        ts: turnDoc.epochMs,
        kind: 'turn',
      },
    };

    if (!this.apiKey) {
      // Key missing: enqueue to outbox and return (fail-open)
      enqueueMemoryOutbox(turnDoc.assistantMessageId, payload);
      return { success: false };
    }

    try {
      const res = await this.fetchFn(`${this.baseUrl}/v4/documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(1500),
      });

      if (!res.ok) {
        throw new Error(`Supermemory HTTP ${res.status}: ${res.statusText}`);
      }

      const data = (await res.json()) as { id?: string };
      const supermemoryId = data?.id || crypto.randomUUID();
      return { success: true, supermemoryId };
    } catch {
      // Enqueue to outbox on failure (fail-open)
      enqueueMemoryOutbox(turnDoc.assistantMessageId, payload);
      return { success: false };
    }
  }

  /**
   * Searches Supermemory semantically for past turns.
   * Fails open: returns [] on network error, timeout (1.5s), or missing key.
   */
  async search(
    q: string,
    options: { from?: string; to?: string; limit?: number } = {}
  ): Promise<SupermemorySearchResult[]> {
    if (!this.apiKey || !q.trim()) {
      return [];
    }

    try {
      const res = await this.fetchFn(`${this.baseUrl}/v4/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          q,
          containerTags: [this.containerTag],
          threshold: 0.6,
          limit: options.limit || 5,
        }),
        signal: AbortSignal.timeout(1500),
      });

      if (!res.ok) {
        return [];
      }

      const data = (await res.json()) as { results?: SupermemorySearchResult[] };
      return data.results || [];
    } catch {
      // Fail open: always return [] on error/timeout
      return [];
    }
  }

  /**
   * Processes pending memory outbox rows.
   */
  async processOutbox(limit = 10): Promise<{ processed: number; succeeded: number }> {
    const pending = getPendingMemoryOutbox(limit);
    let succeeded = 0;

    for (const item of pending) {
      if (!this.apiKey) {
        markMemoryOutboxFailure(item.message_id, 'No SUPERMEMORY_API_KEY configured');
        continue;
      }

      try {
        const payload = JSON.parse(item.payload_json);
        const res = await this.fetchFn(`${this.baseUrl}/v4/documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(2000),
        });

        if (res.ok) {
          const data = (await res.json()) as { id?: string };
          const supermemoryId = data?.id || crypto.randomUUID();
          markMemoryOutboxSuccess(item.message_id, supermemoryId);
          succeeded++;
        } else {
          markMemoryOutboxFailure(item.message_id, `HTTP ${res.status}: ${res.statusText}`);
        }
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        markMemoryOutboxFailure(item.message_id, errorMsg);
      }
    }

    return { processed: pending.length, succeeded };
  }
}

export function getSupermemoryClient(): SupermemoryClient {
  if (customClientForTesting) {
    return customClientForTesting;
  }
  return new SupermemoryClient();
}

export function setCustomSupermemoryClientForTesting(client: SupermemoryClient | null) {
  customClientForTesting = client;
}
