import { NextResponse } from 'next/server';
import { resolveOfficialLogo } from '@/lib/portal/official-logo.server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const resolution = await resolveOfficialLogo();

  return NextResponse.json(resolution, {
    headers: {
      'Cache-Control': 'private, max-age=300, stale-while-revalidate=600',
    },
  });
}
