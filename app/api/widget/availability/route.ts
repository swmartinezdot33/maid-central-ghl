import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const startDate = request.nextUrl.searchParams.get('startDate');
    const endDate = request.nextUrl.searchParams.get('endDate');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'startDate and endDate are required' },
        { status: 400 }
      );
    }

    const availability = await maidCentralAPI.checkAvailabilityAcrossTeams(
      startDate,
      endDate,
      undefined,
      locationId
    );

    return NextResponse.json({
      available: availability.available,
      conflicts: availability.conflicts,
      availableTeams: availability.availableTeams,
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check availability' },
      { status: 500 }
    );
  }
}
