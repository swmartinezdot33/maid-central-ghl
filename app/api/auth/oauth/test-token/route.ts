import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getGHLOAuthToken } from '@/lib/db';

/**
 * GET /api/auth/oauth/test-token
 * Tests if the stored OAuth token is valid by making a test API call
 */
export async function GET(request: NextRequest) {
  try {
    const locationId = request.nextUrl.searchParams.get('locationId');
    
    if (!locationId) {
      return NextResponse.json({
        error: 'Location ID is required',
        valid: false,
      }, { status: 400 });
    }
    
    // Get stored token
    const oauthToken = await getGHLOAuthToken(locationId);
    
    if (!oauthToken || !oauthToken.accessToken) {
      return NextResponse.json({
        valid: false,
        error: 'No OAuth token found for this location',
        locationId,
      });
    }
    
    // Check if expired
    const isExpired = oauthToken.expiresAt ? Date.now() >= oauthToken.expiresAt : false;
    if (isExpired) {
      return NextResponse.json({
        valid: false,
        error: 'OAuth token is expired',
        locationId,
        expiresAt: oauthToken.expiresAt ? new Date(oauthToken.expiresAt).toISOString() : null,
        now: new Date().toISOString(),
      });
    }
    
    // Test the token by making a simple API call
    try {
      const testResponse = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${oauthToken.accessToken}`,
          'Version': '2021-04-15',
          'Content-Type': 'application/json',
        },
      });
      
      if (testResponse.ok) {
        const locationData = await testResponse.json();
        return NextResponse.json({
          valid: true,
          locationId,
          tokenInfo: {
            hasAccessToken: !!oauthToken.accessToken,
            hasRefreshToken: !!oauthToken.refreshToken,
            tokenType: oauthToken.tokenType,
            scope: oauthToken.scope,
            expiresAt: oauthToken.expiresAt ? new Date(oauthToken.expiresAt).toISOString() : null,
            installedAt: oauthToken.installedAt ? new Date(oauthToken.installedAt).toISOString() : null,
          },
          testResult: {
            status: testResponse.status,
            locationName: locationData?.location?.name || locationData?.name || 'Unknown',
          },
          message: 'Token is valid and working!',
        });
      } else {
        const errorData = await testResponse.json().catch(() => ({ error: 'Unknown error' }));
        return NextResponse.json({
          valid: false,
          error: `Token test failed: ${testResponse.status} ${testResponse.statusText}`,
          errorDetails: errorData,
          locationId,
          tokenInfo: {
            hasAccessToken: !!oauthToken.accessToken,
            tokenType: oauthToken.tokenType,
            scope: oauthToken.scope,
          },
        }, { status: testResponse.status });
      }
    } catch (testError) {
      return NextResponse.json({
        valid: false,
        error: 'Failed to test token',
        errorMessage: testError instanceof Error ? testError.message : String(testError),
        locationId,
      }, { status: 500 });
    }
  } catch (error) {
    console.error('[Test Token] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      valid: false,
    }, { status: 500 });
  }
}

