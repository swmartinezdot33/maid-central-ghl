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
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      console.error('[OAuth Callback] No authorization code received. All params:', allParams);
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=no_code&debug=${encodeURIComponent(JSON.stringify(allParams))}`
      );
    }

    const clientId = process.env.GHL_CLIENT_ID;
    const clientSecret = process.env.GHL_CLIENT_SECRET;
    const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;

    if (!clientId || !clientSecret) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=oauth_not_configured`
      );
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
      console.error('Token exchange error:', errorData);
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=${encodeURIComponent(errorData.error || 'token_exchange_failed')}`
      );
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
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=no_location_id&debug=${encodeURIComponent(JSON.stringify({ code: !!code, state, tokenKeys: Object.keys(tokenData || {}) }))}`
      );
    }

    console.log('[OAuth Callback] Using locationId:', finalLocationId);

    // Parse state to get returnUrl if it was stored
    let returnUrl: string | null = null;
    if (state) {
      try {
        // Try to decode base64 first (if we encoded it that way)
        let stateData;
        try {
          const decoded = Buffer.from(state, 'base64').toString('utf-8');
          stateData = JSON.parse(decoded);
        } catch {
          // If base64 decode fails, try direct JSON parse
          stateData = JSON.parse(state);
        }
        returnUrl = stateData.returnUrl || null;
        console.log('[OAuth Callback] Found returnUrl in state:', returnUrl);
      } catch (e) {
        // State might not be JSON, that's okay
        console.log('[OAuth Callback] State is not JSON, ignoring:', state);
      }
    }

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

    await storeGHLOAuthToken(oauthToken);

    // Create or update integration config for this location
    let config = await getIntegrationConfig(finalLocationId);
    if (!config) {
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
      config.ghlLocationId = finalLocationId;
    }
    await storeIntegrationConfig(config, finalLocationId);

    // Determine redirect URL
    // Priority: returnUrl from state > construct GHL dashboard URL > fallback to setup page
    let redirectUrl: string;
    
    if (returnUrl) {
      // Redirect back to the original GHL custom menu link
      redirectUrl = returnUrl;
      console.log('[OAuth Callback] Redirecting back to returnUrl:', returnUrl);
    } else {
      // Construct a generic GHL dashboard URL with the app
      // Format: https://app.gohighlevel.com/location/{locationId}/apps
      // Or try to use the location's custom domain if available
      redirectUrl = `https://app.gohighlevel.com/location/${finalLocationId}/apps`;
      console.log('[OAuth Callback] No returnUrl found, redirecting to GHL dashboard:', redirectUrl);
    }

    // Redirect back to GHL (either custom menu link or dashboard)
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=${encodeURIComponent(error instanceof Error ? error.message : 'oauth_callback_failed')}`
    );
  }
}

