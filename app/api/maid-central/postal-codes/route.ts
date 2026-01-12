import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const postalCode = request.nextUrl.searchParams.get('postalCode');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    // If checking a specific postal code
    if (postalCode) {
      const isValid = await maidCentralAPI.validatePostalCode(postalCode, locationId);
      return NextResponse.json({
        postalCode,
        isValid,
      });
    }

    // Otherwise, get all postal codes
    const postalCodes = await maidCentralAPI.getPostalCodes(locationId);
    
    return NextResponse.json({
      postalCodes,
      count: postalCodes.length,
    });
  } catch (error) {
    console.error('Error fetching postal codes:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch postal codes' },
      { status: 500 }
    );
  }
}
