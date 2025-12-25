import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { syncGHLToMaidCentral } from '@/lib/appointment-sync';
import { getIntegrationConfig } from '@/lib/db';
import { getLocationId } from '@/lib/request-utils';

/**
 * POST /api/webhook/ghl/appointment
 * Handle GoHighLevel appointment webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled || !config?.syncAppointments) {
      return NextResponse.json({ message: 'Integration or appointment syncing is disabled' }, { status: 200 });
    }

    const body = await request.json().catch(() => ({}));
    const eventType = body.type || body.event || body.eventType || 'appointment.created';
    const appointment = body.appointment || body.data || body;

    // Handle different event types
    if (eventType.includes('created') || eventType.includes('booked')) {
      // New appointment created/booked
      const result = await syncGHLToMaidCentral(appointment, locationId);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Appointment synced to Maid Central',
          result,
        });
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to sync appointment' },
          { status: 500 }
        );
      }
    } else if (eventType.includes('updated') || eventType.includes('modified')) {
      // Appointment updated
      const result = await syncGHLToMaidCentral(appointment, locationId);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Appointment updated in Maid Central',
          result,
        });
      } else {
        return NextResponse.json(
          { error: result.error || 'Failed to update appointment' },
          { status: 500 }
        );
      }
    } else if (eventType.includes('deleted') || eventType.includes('cancelled')) {
      // Appointment deleted/cancelled
      // TODO: Implement deletion sync if needed
      return NextResponse.json({
        success: true,
        message: 'Appointment deletion received (deletion sync not yet implemented)',
      });
    }

    return NextResponse.json({ message: 'Event type not handled' }, { status: 200 });
  } catch (error) {
    console.error('Error handling GHL appointment webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}








