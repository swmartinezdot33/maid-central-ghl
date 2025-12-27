import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeGHLOAuthToken, storeIntegrationConfig, getIntegrationConfig } from '@/lib/db';
import type { GHLOAuthToken } from '@/lib/db';

/**
 * GET /api/auth/oauth/callback
 * Handles OAuth callback and stores tokens
 */
export async function GET(request: NextRequest) {
  try {
    // Log all query parameters for debugging
    const allParams = Object.fromEntries(request.nextUrl.searchParams.entries());
    console.log('[OAuth Callback] Received callback with params:', allParams);
    
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const locationId = request.nextUrl.searchParams.get('locationId');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      const errorDescription = request.nextUrl.searchParams.get('error_description') || 'No description provided';
      const errorUri = request.nextUrl.searchParams.get('error_uri');
      const state = request.nextUrl.searchParams.get('state');
      
      console.error('[OAuth Callback] ============================================');
      console.error('[OAuth Callback] ❌ OAUTH ERROR FROM GHL');
      console.error('[OAuth Callback] Error Code:', error);
      console.error('[OAuth Callback] Error Description:', errorDescription);
      console.error('[OAuth Callback] Error URI:', errorUri);
      console.error('[OAuth Callback] State:', state);
      console.error('[OAuth Callback] All Query Params:', JSON.stringify(allParams, null, 2));
      console.error('[OAuth Callback] Client ID configured:', !!process.env.GHL_CLIENT_ID);
      console.error('[OAuth Callback] Client ID value:', process.env.GHL_CLIENT_ID ? `${process.env.GHL_CLIENT_ID.substring(0, 10)}...${process.env.GHL_CLIENT_ID.substring(process.env.GHL_CLIENT_ID.length - 4)}` : 'NOT SET');
      console.error('[OAuth Callback] Client Secret configured:', !!process.env.GHL_CLIENT_SECRET);
      console.error('[OAuth Callback] Redirect URI:', process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`);
      console.error('[OAuth Callback] APP_BASE_URL:', process.env.APP_BASE_URL || 'NOT SET');
      console.error('[OAuth Callback] ============================================');
      
      // Include full error details in the redirect
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', error);
      errorUrl.searchParams.set('error_description', errorDescription);
      if (errorUri) {
        errorUrl.searchParams.set('error_uri', errorUri);
      }
      if (state) {
        errorUrl.searchParams.set('state', state);
      }
      return NextResponse.redirect(errorUrl.toString());
    }

    if (!code) {
      console.error('[OAuth Callback] No authorization code received. All params:', allParams);
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', `no_code: ${JSON.stringify(allParams)}`);
      return NextResponse.redirect(errorUrl.toString());
    }

    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;

    if (!clientId || !clientSecret) {
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', 'oauth_not_configured');
      return NextResponse.redirect(errorUrl.toString());
    }

    // Exchange authorization code for access token
    // GHL requires application/x-www-form-urlencoded, not JSON
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });
    
    console.log('[OAuth Callback] Exchanging code for token...');
    console.log('[OAuth Callback] Token endpoint: https://services.leadconnectorhq.com/oauth/token');
    console.log('[OAuth Callback] Using form-urlencoded content type');
    
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams.toString(),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('[OAuth Callback] Token exchange error:', errorData);
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', errorData.error || 'token_exchange_failed');
      return NextResponse.redirect(errorUrl.toString());
    }

    const tokenData = await tokenResponse.json();
    console.log('[OAuth Callback] Token exchange successful. Token data keys:', Object.keys(tokenData));
    
    // Get location ID from multiple possible sources
    // GHL may return it in different places depending on the OAuth flow
    let finalLocationId = locationId || 
                        tokenData.locationId || 
                        tokenData.location_id ||
                        tokenData.location?.id ||
                        (state ? (() => {
                          try {
                            // Try to decode base64 first (if we encoded it that way)
                            let parsed;
                            try {
                              const decoded = Buffer.from(state, 'base64').toString('utf-8');
                              parsed = JSON.parse(decoded);
                            } catch {
                              // If base64 decode fails, try direct JSON parse
                              parsed = JSON.parse(state);
                            }
                            return parsed.locationId || parsed.location_id;
                          } catch {
                            // If state is not JSON, it might just be the locationId
                            return state.length > 20 ? null : state; // Only use if it looks like an ID
                          }
                        })() : null);

    // If still no locationId, use the access token to fetch locations from GHL API
    if (!finalLocationId) {
      console.log('[OAuth Callback] No locationId in response, fetching from GHL API...');
      console.log('[OAuth Callback] Token data keys:', Object.keys(tokenData || {}));
      console.log('[OAuth Callback] Full token response:', JSON.stringify(tokenData, null, 2));
      
      try {
        // Use the access token to get locations
        const accessToken = tokenData.access_token;
        if (accessToken) {
          console.log('[OAuth Callback] Making API call to get locations...');
          const locationsResponse = await fetch('https://services.leadconnectorhq.com/locations/', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Version': '2021-07-28',
              'Content-Type': 'application/json',
            },
          });

          if (locationsResponse.ok) {
            const locationsData = await locationsResponse.json();
            console.log('[OAuth Callback] Locations API response:', JSON.stringify(locationsData, null, 2));
            
            // Try to extract locationId from locations response
            // GHL may return locations in different formats
            if (locationsData.locations && Array.isArray(locationsData.locations) && locationsData.locations.length > 0) {
              finalLocationId = locationsData.locations[0].id || locationsData.locations[0].locationId;
              console.log('[OAuth Callback] Found locationId from locations API:', finalLocationId);
            } else if (locationsData.location && locationsData.location.id) {
              finalLocationId = locationsData.location.id;
              console.log('[OAuth Callback] Found locationId from location object:', finalLocationId);
            } else if (locationsData.id) {
              finalLocationId = locationsData.id;
              console.log('[OAuth Callback] Found locationId from direct response:', finalLocationId);
            } else if (Array.isArray(locationsData) && locationsData.length > 0) {
              finalLocationId = locationsData[0].id || locationsData[0].locationId;
              console.log('[OAuth Callback] Found locationId from array response:', finalLocationId);
            }
          } else {
            const errorText = await locationsResponse.text();
            console.error('[OAuth Callback] Failed to fetch locations:', locationsResponse.status, errorText);
          }
        }
      } catch (apiError) {
        console.error('[OAuth Callback] Error fetching locations from API:', apiError);
      }
    }

    if (!finalLocationId) {
      console.error('[OAuth Callback] No locationId found after all attempts. Code:', code, 'State:', state);
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', `no_location_id: Unable to determine location ID from OAuth response or API call`);
      return NextResponse.redirect(errorUrl.toString());
    }

    console.log('[OAuth Callback] ✅ Using locationId:', finalLocationId);

    // Note: We don't use returnUrl anymore because OAuth is always installed via marketplace or direct link
    // The callback will redirect to the setup page to complete configuration

    // Store OAuth token
    const oauthToken: GHLOAuthToken = {
      locationId: finalLocationId,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: tokenData.expires_in ? Date.now() + (tokenData.expires_in * 1000) : undefined,
      tokenType: tokenData.token_type || 'Bearer',
      scope: tokenData.scope,
      userId: tokenData.userId,
      companyId: tokenData.companyId,
      installedAt: new Date(),
    };

    console.log('[OAuth Callback] Storing OAuth token for locationId:', finalLocationId);
    console.log('[OAuth Callback] Token data to store:', {
      locationId: oauthToken.locationId,
      hasAccessToken: !!oauthToken.accessToken,
      accessTokenLength: oauthToken.accessToken?.length,
      hasRefreshToken: !!oauthToken.refreshToken,
      expiresAt: oauthToken.expiresAt ? new Date(oauthToken.expiresAt).toISOString() : 'never',
      tokenType: oauthToken.tokenType,
      scope: oauthToken.scope,
      userId: oauthToken.userId,
      companyId: oauthToken.companyId,
    });
    
    try {
      await storeGHLOAuthToken(oauthToken);
      console.log('[OAuth Callback] ✅ OAuth token stored successfully');
      
      // Verify the token was stored correctly
      const { getGHLOAuthToken } = await import('@/lib/db');
      const storedToken = await getGHLOAuthToken(finalLocationId);
      if (storedToken && storedToken.accessToken) {
        console.log('[OAuth Callback] ✅ Verification: Token retrieved successfully from database');
        console.log('[OAuth Callback] Stored token locationId:', storedToken.locationId);
        console.log('[OAuth Callback] Stored token has access token:', !!storedToken.accessToken);
        console.log('[OAuth Callback] Stored token access token length:', storedToken.accessToken.length);
      } else {
        console.error('[OAuth Callback] ❌ Verification FAILED: Token not found in database after storage!');
        console.error('[OAuth Callback] Stored token result:', storedToken);
        throw new Error('Token storage verification failed - token not found after storage');
      }
    } catch (storageError) {
      console.error('[OAuth Callback] ❌ Error storing OAuth token:', storageError);
      console.error('[OAuth Callback] Storage error details:', {
        error: storageError instanceof Error ? storageError.message : String(storageError),
        stack: storageError instanceof Error ? storageError.stack : undefined,
      });
      throw storageError; // Re-throw to be caught by outer try-catch
    }

    // Create or update integration config for this location
    let config = await getIntegrationConfig(finalLocationId);
    if (!config) {
      console.log('[OAuth Callback] Creating new integration config for locationId:', finalLocationId);
      config = {
        ghlLocationId: finalLocationId,
        fieldMappings: [],
        enabled: false,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
        syncAppointments: false,
        appointmentSyncInterval: 15,
        appointmentConflictResolution: 'timestamp',
      };
    } else {
      console.log('[OAuth Callback] Updating existing integration config');
      config.ghlLocationId = finalLocationId;
    }
    await storeIntegrationConfig(config, finalLocationId);
    console.log('[OAuth Callback] ✅ Integration config stored successfully');

    console.log('[OAuth Callback] ============================================');
    console.log('[OAuth Callback] ✅ OAuth INSTALLATION SUCCESSFUL!');
    console.log('[OAuth Callback] Location ID:', finalLocationId);
    console.log('[OAuth Callback] Token Information:');
    console.log('[OAuth Callback]   - Has Access Token:', !!oauthToken.accessToken);
    console.log('[OAuth Callback]   - Has Refresh Token:', !!oauthToken.refreshToken);
    console.log('[OAuth Callback]   - Token Type:', oauthToken.tokenType);
    console.log('[OAuth Callback]   - Expires At:', oauthToken.expiresAt ? new Date(oauthToken.expiresAt).toISOString() : 'Never');
    console.log('[OAuth Callback]   - Scope:', oauthToken.scope);
    console.log('[OAuth Callback]   - User ID:', oauthToken.userId);
    console.log('[OAuth Callback]   - Company ID:', oauthToken.companyId);
    console.log('[OAuth Callback]   - Installed At:', oauthToken.installedAt.toISOString());
    console.log('[OAuth Callback] ============================================');

    // Redirect to success page (not setup page, since setup requires iframe context)
    // The success page is a simple standalone page that doesn't need iframe context
    const successUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
    successUrl.searchParams.set('success', 'oauth_installed');
    successUrl.searchParams.set('locationId', finalLocationId);
    
    console.log('[OAuth Callback] Redirecting to success page:', successUrl.toString());
    
    return NextResponse.redirect(successUrl.toString());
  } catch (error) {
    console.error('[OAuth Callback] Error in OAuth callback:', error);
    const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
    errorUrl.searchParams.set('error', error instanceof Error ? error.message : 'oauth_callback_failed');
    return NextResponse.redirect(errorUrl.toString());
  }
}

