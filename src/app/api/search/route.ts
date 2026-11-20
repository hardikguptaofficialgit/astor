import { NextRequest, NextResponse } from 'next/server';
import { searchConversations } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q') || '';
  const results = searchConversations(q);
  return NextResponse.json(results);
}
