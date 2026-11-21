import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    console.error('POST /api/auth/logout error:', error);
    return NextResponse.json({ ok: true });
  }
}
