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
    // Note: GHL tokens might still work even if timestamp suggests expiration
    // We'll be lenient here - only mark as expired if timestamp is clearly past
    // and there's a significant buffer (5 minutes) to account for clock skew
    let isExpired = false;
    if (oauthToken?.expiresAt) {
      const now = Date.now();
      const expiresAt = typeof oauthToken.expiresAt === 'string' 
        ? parseInt(oauthToken.expiresAt, 10) 
        : oauthToken.expiresAt;
      // Add 5 minute buffer - if token expires in less than 5 minutes, consider it expired
      // This accounts for clock skew and gives a safety margin
      isExpired = now >= (expiresAt - (5 * 60 * 1000));
      console.log('[OAuth Status] Expiration check:', {
        now,
        expiresAt,
        expiresAtDate: new Date(expiresAt).toISOString(),
        nowDate: new Date(now).toISOString(),
        isExpired,
        bufferMinutes: 5,
      });
    }

    // OAuth is installed if we have a token with an access token
    // Expiration is checked separately - expired tokens are still "installed" but need refresh
    const hasAccessToken = !!(oauthToken && oauthToken.accessToken);
    const installed = hasAccessToken; // Don't check expiration here - that's handled separately
    
    // If we have a token, test it with a lightweight API call to verify it actually works
    // Only test if timestamp suggests it might be expired (to avoid unnecessary API calls)
    // If timestamp shows it's clearly valid, trust that and skip the test
    let tokenActuallyWorks: boolean | undefined = undefined;
    if (hasAccessToken && oauthToken?.accessToken) {
      // Only test the token if timestamp suggests it might be expired
      // This avoids unnecessary API calls and network issues causing false negatives
      if (isExpired) {
        try {
          console.log('[OAuth Status] Token timestamp suggests expiration - testing with API call');
          // Make a lightweight API call to verify the token works
          const testResponse = await fetch(`https://services.leadconnectorhq.com/locations/${locationId}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${oauthToken.accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json',
            },
          });
          
          tokenActuallyWorks = testResponse.ok;
          
          if (!testResponse.ok) {
            // Log error details for debugging
            const errorText = await testResponse.text().catch(() => 'Unable to read error response');
            console.log('[OAuth Status] Token test failed:', {
              status: testResponse.status,
              statusText: testResponse.statusText,
              errorText: errorText.substring(0, 200), // Limit error text length
              locationId,
            });
          } else {
            console.log('[OAuth Status] Token test passed - token is working despite timestamp:', {
              status: testResponse.status,
              locationId,
            });
          }
          
          // If token works, override isExpired to false (token is clearly valid)
          if (tokenActuallyWorks) {
            isExpired = false;
            console.log('[OAuth Status] Token works - overriding expiration status');
          } else {
            // If token test fails, don't automatically mark as expired
            // The test endpoint might require different scopes or have other issues
            // Trust the timestamp instead - if timestamp says expired, keep it; otherwise, don't mark as expired
            // This prevents false negatives from test endpoint issues
            console.log('[OAuth Status] Token test failed, but trusting timestamp instead (test endpoint may have scope/permission issues)');
            // Don't change isExpired here - keep the timestamp-based value
          }
        } catch (testError) {
          console.warn('[OAuth Status] Token test exception (network error, etc.):', {
            error: testError instanceof Error ? testError.message : String(testError),
            locationId,
          });
          // If test throws an exception (network error, etc.), be lenient
          // If token was installed recently (within last 24 hours), assume it still works
          // Otherwise, we can't determine, so default to trusting user (don't mark as expired)
          const installedRecently = oauthToken?.installedAt && 
            (Date.now() - new Date(oauthToken.installedAt).getTime()) < (24 * 60 * 60 * 1000);
          
          if (installedRecently) {
            tokenActuallyWorks = true;
            isExpired = false;
            console.log('[OAuth Status] Token test failed but installed recently - assuming valid');
          } else {
            // Can't determine - default to not expired (trust the user)
            tokenActuallyWorks = undefined;
            isExpired = false; // Don't mark as expired if we can't verify
            console.log('[OAuth Status] Token test failed - defaulting to not expired (can\'t verify)');
          }
        }
      } else {
        // Token timestamp shows it's valid - no need to test
        // Trust the timestamp and assume token works
        tokenActuallyWorks = true;
        console.log('[OAuth Status] Token timestamp is valid - assuming token works (skipping API test)');
      }
    }

    console.log('[OAuth Status] Final status:', { 
      installed, 
      isExpired, 
      hasToken: hasAccessToken,
      hasRefreshToken: !!oauthToken?.refreshToken,
      locationId,
      tokenExists: !!oauthToken,
      tokenActuallyWorks,
    });

    return NextResponse.json({
      installed,
      locationId,
      hasToken: hasAccessToken,
      isExpired,
      tokenActuallyWorks, // Include this so UI can show accurate status
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

