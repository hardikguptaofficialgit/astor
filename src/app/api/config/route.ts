import { isApiKeyConfigured, ASTOR_MODEL, META_BASE_URL } from '@/lib/model';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasApiKey: isApiKeyConfigured(),
    model: ASTOR_MODEL,
    baseUrl: META_BASE_URL,
  });
}
