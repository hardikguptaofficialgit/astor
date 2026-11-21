import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { ObjectId } from 'mongodb';
import { getAppUrl, OAUTH_STATE_COOKIE_NAME } from '@/lib/auth/config';
import { getUsersCollection } from '@/lib/auth/mongo';
import { createSession } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const appUrl = getAppUrl();

  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    const cookieStore = await cookies();
    const savedState = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value;

    if (!state || !savedState || state !== savedState) {
      console.error('OAuth callback state verification failed');
      return NextResponse.redirect(new URL('/login?error=invalid_state', appUrl));
    }

    if (!code) {
      console.error('OAuth callback missing authorization code');
      return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
    }

    // Exchange authorization code for tokens
    const redirectUri = `${appUrl}/api/auth/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || '',
        client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      console.error('Google token exchange error:', tokenResponse.status, errText);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
    }

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      console.error('No access token in token exchange response');
      return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
    }

    // Fetch Google profile
    const profileResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!profileResponse.ok) {
      console.error('Failed to fetch Google userinfo:', profileResponse.status);
      return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
    }

    const profile = (await profileResponse.json()) as {
      sub: string;
      email: string;
      name?: string;
      picture?: string;
    };

    if (!profile.email) {
      console.error('No email returned in Google profile');
      return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
    }

    const normalizedEmail = profile.email.toLowerCase();
    const users = await getUsersCollection();
    const existingUser = await users.findOne({ email: normalizedEmail });
    const now = new Date();
    let userId: string;

    if (existingUser) {
      userId = existingUser._id.toString();
      await users.updateOne(
        { _id: existingUser._id },
        {
          $set: {
            googleId: profile.sub,
            avatarUrl: profile.picture || existingUser.avatarUrl,
            name: existingUser.name || profile.name || normalizedEmail.split('@')[0],
            updatedAt: now,
          },
        }
      );
    } else {
      const newId = new ObjectId();
      userId = newId.toString();
      await users.insertOne({
        _id: newId,
        email: normalizedEmail,
        name: profile.name || normalizedEmail.split('@')[0],
        googleId: profile.sub,
        avatarUrl: profile.picture,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Create session
    await createSession(userId);

    // Clear oauth state cookie
    cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

    return NextResponse.redirect(new URL('/', appUrl));
  } catch (error: unknown) {
    console.error('OAuth callback handler error:', error);
    return NextResponse.redirect(new URL('/login?error=oauth_failed', appUrl));
  }
}
