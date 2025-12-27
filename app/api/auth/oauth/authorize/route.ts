import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/authorize
 * Initiates OAuth flow for marketplace app installation
 */
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GHL_CLIENT_ID;
    const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3001';

    if (!clientId) {
      return NextResponse.json(
        { error: 'GHL_CLIENT_ID is not configured' },
        { status: 500 }
      );
    }

    // Get locationId and returnUrl from query params
    const locationId = request.nextUrl.searchParams.get('locationId');
    const returnUrl = request.nextUrl.searchParams.get('returnUrl') || 
                     request.headers.get('referer') || // Try to get from referer
                     null;
    
    // Log OAuth initiation for debugging
    console.log('[OAuth Authorize] Initiating OAuth flow:', {
      clientId: clientId ? `${clientId.substring(0, 10)}...` : 'missing',
      redirectUri,
      locationId,
      returnUrl,
      baseUrl,
    });
    
    // GHL OAuth authorization URL
    // Use chooselocation endpoint to force location selection
    const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'locations.read contacts.write contacts.read calendars.read calendars.write');
    
    // Store locationId and returnUrl in state so we can retrieve them after OAuth
    // Use a simple format that GHL can handle
    const stateData: { locationId?: string; returnUrl?: string } = {};
    if (locationId) {
      stateData.locationId = locationId;
    }
    if (returnUrl) {
      stateData.returnUrl = returnUrl;
    }
    
    // Encode state as base64 to avoid URL encoding issues
    if (Object.keys(stateData).length > 0) {
      try {
        const stateString = JSON.stringify(stateData);
        const stateBase64 = Buffer.from(stateString).toString('base64');
        authUrl.searchParams.set('state', stateBase64);
      } catch (e) {
        // Fallback to JSON string if base64 encoding fails
        console.warn('[OAuth Authorize] Failed to encode state as base64, using JSON string:', e);
        authUrl.searchParams.set('state', JSON.stringify(stateData));
      }
    }
    
    // Note: GHL's chooselocation endpoint should automatically show location selection
    // If it's not showing, it might be because:
    // 1. User only has one location (auto-selected)
    // 2. Redirect URI mismatch
    // 3. App distribution settings in GHL marketplace

    const finalAuthUrl = authUrl.toString();
    console.log('[OAuth Authorize] Redirecting to:', finalAuthUrl.replace(clientId, 'CLIENT_ID_HIDDEN'));
    console.log('[OAuth Authorize] Full redirect URI:', redirectUri);
    console.log('[OAuth Authorize] State data:', stateData);
    
    // Verify redirect URI matches what's configured in GHL marketplace
    // This is critical - any mismatch will cause OAuth to fail silently
    if (!redirectUri.includes('/api/auth/oauth/callback')) {
      console.error('[OAuth Authorize] WARNING: Redirect URI does not contain /api/auth/oauth/callback');
      console.error('[OAuth Authorize] Make sure GHL_REDIRECT_URI matches your GHL marketplace app settings');
    }
    
    // Redirect to GHL OAuth
    return NextResponse.redirect(finalAuthUrl);
  } catch (error) {
    console.error('Error initiating GHL OAuth:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}

