import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAuthConfigured } from '@/lib/auth/config';
import { getUsersCollection } from '@/lib/auth/mongo';
import { createSession, hashPassword } from '@/lib/auth/session';

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
    const { name, email, password } = body as {
      name?: string;
      email?: string;
      password?: string;
    };

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A valid email address is required.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long.' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();
    const users = await getUsersCollection();
    const existing = await users.findOne({ email: normalizedEmail });

    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists.' },
        { status: 409 }
      );
    }

    const userName = name?.trim() || normalizedEmail.split('@')[0];
    const passwordHash = hashPassword(password);
    const now = new Date();

    const insertResult = await users.insertOne({
      _id: new ObjectId(),
      email: normalizedEmail,
      name: userName,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const userId = insertResult.insertedId.toString();
    await createSession(userId);

    return NextResponse.json(
      {
        user: {
          id: userId,
          email: normalizedEmail,
          name: userName,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error('POST /api/auth/signup error:', error);
    const message =
      error instanceof Error ? error.message : 'Registration failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
