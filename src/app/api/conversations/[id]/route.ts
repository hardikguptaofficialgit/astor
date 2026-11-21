import {
  getConversationById,
  renameConversation,
  deleteConversation,
  setConversationPinned,
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    const conversation = getConversationById(id, user?.id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json(conversation);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, pinned } = body as { title?: string; pinned?: boolean };

    const user = await getCurrentUser();

    if (pinned !== undefined) {
      setConversationPinned(id, Boolean(pinned), user?.id);
    }

    if (title && typeof title === 'string' && title.trim().length > 0) {
      renameConversation(id, title.trim(), user?.id);
    }

    const updated = getConversationById(id, user?.id);
    if (!updated) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    deleteConversation(id, user?.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
