import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

/**
 * GET /api/auth/oauth/test
 * Test endpoint to verify OAuth callback URL is accessible
 */
export async function GET(request: NextRequest) {
  const redirectUri = process.env.GHL_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:3001'}/api/auth/oauth/callback`;
  
  return NextResponse.json({
    message: 'OAuth test endpoint is accessible',
    redirectUri,
    expectedCallbackUrl: redirectUri,
    currentUrl: request.url,
    timestamp: new Date().toISOString(),
    instructions: 'If you can see this, your callback URL is accessible. Make sure this exact URL matches what you configured in GHL Marketplace.',
  });
}




