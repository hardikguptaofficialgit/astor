import { NextRequest, NextResponse } from 'next/server';
import { searchConversations } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const user = await getCurrentUser();
  const results = searchConversations(q, user?.id);
  return NextResponse.json(results);
}
