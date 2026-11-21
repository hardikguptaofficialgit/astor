import { getCurrentUser } from '@/lib/auth/session';
import { ChatInterface } from '@/components/chat-interface';
import { LandingPage } from '@/components/landing-page';

export const dynamic = 'force-dynamic';

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ guest?: string }>;
}) {
  const { guest } = await searchParams;
  const user = await getCurrentUser();

  if (user || guest === '1') {
    return <ChatInterface key="new-chat" isNewChat isGuest={!user} />;
  }

  return <LandingPage />;
}
