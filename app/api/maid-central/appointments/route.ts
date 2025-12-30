import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationId } from '@/lib/request-utils';

/**
 * GET /api/maid-central/appointments
 * Get appointments/bookings from Maid Central
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const status = searchParams.get('status') || undefined;
    const leadId = searchParams.get('leadId') || undefined;

    const filters: any = {};
    if (startDate) filters.startDate = startDate;
    if (endDate) filters.endDate = endDate;
    if (status) filters.status = status;
    if (leadId) filters.leadId = leadId;

    const appointments = await maidCentralAPI.getAppointments(filters, locationId);
    
    return NextResponse.json({ 
      appointments: Array.isArray(appointments) ? appointments : [],
      count: Array.isArray(appointments) ? appointments.length : 0,
    });
  } catch (error) {
    console.error('Error fetching Maid Central appointments:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch appointments',
        appointments: [], // Return empty array on error
      },
      { status: 500 }
    );
  }
}









