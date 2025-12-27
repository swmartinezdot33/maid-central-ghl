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

    // Check if token is expired
    const isExpired = oauthToken?.expiresAt 
      ? Date.now() >= oauthToken.expiresAt 
      : false;

    // OAuth is installed if we have a token with an access token
    // Expiration is checked separately - expired tokens are still "installed" but need refresh
    const hasAccessToken = !!(oauthToken && oauthToken.accessToken);
    const installed = hasAccessToken; // Don't check expiration here - that's handled separately
    
    console.log('[OAuth Status] Final status:', { 
      installed, 
      isExpired, 
      hasToken: hasAccessToken,
      hasRefreshToken: !!oauthToken?.refreshToken,
      locationId,
      tokenExists: !!oauthToken
    });

    return NextResponse.json({
      installed,
      locationId,
      hasToken: hasAccessToken,
      isExpired,
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

