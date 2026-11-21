import { NextRequest, NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { getCurrentUser, requireUser } from '@/lib/auth/session';
import { isAuthConfigured } from '@/lib/auth/config';
import { getUsersCollection } from '@/lib/auth/mongo';
import { saveUserMemory } from '@/lib/memory/log';
import { getSupermemoryClient } from '@/lib/memory/supermemory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ user }, { status: 200 });
}

export async function PATCH(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (errorResponse || !user) {
    return errorResponse;
  }

  try {
    const body = (await req.json()) as {
      name?: string;
      avatarUrl?: string;
      profession?: string;
      primaryGoals?: string[];
      customInstructions?: string;
      onboardingCompleted?: boolean;
    };

    const updateFields: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (typeof body.name === 'string' && body.name.trim()) {
      updateFields.name = body.name.trim().slice(0, 100);
    }
    if (body.avatarUrl !== undefined) {
      updateFields.avatarUrl = body.avatarUrl ? String(body.avatarUrl).trim() : null;
    }
    if (body.profession !== undefined) {
      updateFields.profession = body.profession ? String(body.profession).trim().slice(0, 100) : null;
    }
    if (Array.isArray(body.primaryGoals)) {
      updateFields.primaryGoals = body.primaryGoals.map((g) => String(g).trim()).filter(Boolean);
    }
    if (body.customInstructions !== undefined) {
      updateFields.customInstructions = body.customInstructions
        ? String(body.customInstructions).trim().slice(0, 1000)
        : null;
    }
    if (typeof body.onboardingCompleted === 'boolean') {
      updateFields.onboardingCompleted = body.onboardingCompleted;
    }

    if (isAuthConfigured()) {
      const users = await getUsersCollection();
      await users.updateOne(
        { _id: new ObjectId(user.id) },
        { $set: updateFields }
      );
    }

    // If onboarding is being completed and user provided details, save them as initial memory facts
    if (body.onboardingCompleted && (body.profession || (body.primaryGoals && body.primaryGoals.length > 0))) {
      const facts: string[] = [];
      if (body.profession) {
        facts.push(`Profession / Role: ${body.profession}`);
      }
      if (body.primaryGoals && body.primaryGoals.length > 0) {
        facts.push(`Primary goals with Astor: ${body.primaryGoals.join(', ')}`);
      }
      if (body.customInstructions) {
        facts.push(`User custom preference: ${body.customInstructions}`);
      }

      for (const fact of facts) {
        const memoryId = crypto.randomUUID();
        saveUserMemory(memoryId, user.id, fact, 'onboarding');
        getSupermemoryClient().addFact(user.id, fact, 'onboarding').catch(() => {});
      }
    }

    const updatedUser = {
      ...user,
      ...updateFields,
    };

    return NextResponse.json({ user: updatedUser }, { status: 200 });
  } catch (err: unknown) {
    console.error('PATCH /api/user/profile error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
