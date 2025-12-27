import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig, type IntegrationConfig } from '@/lib/kv';
import { getLocationIdFromRequest } from '@/lib/request-utils';
import { getGHLOAuthToken } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const config = await getIntegrationConfig(locationId);
    
    // Check GHL OAuth connection status
    let ghlConnected = false;
    try {
      if (locationId || config?.ghlLocationId) {
        const oauthToken = await getGHLOAuthToken(locationId || config?.ghlLocationId || '');
        // OAuth is connected if token exists, has access token, and is not expired
        const isExpired = oauthToken?.expiresAt ? Date.now() >= oauthToken.expiresAt : false;
        ghlConnected = !!(oauthToken && oauthToken.accessToken && !isExpired);
      }
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

