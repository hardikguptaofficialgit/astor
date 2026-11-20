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

  const initialMessages: UIMessage[] = conversation.messages.map((m) => ({
    id: m.id,
    role: m.role,
    parts: [{ type: 'text', text: m.content }],
  }));

  return (
    <ChatInterface
      key={id}
      initialId={id}
      initialMessages={initialMessages}
      isNewChat={false}
    />
  );
}
