import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig } from '@/lib/db';
import type { GHLIframeData } from '@/lib/ghl-iframe-context';

/**
 * POST /api/ghl/iframe-context
 * Store iframe context (location ID, user data) from GHL parent window
 */
export async function POST(request: NextRequest) {
  try {
    const body: GHLIframeData = await request.json();
    const { locationId } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    // Get or create config for this location
    let config = await getIntegrationConfig(locationId);
    
    if (!config) {
      // Create default config for this location
      config = {
        ghlLocationId: locationId,
        fieldMappings: [],
        enabled: false,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
        syncAppointments: false,
        appointmentSyncInterval: 15,
        appointmentConflictResolution: 'timestamp',
      };
      await storeIntegrationConfig(config, locationId);
    } else if (config.ghlLocationId !== locationId) {
      // Update location ID if it changed
      config.ghlLocationId = locationId;
      await storeIntegrationConfig(config, locationId);
    }

    return NextResponse.json({
      success: true,
      locationId,
      message: 'Iframe context stored successfully',
    });
  } catch (error) {
    console.error('Error storing iframe context:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to store iframe context' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/ghl/iframe-context
 * Get current iframe context (from query params or session)
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const config = await getIntegrationConfig(locationId);

    return NextResponse.json({
      locationId,
      config: config || null,
    });
  } catch (error) {
    console.error('Error fetching iframe context:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch iframe context' },
      { status: 500 }
    );
  }
}

