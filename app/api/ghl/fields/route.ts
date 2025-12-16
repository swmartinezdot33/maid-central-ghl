import { NextRequest, NextResponse } from 'next/server';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/kv';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const config = await getIntegrationConfig();
    const locationId = config?.ghlLocationId || request.nextUrl.searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Please complete OAuth flow first.' },
        { status: 400 }
      );
    }

    // Debug: Check if token exists before calling API
    const { getGHLPrivateToken } = await import('@/lib/kv');
    const tokenCheck = await getGHLPrivateToken();
    console.log('[GHL Fields API] Token check:', { 
      exists: !!tokenCheck, 
      hasToken: !!tokenCheck?.privateToken,
      locationId: tokenCheck?.locationId 
    });

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

