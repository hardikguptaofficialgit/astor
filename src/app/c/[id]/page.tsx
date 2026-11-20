import { notFound } from 'next/navigation';
import { getConversationById } from '@/lib/db';
import { ChatInterface } from '@/components/chat-interface';
import { UIMessage } from 'ai';

export const dynamic = 'force-dynamic';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conversation = getConversationById(id);

  if (!conversation) {
    notFound();
  }

  const initialMessages: UIMessage[] = conversation.messages.map((m) => {
    const parts: UIMessage['parts'] = [{ type: 'text', text: m.content }];

    // Restore saved parts from parts_json (e.g. data-recall)
    if (m.parts_json) {
      try {
        const saved = JSON.parse(m.parts_json);
        if (Array.isArray(saved)) {
          for (const p of saved) {
            if (p && typeof p === 'object' && p.type === 'data-recall') {
              parts.push(p as UIMessage['parts'][number]);
            }
          }
        }
      } catch {}
    }

    if (m.sources && m.sources.length > 0) {
      parts.push({
        type: 'dynamic-tool',
        toolName: 'web_search',
        toolCallId: `hist-call-${m.id}`,
        state: 'output-available',
        output: {
          state: 'done',
          results: m.sources,
        },
      } as unknown as UIMessage['parts'][number]);
    }

    return {
      id: m.id,
      role: m.role,
      createdAt: m.created_at ? new Date(m.created_at) : undefined,
      parts,
      // Metadata carries local_date
      metadata: {
        local_date: m.local_date,
      },
    };
  });

  return (
    <ChatInterface
      key={id}
      initialId={id}
      initialTitle={conversation.title}
      initialMessages={initialMessages}
      isNewChat={false}
    />
  );
}
