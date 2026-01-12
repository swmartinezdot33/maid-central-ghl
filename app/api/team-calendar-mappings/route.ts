import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import {
  storeTeamCalendarMapping,
  getTeamCalendarMapping,
  getAllTeamCalendarMappings,
  deleteTeamCalendarMapping,
  type TeamCalendarMapping,
} from '@/lib/db';
import { getLocationId } from '@/lib/request-utils';

/**
 * GET /api/team-calendar-mappings
 * Get all team-to-calendar mappings for a location
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

    const mappings = await getAllTeamCalendarMappings(locationId);
    
    return NextResponse.json({ mappings });
  } catch (error) {
    console.error('Error fetching team calendar mappings:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/team-calendar-mappings
 * Create a new team-to-calendar mapping
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
    const { maidCentralTeamId, maidCentralTeamName, ghlCalendarId, ghlCalendarName, enabled } = body;

    if (!maidCentralTeamId || !ghlCalendarId) {
      return NextResponse.json(
        { error: 'maidCentralTeamId and ghlCalendarId are required' },
        { status: 400 }
      );
    }

    const mapping: TeamCalendarMapping = {
      locationId,
      maidCentralTeamId: String(maidCentralTeamId),
      maidCentralTeamName,
      ghlCalendarId: String(ghlCalendarId),
      ghlCalendarName,
      enabled: enabled !== undefined ? enabled : true,
    };

    await storeTeamCalendarMapping(mapping);
    
    return NextResponse.json({ success: true, mapping });
  } catch (error) {
    console.error('Error creating team calendar mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create mapping' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/team-calendar-mappings
 * Update an existing team-to-calendar mapping
 */
export async function PATCH(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { maidCentralTeamId, maidCentralTeamName, ghlCalendarId, ghlCalendarName, enabled } = body;

    if (!maidCentralTeamId) {
      return NextResponse.json(
        { error: 'maidCentralTeamId is required' },
        { status: 400 }
      );
    }

    const existing = await getTeamCalendarMapping(locationId, String(maidCentralTeamId));
    if (!existing) {
      return NextResponse.json(
        { error: 'Mapping not found' },
        { status: 404 }
      );
    }

    const mapping: TeamCalendarMapping = {
      ...existing,
      maidCentralTeamName: maidCentralTeamName !== undefined ? maidCentralTeamName : existing.maidCentralTeamName,
      ghlCalendarId: ghlCalendarId ? String(ghlCalendarId) : existing.ghlCalendarId,
      ghlCalendarName: ghlCalendarName !== undefined ? ghlCalendarName : existing.ghlCalendarName,
      enabled: enabled !== undefined ? enabled : existing.enabled,
    };

    await storeTeamCalendarMapping(mapping);
    
    return NextResponse.json({ success: true, mapping });
  } catch (error) {
    console.error('Error updating team calendar mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update mapping' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/team-calendar-mappings
 * Delete a team-to-calendar mapping
 */
export async function DELETE(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const maidCentralTeamId = searchParams.get('maidCentralTeamId');

    if (!maidCentralTeamId) {
      return NextResponse.json(
        { error: 'maidCentralTeamId is required' },
        { status: 400 }
      );
    }

    await deleteTeamCalendarMapping(locationId, maidCentralTeamId);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting team calendar mapping:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete mapping' },
      { status: 500 }
    );
  }
}



