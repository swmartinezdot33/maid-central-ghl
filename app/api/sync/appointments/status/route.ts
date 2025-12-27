import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, initDatabase } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

/**
 * GET /api/sync/appointments/status
 * Get sync status and statistics (optimized for performance)
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
    
    const config = await getIntegrationConfig(locationId);

    // Optimize: Only fetch sync stats if appointment syncing is enabled
    // Use direct SQL queries instead of getAllAppointmentSyncs() to avoid loading all records
    let totalSynced = 0;
    let lastSync: Date | null = null;

    if (config?.syncAppointments) {
      try {
        const { neon } = await import('@neondatabase/serverless');
        await initDatabase();
        
        if (process.env.DATABASE_URL) {
          const sql = neon(process.env.DATABASE_URL);
          
          // Use COUNT and MAX queries instead of fetching all records for better performance
          const countResult = await sql`
            SELECT COUNT(*) as count FROM appointment_syncs
          `;
          totalSynced = Number(countResult[0]?.count) || 0;

          const lastSyncResult = await sql`
            SELECT MAX(updated_at) as last_sync FROM appointment_syncs
          `;
          const lastSyncValue = lastSyncResult[0]?.last_sync;
          lastSync = lastSyncValue ? new Date(lastSyncValue as Date) : null;
        }
      } catch (dbError) {
        // If query fails, just return config without sync stats (non-critical)
        console.warn('Error fetching appointment sync stats (non-critical):', dbError);
      }
    }

    return NextResponse.json({
      enabled: config?.syncAppointments || false,
      totalSynced,
      lastSync: lastSync?.toISOString() || null,
      calendarId: config?.ghlCalendarId,
      conflictResolution: config?.appointmentConflictResolution || 'timestamp',
      syncInterval: config?.appointmentSyncInterval || 15,
    });
  } catch (error) {
    console.error('Error fetching sync status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}









