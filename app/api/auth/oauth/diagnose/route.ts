import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getGHLOAuthToken } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

/**
 * GET /api/auth/oauth/diagnose
 * Diagnoses OAuth token issues by checking format, expiration, and making a test API call
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
    
    console.log('[OAuth Diagnose] Diagnosing token for locationId:', locationId);
    
    // Get stored token
    const oauthToken = await getGHLOAuthToken(locationId);
    
    if (!oauthToken || !oauthToken.accessToken) {
      return NextResponse.json({
        hasToken: false,
        error: 'No OAuth token found in database',
        locationId,
        recommendation: 'Install the app via OAuth',
      });
    }
    
    // Analyze token format
    const tokenParts = oauthToken.accessToken.split('.');
    const isJWT = tokenParts.length === 3;
    
    // Check expiration
    let expiresAt: number | null = null;
    let isExpired = false;
    if (oauthToken.expiresAt) {
      expiresAt = typeof oauthToken.expiresAt === 'string' 
        ? parseInt(oauthToken.expiresAt) 
        : oauthToken.expiresAt;
      isExpired = Date.now() >= expiresAt;
    }
    
    // Try to decode JWT header (first part) to see if it's valid
    let jwtHeader: any = null;
    let jwtPayload: any = null;
    if (isJWT) {
      try {
        jwtHeader = JSON.parse(Buffer.from(tokenParts[0], 'base64url').toString());
        jwtPayload = JSON.parse(Buffer.from(tokenParts[1], 'base64url').toString());
      } catch (e) {
        // Not a valid base64 JWT
      }
    }
    
    // Test the token by making an actual API call
    let apiTestResult: any = null;
    try {
      const testResponse = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${oauthToken.accessToken}`,
          'Version': '2021-07-28',
          'Content-Type': 'application/json',
        },
      });
      
      apiTestResult = {
        status: testResponse.status,
        ok: testResponse.ok,
        statusText: testResponse.statusText,
      };
      
      if (!testResponse.ok) {
        const errorData = await testResponse.json().catch(() => ({ error: 'Unknown error' }));
        apiTestResult.error = errorData;
      } else {
        const locationData = await testResponse.json();
        apiTestResult.locationName = locationData?.location?.name || locationData?.name || 'Unknown';
      }
    } catch (testError) {
      apiTestResult = {
        error: testError instanceof Error ? testError.message : String(testError),
      };
    }
    
    return NextResponse.json({
      locationId,
      hasToken: true,
      tokenAnalysis: {
        isJWT,
        tokenParts: tokenParts.length,
        tokenLength: oauthToken.accessToken.length,
        tokenPrefix: oauthToken.accessToken.substring(0, 30) + '...',
        tokenSuffix: '...' + oauthToken.accessToken.substring(oauthToken.accessToken.length - 20),
        jwtHeader,
        jwtPayload: jwtPayload ? {
          ...jwtPayload,
          // Don't expose sensitive payload data, just show structure
          hasExp: 'exp' in jwtPayload,
          hasIat: 'iat' in jwtPayload,
          hasSub: 'sub' in jwtPayload,
        } : null,
      },
      expiration: {
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        now: new Date().toISOString(),
        isExpired,
        hasExpiration: !!expiresAt,
      },
      tokenInfo: {
        hasRefreshToken: !!oauthToken.refreshToken,
        tokenType: oauthToken.tokenType,
        scope: oauthToken.scope,
        userId: oauthToken.userId,
        companyId: oauthToken.companyId,
        installedAt: oauthToken.installedAt ? new Date(oauthToken.installedAt).toISOString() : null,
      },
      apiTest: apiTestResult,
      recommendation: !isJWT 
        ? 'Token is not a valid JWT format. Clear and reinstall via OAuth.'
        : isExpired
        ? 'Token is expired. Clear and reinstall via OAuth, or implement token refresh.'
        : !apiTestResult?.ok
        ? `Token exists but API call failed (${apiTestResult?.status}). Clear and reinstall via OAuth.`
        : 'Token appears to be valid and working.',
    });
  } catch (error) {
    console.error('[OAuth Diagnose] Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      locationId,
    }, { status: 500 });
  }
}

