import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig, getGHLPrivateToken, type IntegrationConfig } from '@/lib/kv';

export async function GET(request: NextRequest) {
  try {
    const config = await getIntegrationConfig();
    
    // Check GHL connection status - token must exist AND have a valid token value
    let ghlConnected = false;
    try {
      const ghlToken = await getGHLPrivateToken();
      // Token is connected if it exists AND has a valid token string AND has a location ID
      ghlConnected = !!(ghlToken && ghlToken.privateToken && ghlToken.privateToken.trim() !== '' && (ghlToken.locationId || config?.ghlLocationId));
    } catch (tokenError) {
      // If token fetch fails, assume not connected
      console.warn('[Config] Failed to fetch GHL token:', tokenError);
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
    const body = await request.json();
    const existingConfig = await getIntegrationConfig();
    
    const updatedConfig: IntegrationConfig = {
      ...(existingConfig || { fieldMappings: [], enabled: false }),
      ...body,
      // Preserve fieldMappings if not provided in update
      fieldMappings: body.fieldMappings || existingConfig?.fieldMappings || [],
    };

    await storeIntegrationConfig(updatedConfig);
    return NextResponse.json({ success: true, config: updatedConfig });
  } catch (error) {
    console.error('Error updating config:', error);
    return NextResponse.json(
      { error: 'Failed to update config' },
      { status: 500 }
    );
  }
}

