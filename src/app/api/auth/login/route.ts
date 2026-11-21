import { NextResponse } from 'next/server';
import { isAuthConfigured } from '@/lib/auth/config';
import { getUsersCollection } from '@/lib/auth/mongo';
import { createSession, verifyPassword } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    if (!isAuthConfigured()) {
      return NextResponse.json(
        { error: 'MongoDB authentication is not configured on this server.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { email, password } = body as { email?: string; password?: string };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await getUsersCollection();
    const user = await users.findOne({ email: normalizedEmail });

    if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: 'Invalid email or password.' },
        { status: 401 }
      );
    }

    const userId = user._id.toString();
    await createSession(userId);

    return NextResponse.json({
      user: {
        id: userId,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl ?? null,
      },
    });
  } catch (error: unknown) {
    console.error('POST /api/auth/login error:', error);
    const message =
      error instanceof Error ? error.message : 'Invalid email or password.';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
