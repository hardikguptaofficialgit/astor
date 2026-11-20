import { streamText, convertToModelMessages, UIMessage } from 'ai';
import { getModelProvider, isApiKeyConfigured } from '@/lib/model';
import { getSystemPrompt } from '@/lib/prompt';
import { saveMessage } from '@/lib/db';

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

    // Extract and persist the latest user message
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUserMessage) {
      let userText = '';
      if (lastUserMessage.parts && Array.isArray(lastUserMessage.parts)) {
        userText = lastUserMessage.parts
          .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
          .map((p) => p.text)
          .join('');
      } else if (typeof (lastUserMessage as unknown as { content?: string }).content === 'string') {
        userText = (lastUserMessage as unknown as { content: string }).content;
      }

      const msgId = lastUserMessage.id || crypto.randomUUID();
      saveMessage(msgId, conversationId, 'user', userText, new Date().toISOString());
    }

    // Convert messages for the model
    const modelMessages = await convertToModelMessages(messages);

    const result = streamText({
      model: getModelProvider(),
      system: getSystemPrompt(),
      messages: modelMessages,
      onFinish: async ({ text }) => {
        if (text && text.trim().length > 0) {
          saveMessage(crypto.randomUUID(), conversationId, 'assistant', text, new Date().toISOString());
        }
      },
    });

    return result.toUIMessageStreamResponse();
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
