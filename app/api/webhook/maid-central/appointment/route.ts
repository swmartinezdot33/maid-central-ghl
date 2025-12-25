import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { syncMaidCentralToGHL } from '@/lib/appointment-sync';
import { getIntegrationConfig } from '@/lib/db';

/**
 * POST /api/webhook/maid-central/appointment
 * Handle Maid Central appointment webhook events
 */
export async function POST(request: NextRequest) {
  try {
    const config = await getIntegrationConfig();
    
    if (!config?.enabled || !config?.syncAppointments) {
      return NextResponse.json({ message: 'Integration or appointment syncing is disabled' }, { status: 200 });
    }

    const body = await request.json().catch(() => ({}));
    const eventType = body.event || body.eventType || 'appointment.created';
    const appointment = body.appointment || body.data || body;

    // Handle different event types
    if (eventType.includes('created') || eventType.includes('booked')) {
      // New appointment created/booked
      const result = await syncMaidCentralToGHL(appointment);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Appointment synced to GHL',
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
      const result = await syncMaidCentralToGHL(appointment);
      
      if (result.success) {
        return NextResponse.json({
          success: true,
          message: 'Appointment updated in GHL',
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
    console.error('Error handling Maid Central appointment webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}








