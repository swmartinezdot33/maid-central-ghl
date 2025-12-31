import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { checkAvailability, checkTeamAvailability, findAvailableTeams } from '@/lib/availability-checker';
import { getLocationId } from '@/lib/request-utils';

/**
 * POST /api/availability/check
 * Check availability across all MaidCentral teams for a time slot
 * 
 * Request body:
 * {
 *   startTime: string (ISO date string),
 *   endTime: string (ISO date string),
 *   excludeAppointmentIds?: string[],
 *   bufferMinutes?: number (default: 0),
 *   teamId?: string (optional - check specific team only)
 * }
 * 
 * Returns:
 * {
 *   available: boolean,
 *   conflicts: Array<{ teamId, teamName, appointment, overlapType }>,
 *   availableTeams: Array<{ teamId, teamName }>
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { startTime, endTime, excludeAppointmentIds, bufferMinutes, teamId } = body;

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime are required' },
        { status: 400 }
      );
    }

    // Validate dates
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format. Use ISO 8601 format.' },
        { status: 400 }
      );
    }

    if (start >= end) {
      return NextResponse.json(
        { error: 'startTime must be before endTime' },
        { status: 400 }
      );
    }

    const buffer = bufferMinutes !== undefined ? Number(bufferMinutes) : 0;

    // If teamId is provided, check only that team
    if (teamId) {
      const teamResult = await checkTeamAvailability(
        teamId,
        startTime,
        endTime,
        locationId,
        excludeAppointmentIds?.[0],
        buffer
      );

      return NextResponse.json({
        available: teamResult.available,
        conflicts: teamResult.conflicts.map((conflict: any) => ({
          teamId: teamResult.teamId,
          teamName: teamResult.teamName,
          appointment: conflict,
          overlapType: 'partial' as const,
        })),
        availableTeams: teamResult.available ? [{ teamId: teamResult.teamId, teamName: teamResult.teamName }] : [],
      });
    }

    // Check availability across all teams
    const result = await checkAvailability(
      startTime,
      endTime,
      locationId,
      excludeAppointmentIds,
      buffer
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking availability:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to check availability',
        available: false,
        conflicts: [],
        availableTeams: [],
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/availability/check
 * Check availability using query parameters (for convenience)
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const excludeAppointmentIds = searchParams.get('excludeAppointmentIds')?.split(',').filter(Boolean);
    const bufferMinutes = searchParams.get('bufferMinutes') ? Number(searchParams.get('bufferMinutes')) : undefined;
    const teamId = searchParams.get('teamId');

    if (!startTime || !endTime) {
      return NextResponse.json(
        { error: 'startTime and endTime query parameters are required' },
        { status: 400 }
      );
    }

    // Create a POST request body and call POST handler
    const body = {
      startTime,
      endTime,
      excludeAppointmentIds,
      bufferMinutes,
      teamId: teamId || undefined,
    };

    return POST(new NextRequest(request.url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    }));
  } catch (error) {
    console.error('Error checking availability (GET):', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to check availability',
        available: false,
        conflicts: [],
        availableTeams: [],
      },
      { status: 500 }
    );
  }
}

