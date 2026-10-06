import { NextResponse } from 'next/server';
import { snapshotHealth, getSnapshot } from '@/server/snapshot';

export async function GET() {
  await getSnapshot().catch(() => null);
  return NextResponse.json(snapshotHealth(), { headers: { 'Cache-Control': 'no-store' } });
}
