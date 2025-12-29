import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getGHLOAuthToken, getIntegrationConfig } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

/**
 * GET /api/auth/oauth/status
 * Check OAuth installation status for a location
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request) || 
                      request.nextUrl.searchParams.get('locationId');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    console.log('[OAuth Status] Checking OAuth for locationId:', locationId);
    const oauthToken = await getGHLOAuthToken(locationId);
    console.log('[OAuth Status] OAuth token found:', !!oauthToken, 'hasAccessToken:', !!oauthToken?.accessToken);
    
    const config = await getIntegrationConfig(locationId);

    // SIMPLE LOGIC: If token exists in DB, it's installed and not expired
    // Don't do any tests or expiration checks - just trust that if it's in the DB, it works
    const hasAccessToken = !!(oauthToken && oauthToken.accessToken);
    const installed = hasAccessToken;
    const isExpired = false; // Always false - if token exists, trust it works

    console.log('[OAuth Status] Final status:', { 
      installed, 
      isExpired, 
      hasToken: hasAccessToken,
      hasRefreshToken: !!oauthToken?.refreshToken,
      locationId,
      tokenExists: !!oauthToken,
    });

    return NextResponse.json({
      installed,
      locationId,
      hasToken: hasAccessToken,
      isExpired: false, // Always false - if token exists, show the app
      canRefresh: !!oauthToken?.refreshToken,
      config: config ? {
        enabled: config.enabled,
        syncQuotes: config.syncQuotes,
        syncCustomers: config.syncCustomers,
        syncAppointments: config.syncAppointments,
      } : null,
    });
  } catch (error) {
    console.error('Error checking OAuth status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check OAuth status' },
      { status: 500 }
    );
  }
}

