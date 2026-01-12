import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { deleteGHLOAuthToken } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

/**
 * DELETE /api/auth/oauth/clear
 * Clears the OAuth token for a location (useful when token is invalid)
 */
export async function DELETE(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request) || 
                      request.nextUrl.searchParams.get('locationId');
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }
    
    console.log('[OAuth Clear] Clearing OAuth token for locationId:', locationId);
    await deleteGHLOAuthToken(locationId);
    
    return NextResponse.json({
      success: true,
      message: 'OAuth token cleared successfully. Please reinstall the app via OAuth.',
      locationId,
    });
  } catch (error) {
    console.error('[OAuth Clear] Error clearing token:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear token' },
      { status: 500 }
    );
  }
}



