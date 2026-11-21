import { NextResponse } from 'next/server';
import { isGoogleOAuthConfigured } from '@/lib/auth/config';
import { getCurrentUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const googleEnabled = isGoogleOAuthConfigured();
    return NextResponse.json({ user, googleEnabled }, { status: 200 });
  } catch (error: unknown) {
    console.error('GET /api/auth/me error:', error);
    return NextResponse.json({ user: null, googleEnabled: false }, { status: 200 });
  }
}
