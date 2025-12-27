import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

/**
 * GET /api/ghl/appointments
 * Get appointments from GoHighLevel calendar
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    
    // Get config to find the selected calendar
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.ghlCalendarId || !config?.ghlLocationId) {
      return NextResponse.json({ 
        appointments: [],
        error: 'GHL Calendar or Location not configured' 
      });
    }

    const filters: any = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;

    console.log(`[API] Fetching GHL appointments for calendar ${config.ghlCalendarId}`);
    const appointments = await ghlAPI.getCalendarAppointments(
      config.ghlCalendarId, 
      config.ghlLocationId,
      filters
    );
    
    return NextResponse.json({ 
      appointments: Array.isArray(appointments) ? appointments : [],
      count: Array.isArray(appointments) ? appointments.length : 0,
      calendarId: config.ghlCalendarId
    });
  } catch (error) {
    console.error('Error fetching GHL appointments:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch appointments',
        appointments: [], 
      },
      { status: 500 }
    );
  }
}









