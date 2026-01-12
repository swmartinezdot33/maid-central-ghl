import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    const scopeGroups = await maidCentralAPI.getScopeGroups(locationId);
    
    return NextResponse.json({
      scopeGroups,
      count: scopeGroups.length,
    });
  } catch (error) {
    console.error('Error fetching scope groups:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch scope groups' },
      { status: 500 }
    );
  }
}
