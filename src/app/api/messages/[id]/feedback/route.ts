import { NextResponse } from 'next/server';
import { setMessageFeedback } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { feedback } = body as { feedback?: 'up' | 'down' | null };

    if (feedback !== undefined && !['up', 'down', null].includes(feedback)) {
      return NextResponse.json({ error: 'Invalid feedback value' }, { status: 400 });
    }

    const success = setMessageFeedback(id, feedback ?? null);
    if (!success) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, feedback });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
