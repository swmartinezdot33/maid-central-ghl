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
    const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'locations.read contacts.write contacts.read calendars.read calendars.write');
    
    // Store locationId and returnUrl in state so we can retrieve them after OAuth
    const stateData: { locationId?: string; returnUrl?: string } = {};
    if (locationId) {
      stateData.locationId = locationId;
    }
    if (returnUrl) {
      stateData.returnUrl = returnUrl;
    }
    
    if (Object.keys(stateData).length > 0) {
      authUrl.searchParams.set('state', JSON.stringify(stateData));
    }

    console.log('[OAuth Authorize] Redirecting to:', authUrl.toString().replace(clientId, 'CLIENT_ID_HIDDEN'));
    
    // Redirect to GHL OAuth
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error('Error initiating GHL OAuth:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}

