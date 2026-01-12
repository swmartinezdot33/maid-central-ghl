import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const scopeGroupId = request.nextUrl.searchParams.get('scopeGroupId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    if (!scopeGroupId) {
      return NextResponse.json(
        { error: 'scopeGroupId is required' },
        { status: 400 }
      );
    }

    const scopes = await maidCentralAPI.getScopes(scopeGroupId, locationId);
    
    return NextResponse.json({
      scopes,
      scopeGroupId,
      count: scopes.length,
    });
  } catch (error) {
    console.error('Error fetching scopes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch scopes' },
      { status: 500 }
    );
  }
}
