import { getAllConversations } from '@/lib/db';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const conversations = getAllConversations();
    return NextResponse.json(conversations);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch conversations';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
