import { NextRequest, NextResponse } from 'next/server';
import { ghlAPI } from '@/lib/ghl';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const locations = await ghlAPI.getLocations();
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching GHL locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

