import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { isAuthConfigured } from '@/lib/auth/config';
import { getUserMemoriesCollection } from '@/lib/auth/mongo';
import {
  getUserMemories,
  saveUserMemory,
  deleteUserMemory,
  clearUserMemories,
} from '@/lib/memory/log';
import { getSupermemoryClient } from '@/lib/memory/supermemory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || 'guest_local';

    // Fetch from SQLite (which is always fast, synchronous, and local)
    const localMemories = getUserMemories(userId);

    // If MongoDB is configured and user is authenticated, sync any missing records
    if (isAuthConfigured() && user) {
      try {
        const collection = await getUserMemoriesCollection();
        const mongoDocs = await collection
          .find({ userId: user.id })
          .sort({ createdAt: -1 })
          .limit(50)
          .toArray();

        // If local had fewer, backfill
        if (mongoDocs.length > localMemories.length) {
          return NextResponse.json({
            memories: mongoDocs.map((doc) => ({
              id: doc._id.toString(),
              fact: doc.fact,
              category: doc.category || 'general',
              created_at: doc.createdAt.getTime(),
            })),
          });
        }
      } catch {
        // Fall back to localMemories
      }
    }

    return NextResponse.json({ memories: localMemories }, { status: 200 });
  } catch (err: unknown) {
    console.error('GET /api/user/memories error:', err);
    return NextResponse.json({ memories: [] }, { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || 'guest_local';

    const body = (await req.json()) as { fact?: string; category?: string };
    if (!body.fact || !body.fact.trim()) {
      return NextResponse.json({ error: 'Fact cannot be empty' }, { status: 400 });
    }

    const fact = body.fact.trim().slice(0, 500);
    const category = (body.category || 'general').trim().slice(0, 50);
    const id = crypto.randomUUID();

    // 1. Save to SQLite
    const memoryItem = saveUserMemory(id, userId, fact, category);

    // 2. Save to MongoDB if authenticated
    if (isAuthConfigured() && user) {
      try {
        const collection = await getUserMemoriesCollection();
        await collection.insertOne({
          _id: undefined as never, // Mongo auto assigns ObjectId
          userId: user.id,
          fact,
          category,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (mongoErr) {
        console.error('Failed to save memory to Mongo:', mongoErr);
      }
    }

    // 3. Fire-and-forget sync to Supermemory
    getSupermemoryClient()
      .addFact(userId, fact, category)
      .catch(() => {});

    return NextResponse.json({ memory: memoryItem }, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/user/memories error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const userId = user?.id || 'guest_local';

    const body = (await req.json().catch(() => ({}))) as {
      id?: string;
      clearAll?: boolean;
    };

    if (body.clearAll) {
      clearUserMemories(userId);
      if (isAuthConfigured() && user) {
        try {
          const collection = await getUserMemoriesCollection();
          await collection.deleteMany({ userId: user.id });
        } catch {}
      }
      return NextResponse.json({ success: true, cleared: true }, { status: 200 });
    }

    if (!body.id) {
      return NextResponse.json({ error: 'Memory ID required' }, { status: 400 });
    }

    deleteUserMemory(body.id, userId);
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err: unknown) {
    console.error('DELETE /api/user/memories error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}
