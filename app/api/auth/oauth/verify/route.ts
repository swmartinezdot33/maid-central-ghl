import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getGHLOAuthToken, getIntegrationConfig } from '@/lib/db';

/**
 * GET /api/auth/oauth/verify
 * Verifies OAuth token storage for a location
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId');
    
    if (!locationId) {
      return NextResponse.json({
        error: 'Location ID is required',
        verified: false,
      }, { status: 400 });
    }
    
    // Check if token exists
    const oauthToken = await getGHLOAuthToken(locationId);
    const config = await getIntegrationConfig(locationId);
    
    const isExpired = oauthToken?.expiresAt ? Date.now() >= oauthToken.expiresAt : false;
    const hasValidToken = !!(oauthToken && oauthToken.accessToken && !isExpired);
    
    return NextResponse.json({
      verified: hasValidToken,
      locationId,
      token: oauthToken ? {
        exists: true,
        hasAccessToken: !!oauthToken.accessToken,
        hasRefreshToken: !!oauthToken.refreshToken,
        tokenType: oauthToken.tokenType,
        scope: oauthToken.scope,
        userId: oauthToken.userId,
        companyId: oauthToken.companyId,
        expiresAt: oauthToken.expiresAt ? new Date(oauthToken.expiresAt).toISOString() : null,
        isExpired,
        installedAt: oauthToken.installedAt ? new Date(oauthToken.installedAt).toISOString() : null,
      } : {
        exists: false,
      },
      config: config ? {
        exists: true,
        ghlLocationId: config.ghlLocationId,
        enabled: config.enabled,
      } : {
        exists: false,
      },
      message: hasValidToken 
        ? 'OAuth token is stored and valid for this location'
        : oauthToken 
          ? isExpired 
            ? 'OAuth token exists but is expired'
            : 'OAuth token exists but missing access token'
          : 'OAuth token not found for this location',
    });
  } catch (error) {
    console.error('[OAuth Verify] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      verified: false,
    }, { status: 500 });
  }
}

