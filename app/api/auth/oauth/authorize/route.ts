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

    // Get locationId from query params if provided (for specific location installation)
    const locationId = request.nextUrl.searchParams.get('locationId');
    
    // GHL OAuth authorization URL
    const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'locations.read contacts.write contacts.read calendars.read calendars.write');
    
    // If locationId is provided, add it to state so we can track it
    if (locationId) {
      authUrl.searchParams.set('state', JSON.stringify({ locationId }));
    }

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

