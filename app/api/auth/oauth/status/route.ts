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

    const oauthToken = await getGHLOAuthToken(locationId);
    const config = await getIntegrationConfig(locationId);

    // Check if token is expired
    const isExpired = oauthToken?.expiresAt 
      ? Date.now() >= oauthToken.expiresAt 
      : false;

    return NextResponse.json({
      installed: !!oauthToken,
      locationId,
      hasToken: !!oauthToken?.accessToken,
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

