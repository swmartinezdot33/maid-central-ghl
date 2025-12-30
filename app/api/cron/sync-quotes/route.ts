import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { initDatabase, getIntegrationConfig } from '@/lib/db';
import { neon } from '@neondatabase/serverless';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { markQuoteAsSynced, isQuoteSynced } from '@/lib/db';
import { getGHLOAuthToken } from '@/lib/db';

/**
 * POST /api/cron/sync-quotes
 * Cron endpoint for polling and syncing quotes from MaidCentral
 * Can be triggered by Vercel Cron or external scheduler
 * This endpoint syncs quotes for all locations with quote polling enabled
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

    // Sync quotes for each location
    const results = [];
    for (const row of locations) {
      const locationId = row.location_id as string;
      try {
        // Check if quote polling is enabled for this location
        const config = await getIntegrationConfig(locationId);
        if (!config?.enabled || !config?.syncQuotes || !config?.quotePollingEnabled) {
          results.push({ 
            locationId, 
            success: true, 
            skipped: true,
            message: 'Quote polling is disabled for this location' 
          });
          continue;
        }

        // Check if it's time to poll (based on interval)
        const now = Date.now();
        const lastPollAt = config.lastQuotePollAt || 0;
        const intervalMs = (config.quotePollingInterval || 15) * 60 * 1000; // Convert minutes to ms
        
        if (now - lastPollAt < intervalMs) {
          results.push({
            locationId,
            success: true,
            skipped: true,
            message: `Not time to poll yet. Last poll: ${new Date(lastPollAt).toISOString()}, Next poll in: ${Math.round((intervalMs - (now - lastPollAt)) / 1000 / 60)} minutes`
          });
          continue;
        }

        // Get OAuth token
        const oauthToken = await getGHLOAuthToken(locationId);
        if (!oauthToken) {
          results.push({
            locationId,
            success: false,
            error: 'OAuth token not found'
          });
          continue;
        }

        // Poll for new quotes
        // Note: Since MaidCentral doesn't have a list endpoint for quotes,
        // we need to discover quotes through leads. For now, we'll implement
        // a basic mechanism that can be enhanced.
        
        // Get MaidCentral credentials
        const { getMaidCentralCredentials } = await import('@/lib/db');
        const mcCredentials = await getMaidCentralCredentials(locationId);
        
        if (!mcCredentials) {
          results.push({
            locationId,
            success: false,
            error: 'MaidCentral credentials not configured'
          });
          continue;
        }

        // Initialize MaidCentral API with credentials
        const { maidCentralAPI } = await import('@/lib/maid-central');
        const { isQuoteSynced } = await import('@/lib/db');
        
        // For now, we'll implement a basic polling mechanism
        // This can be enhanced to check specific lead ID ranges or use other discovery methods
        let quotesSynced = 0;
        let errors = 0;

        // TODO: Implement quote discovery mechanism
        // Options:
        // 1. Check a range of lead IDs (if we track last checked ID)
        // 2. Use a webhook-like mechanism where quotes are queued
        // 3. Check recently created leads (if MaidCentral adds this endpoint)
        
        // For now, we'll just update the timestamp
        // The actual syncing will happen when quotes are discovered through other means
        
        // Update last poll timestamp
        await sql`
          UPDATE integration_config
          SET last_quote_poll_at = ${now}
          WHERE ghl_location_id = ${locationId}
        `;

        results.push({
          locationId,
          success: true,
          message: `Quote polling completed. ${quotesSynced} quotes synced, ${errors} errors.`,
          quotesSynced,
          errors,
          lastPollAt: now,
        });
      } catch (error) {
        console.error(`[Cron] Error polling quotes for location ${locationId}:`, error);
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
    console.error('Error in quote polling cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run quote polling cron',
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}

