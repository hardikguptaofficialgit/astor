import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getAppUrl, isGoogleOAuthConfigured, OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const appUrl = getAppUrl();

  try {
    if (!isGoogleOAuthConfigured()) {
      return NextResponse.redirect(`${appUrl}/login?error=google_not_configured`);
    }

    const state = crypto.randomBytes(32).toString('hex');
    const cookieStore = await cookies();
    cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 10 * 60, // 10 minutes
      expires: new Date(Date.now() + 10 * 60 * 1000),
    });

    const redirectUri = `${appUrl}/api/auth/callback`;
    const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    googleAuthUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID!);
    googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
    googleAuthUrl.searchParams.set('response_type', 'code');
    googleAuthUrl.searchParams.set('scope', 'openid email profile');
    googleAuthUrl.searchParams.set('state', state);

    return NextResponse.redirect(googleAuthUrl.toString());
  } catch (error: unknown) {
    console.error('Google OAuth initialization error:', error);
    return NextResponse.redirect(`${appUrl}/login?error=oauth_failed`);
  }
}
