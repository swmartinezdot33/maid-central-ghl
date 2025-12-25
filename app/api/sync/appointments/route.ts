import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { syncAllAppointments, syncMaidCentralToGHL, syncGHLToMaidCentral } from '@/lib/appointment-sync';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/db';

/**
 * POST /api/sync/appointments/full
 * Perform full bidirectional sync of all appointments
 */
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'full';

    if (action === 'full') {
      const result = await syncAllAppointments();
      return NextResponse.json({
        success: true,
        synced: result.synced,
        errors: result.errors,
        results: result.results,
      });
    } else if (action === 'mc-to-ghl') {
      const body = await request.json().catch(() => ({}));
      const appointmentId = body.appointmentId || body.id;
      
      if (!appointmentId) {
        return NextResponse.json(
          { error: 'Appointment ID is required' },
          { status: 400 }
        );
      }

      const appointment = await maidCentralAPI.getAppointment(appointmentId);
      const result = await syncMaidCentralToGHL(appointment);
      
      return NextResponse.json(result);
    } else if (action === 'ghl-to-mc') {
      const config = await getIntegrationConfig();
      
      if (!config?.ghlCalendarId || !config?.ghlLocationId) {
        return NextResponse.json(
          { error: 'GHL Calendar ID or Location ID not configured' },
          { status: 400 }
        );
      }

      const body = await request.json().catch(() => ({}));
      const appointmentId = body.appointmentId || body.id;
      
      if (!appointmentId) {
        return NextResponse.json(
          { error: 'Appointment ID is required' },
          { status: 400 }
        );
      }

      const appointment = await ghlAPI.getCalendarAppointments(
        config.ghlCalendarId,
        config.ghlLocationId
      ).then(apps => apps.find((app: any) => (app.id || app.appointmentId) === appointmentId));

      if (!appointment) {
        return NextResponse.json(
          { error: 'Appointment not found' },
          { status: 404 }
        );
      }

      const result = await syncGHLToMaidCentral(appointment);
      
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "full", "mc-to-ghl", or "ghl-to-mc"' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error syncing appointments:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync appointments' },
      { status: 500 }
    );
  }
}


