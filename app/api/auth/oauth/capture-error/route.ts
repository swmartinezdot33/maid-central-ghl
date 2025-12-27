import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/capture-error
 * Captures and displays all OAuth error details for debugging
 */
export async function GET(request: NextRequest) {
  const allParams = Object.fromEntries(request.nextUrl.searchParams.entries());
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    allQueryParams: allParams,
    error: allParams.error,
    errorDescription: allParams.error_description,
    errorUri: allParams.error_uri,
    state: allParams.state,
    code: allParams.code,
    analysis: {
      hasError: !!allParams.error,
      hasCode: !!allParams.code,
      errorType: allParams.error || 'none',
      possibleCauses: allParams.error === 'invalid_request' ? [
        'Redirect URI mismatch (even a single character difference)',
        'Scope format mismatch (must use + between scopes, not spaces)',
        'Client ID mismatch',
        'Missing required parameter',
        'Invalid parameter encoding'
      ] : [],
    },
    environment: {
      clientId: process.env.GHL_CLIENT_ID ? `${process.env.GHL_CLIENT_ID.substring(0, 10)}...${process.env.GHL_CLIENT_ID.substring(process.env.GHL_CLIENT_ID.length - 4)}` : 'NOT SET',
      redirectUri: process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`,
      appBaseUrl: process.env.APP_BASE_URL || 'NOT SET',
    },
  }, { status: 200 });
}

