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

    console.log('[Scope Groups] Fetching for location:', locationId);
    const scopeGroups = await maidCentralAPI.getScopeGroups(locationId);
    
    if (!scopeGroups || scopeGroups.length === 0) {
      console.warn('[Scope Groups] No scope groups returned for location:', locationId);
      return NextResponse.json({
        scopeGroups: [],
        count: 0,
        warning: 'No service types available. Ensure MaidCentral credentials are configured for this location.',
      });
    }
    
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
