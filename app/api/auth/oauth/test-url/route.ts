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
  // GHL expects scopes joined with + signs, not spaces
  // Using .readonly format as configured in GHL Marketplace app
  const scopes = [
    'locations.readonly',
    'contacts.readonly',
    'contacts.write',
    'calendars.readonly',
    'calendars.write',
    'calendars/events.readonly',
    'calendars/events.write',
    'calendars/groups.readonly',
    'calendars/resources.write',
    'calendars/groups.write',
    'calendars/resources.readonly',
    'opportunities.readonly',
    'opportunities.write'
  ];
  
  // Encode each scope individually (to handle / characters) then join with + signs
  const encodedScopes = scopes.map(scope => encodeURIComponent(scope)).join('+');
  
  // Build URL manually to preserve + signs in scope parameter
  const baseUrl = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
  const params = new URLSearchParams();
  params.set('response_type', 'code');
  params.set('client_id', clientId);
  params.set('redirect_uri', redirectUri);
  params.set('version_id', versionId);
  params.set('prompt', 'consent');
  
  // Build final URL with scope parameter manually added (with + signs preserved)
  const generatedUrl = `${baseUrl}?${params.toString()}&scope=${encodedScopes}`;
  
  // Expected URL from GHL Marketplace (for comparison)
  const expectedUrl = `https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&client_id=${clientId}&scope=${encodedScopes}&version_id=${versionId}`;
  
  return NextResponse.json({
    generatedUrl,
    expectedUrl,
    urlsMatch: generatedUrl === expectedUrl,
    parameters: {
      response_type: 'code',
      client_id: clientId,
      version_id: versionId,
      redirect_uri: redirectUri,
      scope: scopes.join('+'),
      scopeEncoded: encodedScopes,
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

