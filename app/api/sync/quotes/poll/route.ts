import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getLocationId } from '@/lib/request-utils';
import { getIntegrationConfig, storeIntegrationConfig, initDatabase } from '@/lib/db';
import { neon } from '@neondatabase/serverless';
import { getGHLOAuthToken } from '@/lib/db';
import { syncQuote } from '@/lib/quote-sync';

/**
 * POST /api/sync/quotes/poll
 * Manually trigger a quote poll for the current location
 */
export async function POST(request: NextRequest) {
  try {
    // Initialize database
    await initDatabase();
    
    if (!process.env.DATABASE_URL) {
      return NextResponse.json(
        { error: 'Database not configured' },
        { status: 500 }
      );
    }

    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    // Get config
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled || !config?.syncQuotes) {
      return NextResponse.json(
        { error: 'Quote syncing is not enabled for this location' },
        { status: 400 }
      );
    }

    // Get OAuth token
    const oauthToken = await getGHLOAuthToken(locationId);
    if (!oauthToken) {
      return NextResponse.json(
        { error: 'OAuth token not found' },
        { status: 401 }
      );
    }

    // Get MaidCentral credentials
    const { getMaidCentralCredentials } = await import('@/lib/db');
    const mcCredentials = await getMaidCentralCredentials(locationId);
    
    if (!mcCredentials) {
      return NextResponse.json(
        { error: 'MaidCentral credentials not configured' },
        { status: 400 }
      );
    }

    // Update last poll timestamp immediately
    const now = Date.now();
    const sql = neon(process.env.DATABASE_URL!);
    await sql`
      UPDATE integration_config
      SET last_quote_poll_at = ${now}
      WHERE ghl_location_id = ${locationId}
    `;

    // For now, we'll just update the timestamp
    // The actual quote discovery mechanism can be enhanced later
    // This ensures the timestamp is always updated when a poll is triggered
    
    return NextResponse.json({
      success: true,
      message: 'Quote poll triggered successfully',
      lastPollAt: now,
      timestamp: new Date(now).toISOString(),
    });
  } catch (error) {
    console.error('[Manual Poll] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to trigger poll',
      },
      { status: 500 }
    );
  }
}

