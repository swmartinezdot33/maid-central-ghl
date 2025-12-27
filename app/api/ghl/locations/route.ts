import { NextRequest, NextResponse } from 'next/server';
import { ghlAPI } from '@/lib/ghl';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request) || 
                      request.nextUrl.searchParams.get('locationId');
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. OAuth installation required.' },
        { status: 400 }
      );
    }
    
    const locations = await ghlAPI.getLocations(locationId);
    return NextResponse.json({ locations });
  } catch (error) {
    console.error('Error fetching GHL locations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

