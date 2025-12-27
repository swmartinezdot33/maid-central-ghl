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
      console.error('[OAuth Callback] OAuth error from GHL:', error);
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', error);
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
    const tokenResponse = await fetch('https://services.leadconnectorhq.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
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

    // If still no locationId, check if it's in the token response body
    if (!finalLocationId && tokenData) {
      console.log('[OAuth Callback] Searching token response for locationId. Full response:', JSON.stringify(tokenData, null, 2));
    }

    if (!finalLocationId) {
      console.error('[OAuth Callback] No locationId found. Code:', code, 'State:', state, 'Token data:', tokenData);
      const errorUrl = new URL('/oauth-success', process.env.APP_BASE_URL || 'http://localhost:3001');
      errorUrl.searchParams.set('error', `no_location_id: ${JSON.stringify({ code: !!code, state, tokenKeys: Object.keys(tokenData || {}) })}`);
      return NextResponse.redirect(errorUrl.toString());
    }

    console.log('[OAuth Callback] Using locationId:', finalLocationId);

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
    await storeGHLOAuthToken(oauthToken);
    console.log('[OAuth Callback] ✅ OAuth token stored successfully');

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

