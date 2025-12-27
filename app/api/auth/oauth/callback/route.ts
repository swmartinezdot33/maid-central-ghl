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
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const locationId = request.nextUrl.searchParams.get('locationId');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('OAuth error:', error);
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=no_code`
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
    
    // Get location ID from token response or state
    const finalLocationId = locationId || 
                           tokenData.locationId || 
                           (state ? JSON.parse(state).locationId : null);

    if (!finalLocationId) {
      return NextResponse.redirect(
        `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=no_location_id`
      );
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

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?success=oauth_installed&locationId=${finalLocationId}`
    );
  } catch (error) {
    console.error('Error in OAuth callback:', error);
    return NextResponse.redirect(
      `${process.env.APP_BASE_URL || 'http://localhost:3001'}/setup?error=${encodeURIComponent(error instanceof Error ? error.message : 'oauth_callback_failed')}`
    );
  }
}

