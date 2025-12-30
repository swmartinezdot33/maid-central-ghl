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

    // Extract version_id from client_id (format: version_id-suffix)
    // Example: 694f40a92c718edc6f886e52-mjnoq3mf -> version_id = 694f40a92c718edc6f886e52
    const versionId = clientId.includes('-') ? clientId.split('-')[0] : clientId;

    // Get locationId from query params (optional - GHL will provide it after location selection)
    const locationId = request.nextUrl.searchParams.get('locationId');
    
    // Log OAuth initiation for debugging
    console.log('[OAuth Authorize] ============================================');
    console.log('[OAuth Authorize] Initiating OAuth flow');
    console.log('[OAuth Authorize] Client ID:', clientId ? `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 4)}` : 'MISSING');
    console.log('[OAuth Authorize] Redirect URI:', redirectUri);
    console.log('[OAuth Authorize] Base URL:', baseUrl);
    console.log('[OAuth Authorize] Location ID (hint):', locationId || 'none');
    console.log('[OAuth Authorize] Environment check:');
    console.log('[OAuth Authorize]   - APP_BASE_URL:', process.env.APP_BASE_URL || 'NOT SET');
    console.log('[OAuth Authorize]   - GHL_REDIRECT_URI:', process.env.GHL_REDIRECT_URI || 'NOT SET (using computed)');
    console.log('[OAuth Authorize] ============================================');
    
    // GHL OAuth authorization URL
    // Use chooselocation endpoint to force location selection
    const authUrl = new URL('https://marketplace.gohighlevel.com/oauth/chooselocation');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    // CRITICAL: version_id is required for marketplace apps
    authUrl.searchParams.set('version_id', versionId);
    // Force re-authorization even if app is already installed
    // This ensures we get a fresh token and the callback is called
    authUrl.searchParams.set('prompt', 'consent');
    
    // Scopes must match exactly what's configured in GHL Marketplace app settings
    // Based on GHL Marketplace settings, using readonly variants and full scope list
    // GHL expects scopes joined with + signs, not spaces
    // This matches the format shown in GHL Marketplace install link
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
    ].join('+'); // Use + instead of space to match GHL format
    authUrl.searchParams.set('scope', scopes);
    
    console.log('[OAuth Authorize] OAuth URL Parameters:');
    console.log('[OAuth Authorize]   - response_type: code');
    console.log('[OAuth Authorize]   - client_id:', clientId ? `${clientId.substring(0, 10)}...` : 'MISSING');
    console.log('[OAuth Authorize]   - version_id:', versionId);
    console.log('[OAuth Authorize]   - redirect_uri:', redirectUri);
    console.log('[OAuth Authorize]   - scope:', scopes);
    
    // Store locationId in state (if provided) so we can use it as a hint
    // Note: We don't store returnUrl because OAuth is always installed via marketplace or direct link
    // The callback will redirect to the setup page or GHL dashboard
    const stateData: { locationId?: string } = {};
    if (locationId) {
      stateData.locationId = locationId;
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
      console.error('[OAuth Authorize] ⚠️  WARNING: Redirect URI does not contain /api/auth/oauth/callback');
      console.error('[OAuth Authorize] Make sure GHL_REDIRECT_URI matches your GHL marketplace app settings');
    }
    
    // Check for common issues
    const expectedRedirectUri = 'https://maidcentral.vercel.app/api/auth/oauth/callback';
    if (redirectUri !== expectedRedirectUri) {
      console.warn('[OAuth Authorize] ⚠️  Redirect URI mismatch!');
      console.warn('[OAuth Authorize] Expected:', expectedRedirectUri);
      console.warn('[OAuth Authorize] Actual:', redirectUri);
      console.warn('[OAuth Authorize] This will cause OAuth to fail with invalid_request error');
    }
    
    console.log('[OAuth Authorize] Final OAuth URL (client_id hidden):', finalAuthUrl.replace(clientId, 'CLIENT_ID_HIDDEN'));
    console.log('[OAuth Authorize] Redirecting to GHL OAuth...');
    
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

