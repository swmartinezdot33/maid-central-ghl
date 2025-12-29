import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig, type IntegrationConfig } from '@/lib/kv';
import { getLocationIdFromRequest } from '@/lib/request-utils';
import { getGHLOAuthToken } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { 
          error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.',
          config: { fieldMappings: [], enabled: false },
          ghlConnected: false,
          hasLocationId: false,
        },
        { status: 400 }
      );
    }
    
    console.log('[Config API] Fetching config for locationId:', locationId);
    const config = await getIntegrationConfig(locationId);
    console.log('[Config API] Config found:', !!config, 'enabled:', config?.enabled);
    
    // Check GHL OAuth connection status - use the locationId from request
    // SIMPLE LOGIC: If token exists in DB, it's connected (no expiration checks)
    let ghlConnected = false;
    try {
      const oauthToken = await getGHLOAuthToken(locationId);
      // OAuth is connected if token exists and has access token
      // Don't check expiration - if token exists in DB, trust it works
      ghlConnected = !!(oauthToken && oauthToken.accessToken);
      console.log('[Config API] OAuth status:', { 
        hasToken: !!oauthToken, 
        hasAccessToken: !!oauthToken?.accessToken,
        ghlConnected 
      });
    } catch (tokenError) {
      // If token fetch fails, assume not connected
      console.warn('[Config] Failed to fetch GHL OAuth token:', tokenError);
      ghlConnected = false;
    }
    
    return NextResponse.json({
      config: config || { 
        fieldMappings: [], 
        enabled: false, 
        ghlTag: undefined,
        ghlTags: undefined,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
      },
      ghlConnected,
      hasLocationId: !!config?.ghlLocationId,
    });
  } catch (error) {
    console.error('Error fetching config:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch config';
      if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('database')) {
        return NextResponse.json(
          { 
            error: 'Database is not configured. Please set DATABASE_URL environment variable.',
            config: { fieldMappings: [], enabled: false },
            ghlConnected: false,
            hasLocationId: false,
          },
          { status: 200 } // Return 200 so the page can show the error message
        );
      }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    const body = await request.json();
    const finalLocationId = locationId || body.locationId || body.ghlLocationId;
    
    if (!finalLocationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    const existingConfig = await getIntegrationConfig(finalLocationId);
    
    const updatedConfig: IntegrationConfig = {
      ...(existingConfig || { 
        fieldMappings: [], 
        enabled: false,
        ghlLocationId: finalLocationId,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
      }),
      ...body,
      ghlLocationId: finalLocationId, // Ensure location ID is set
      // Preserve fieldMappings if not provided in update
      fieldMappings: body.fieldMappings || existingConfig?.fieldMappings || [],
    };

    await storeIntegrationConfig(updatedConfig, finalLocationId);
    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update config' },
      { status: 500 }
    );
  }
}

