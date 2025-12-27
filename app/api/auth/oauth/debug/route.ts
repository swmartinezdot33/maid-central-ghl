import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/debug
 * Diagnostic endpoint to check OAuth configuration
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.GHL_CLIENT_ID;
  const clientSecret = process.env.GHL_CLIENT_SECRET;
  const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3001';
  const ssoKey = process.env.GHL_APP_SSO_KEY;

  const config = {
    clientId: clientId ? `${clientId.substring(0, 10)}...${clientId.substring(clientId.length - 4)}` : 'NOT SET',
    clientSecret: clientSecret ? '***SET***' : 'NOT SET',
    redirectUri,
    appBaseUrl,
    ssoKey: ssoKey ? '***SET***' : 'NOT SET',
    expectedRedirectUri: 'https://maidcentral.vercel.app/api/auth/oauth/callback',
    redirectUriMatches: redirectUri === 'https://maidcentral.vercel.app/api/auth/oauth/callback',
    issues: [] as string[],
  };

  // Check for common issues
  if (!clientId) {
    config.issues.push('GHL_CLIENT_ID is not set');
  }
  if (!clientSecret) {
    config.issues.push('GHL_CLIENT_SECRET is not set');
  }
  if (!config.redirectUriMatches) {
    config.issues.push(`Redirect URI mismatch! Expected: ${config.expectedRedirectUri}, Got: ${redirectUri}`);
  }
  if (!ssoKey) {
    config.issues.push('GHL_APP_SSO_KEY is not set (needed for postMessage decryption)');
  }

  return NextResponse.json({
    ...config,
    status: config.issues.length === 0 ? 'ok' : 'has_issues',
    message: config.issues.length === 0 
      ? 'OAuth configuration looks good!' 
      : `Found ${config.issues.length} issue(s): ${config.issues.join(', ')}`,
  });
}

