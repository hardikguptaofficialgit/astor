import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { isAuthConfigured, SESSION_COOKIE_NAME } from './config';
import { getSessionsCollection, getUsersCollection } from './mongo';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

/**
 * Hashes password using scrypt with random 16-byte salt.
 * Returns format `${salt}:${derivedKey}`.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verifies password against stored hash using scrypt + crypto.timingSafeEqual.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, key] = parts;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

/**
 * Generates SHA-256 hex digest of a token.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Creates a new active session for the given user ID.
 * Sets the astor_session cookie and returns the raw token.
 */
export async function createSession(userId: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const createdAt = new Date();

  const sessions = await getSessionsCollection();
  await sessions.insertOne({
    _id: new ObjectId(),
    tokenHash,
    userId,
    expiresAt,
    createdAt,
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
  });

  return rawToken;
}

/**
 * Returns current authenticated user or null. Never throws.
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    if (!isAuthConfigured()) {
      return null;
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      return null;
    }

    const tokenHash = hashToken(token);
    const sessions = await getSessionsCollection();
    const session = await sessions.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return null;
    }

    let userObjectId: ObjectId;
    try {
      userObjectId = new ObjectId(session.userId);
    } catch {
      return null;
    }

    const users = await getUsersCollection();
    const user = await users.findOne({ _id: userObjectId });

    if (!user) {
      return null;
    }

    return {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl ?? null,
    };
  } catch (err) {
    console.error('getCurrentUser error:', err);
    return null;
  }
}

/**
 * Deletes current session from database and clears the session cookie.
 */
export async function destroySession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token && isAuthConfigured()) {
      const tokenHash = hashToken(token);
      const sessions = await getSessionsCollection();
      await sessions.deleteOne({ tokenHash });
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  } catch (err) {
    console.error('destroySession error:', err);
  }
}

/**
 * Checks for authenticated user. If not authenticated, returns 401 response.
 */
export async function requireUser(): Promise<{
  user: AuthUser | null;
  errorResponse: NextResponse | null;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      user: null,
      errorResponse: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  return { user, errorResponse: null };
}
