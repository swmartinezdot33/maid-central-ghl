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

  // Extract version_id from client_id (format: version_id-suffix)
  const versionId = clientId.includes('-') ? clientId.split('-')[0] : clientId;

  // Build the exact OAuth URL that will be used
  const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('version_id', versionId);
  // GHL expects scopes joined with + signs, not spaces
  // GHL uses .read/.write format, not .readonly/.write
  const scopes = [
    'locations.read',
    'contacts.read',
    'contacts.write',
    'calendars.read',
    'calendars.write',
    'calendars/events.read',
    'calendars/events.write',
    'calendars/groups.read',
    'calendars/resources.write',
    'calendars/groups.write',
    'calendars/resources.read',
    'opportunities.read',
    'opportunities.write'
  ].join('+'); // Use + instead of space to match GHL format
  authUrl.searchParams.set('scope', scopes);

  const generatedUrl = authUrl.toString();
  
  // Expected URL from GHL Marketplace (for comparison)
  const expectedUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&version_id=${versionId}`;
  
  return NextResponse.json({
    generatedUrl,
    expectedUrl,
    urlsMatch: generatedUrl === expectedUrl,
    parameters: {
      response_type: 'code',
      client_id: clientId,
      version_id: versionId,
      redirect_uri: redirectUri,
      scope: scopes,
      scopeEncoded: encodeURIComponent(scopes),
    },
    comparison: {
      generatedUrlLength: generatedUrl.length,
      expectedUrlLength: expectedUrl.length,
      differences: generatedUrl !== expectedUrl ? 'URLs do not match exactly' : 'URLs match',
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

