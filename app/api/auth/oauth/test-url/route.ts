import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/test-url
 * Returns the exact OAuth URL that will be used (for verification)
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GHL_CLIENT_ID;
  const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;
  
  if (!clientId) {
    return NextResponse.json({
      error: 'GHL_CLIENT_ID is not configured',
      redirectUri,
    });
  }

  // Build the exact OAuth URL that will be used
  const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('scope', 'locations.read contacts.write contacts.read calendars.read calendars.write');

  return NextResponse.json({
    oauthUrl: authUrl.toString(),
    parameters: {
      response_type: 'code',
      client_id: `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 4)}`,
      redirect_uri: redirectUri,
      scope: 'locations.read contacts.write contacts.read calendars.read calendars.write',
    },
    instructions: {
      step1: 'Copy the redirect_uri value above',
      step2: 'Go to your GHL Marketplace app settings',
      step3: 'Verify the Redirect URI is EXACTLY: ' + redirectUri,
      step4: 'It must match character-for-character (no trailing slash, exact path)',
      step5: 'If it doesn\'t match, update it in GHL Marketplace and try again',
    },
    verification: {
      redirectUriMatches: redirectUri === 'https://maidcentral.vercel.app/api/auth/oauth/callback',
      expectedRedirectUri: 'https://maidcentral.vercel.app/api/auth/oauth/callback',
      actualRedirectUri: redirectUri,
    },
  });
}

