import { NextRequest, NextResponse } from 'next/server';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId') || 
                       request.headers.get('x-ghl-location-id');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    // Check OAuth installation status
    const { getGHLOAuthToken } = await import('@/lib/db');
    const oauthToken = await getGHLOAuthToken(locationId);
    console.log('[GHL Fields API] OAuth check:', { 
      installed: !!oauthToken, 
      hasToken: !!oauthToken?.accessToken,
      locationId 
    });
    
    if (!oauthToken?.accessToken) {
      return NextResponse.json(
        { error: 'OAuth not installed for this location. Please install the app via OAuth first.' },
        { status: 401 }
      );
    }

    console.log(`[GHL Fields API] Fetching all fields for location: ${locationId}`);
    const fields = await ghlAPI.getAllFields(locationId);
    console.log(`[GHL Fields API] Returning ${fields.length} total fields (${fields.filter(f => f.type === 'standard').length} standard, ${fields.filter(f => f.type === 'custom').length} custom)`);
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('[GHL Fields API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch fields';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

