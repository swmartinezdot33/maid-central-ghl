import { NextRequest, NextResponse } from 'next/server';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = await getIntegrationConfig();
    const locationId = config?.ghlLocationId || request.nextUrl.searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Please complete OAuth flow first.' },
        { status: 400 }
      );
    }

    const fields = await ghlAPI.getAllFields(locationId);
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error fetching GHL fields:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}

