import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { syncAllAppointments } from '@/lib/appointment-sync';
import { initDatabase } from '@/lib/db';
import { neon } from '@neondatabase/serverless';
import { getIntegrationConfig } from '@/lib/db';

/**
 * POST /api/cron/sync-appointments
 * Cron endpoint for syncing appointments from all locations
 * Can be triggered by Vercel Cron or external scheduler
 * This endpoint syncs appointments for all locations with OAuth tokens installed
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all locations with OAuth tokens installed
    await initDatabase();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }
    
    const sql = neon(process.env.DATABASE_URL);
    const locations = await sql`
      SELECT DISTINCT location_id 
      FROM ghl_oauth_tokens 
      WHERE access_token IS NOT NULL
    `;
    
    if (locations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No locations with OAuth tokens found',
        skipped: true,
      });
    }

    // Sync appointments for each location
    const results = [];
    for (const row of locations) {
      const locationId = row.location_id as string;
      try {
        // Check if appointment syncing is enabled for this location
        const config = await getIntegrationConfig(locationId);
        if (!config?.syncAppointments) {
          results.push({ 
            locationId, 
            success: true, 
            skipped: true,
            message: 'Appointment syncing is disabled for this location' 
          });
          continue;
        }
        
        const result = await syncAllAppointments(locationId);
        results.push({ locationId, success: true, result });
      } catch (error) {
        console.error(`[Cron] Error syncing appointments for location ${locationId}:`, error);
        results.push({ 
          locationId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      locationsProcessed: locations.length,
      results,
    });
  } catch (error) {
    console.error('Error in appointment sync cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run sync cron',
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}









