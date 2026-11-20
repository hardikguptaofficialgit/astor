import { isApiKeyConfigured } from '@/lib/llm/provider';
import { runTurn } from '@/lib/agent/run-turn';
import { UIMessage } from 'ai';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!isApiKeyConfigured()) {
      return new Response(
        'META_API_KEY is not configured. Please add META_API_KEY to your .env file to enable Astor chat. See .env.example for details.',
        {
          status: 400,
          headers: { 'Content-Type': 'text/plain' },
        }
      );
    }

    const body = await req.json();
    const { id, messages } = body as { id?: string; messages: UIMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return new Response('No messages provided', { status: 400 });
    }

    const conversationId = id || crypto.randomUUID();

    const result = await runTurn({
      conversationId,
      messages,
      signal: req.signal,
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
    });
  } catch (error: unknown) {
    console.error('POST /api/chat error:', error);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return new Response(message, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}
