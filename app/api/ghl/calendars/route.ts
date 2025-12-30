import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { ghlAPI } from '@/lib/ghl';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    console.log(`[Calendars API] Fetching calendars for location: ${locationId}`);
    
    // First, verify the OAuth token exists and is valid
    try {
      const { getGHLOAuthToken } = await import('@/lib/db');
      const oauthToken = await getGHLOAuthToken(locationId);
      
      if (!oauthToken || !oauthToken.accessToken) {
        console.error('[Calendars API] No OAuth token found for location:', locationId);
        return NextResponse.json(
          { 
            error: 'GHL OAuth not configured for this location. Please install the app via OAuth.',
            calendars: [],
          },
          { status: 401 }
        );
      }
      
      // Validate token format
      const tokenParts = oauthToken.accessToken.split('.');
      if (tokenParts.length !== 3) {
        console.error('[Calendars API] Token is not a valid JWT format:', {
          parts: tokenParts.length,
          tokenLength: oauthToken.accessToken.length,
        });
        return NextResponse.json(
          { 
            error: 'Invalid OAuth token format. Please reinstall the app via OAuth.',
            calendars: [],
          },
          { status: 401 }
        );
      }
      
      console.log('[Calendars API] OAuth token found and validated:', {
        hasToken: true,
        tokenLength: oauthToken.accessToken.length,
        tokenPrefix: oauthToken.accessToken.substring(0, 30) + '...',
        isJWT: true,
      });
    } catch (tokenCheckError) {
      console.error('[Calendars API] Error checking OAuth token:', tokenCheckError);
      return NextResponse.json(
        { 
          error: 'Failed to verify OAuth token. Please reinstall the app via OAuth.',
          calendars: [],
        },
        { status: 500 }
      );
    }
    
    try {
      const calendars = await ghlAPI.getCalendars(locationId);
      
      console.log(`[Calendars API] Received ${calendars.length} calendars from GHL API`);
      
      if (calendars.length === 0) {
        console.warn('[Calendars API] Empty calendar array returned. This could mean:');
        console.warn('[Calendars API] 1. No calendars exist in the GHL location');
        console.warn('[Calendars API] 2. The API endpoint structure is different');
        console.warn('[Calendars API] 3. Check the GHL API logs above for errors');
      }
      
      return NextResponse.json({ 
        calendars: calendars.map((cal: any) => ({
          id: cal.id || cal.calendarId || cal._id,
          name: cal.name || cal.title || cal.calendarName || 'Unnamed Calendar',
          description: cal.description || cal.desc,
          timezone: cal.timezone || cal.timeZone,
          color: cal.color || cal.colour,
        })),
      });
    } catch (apiError) {
      console.error('[Calendars API] ============================================');
      console.error('[Calendars API] Error calling GHL API:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      
      // Check if it's an axios error with response data
      let ghlErrorDetails: any = null;
      if (apiError && typeof apiError === 'object' && 'response' in apiError) {
        const axiosError = apiError as any;
        ghlErrorDetails = {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          headers: axiosError.response?.headers,
          url: axiosError.config?.url,
          method: axiosError.config?.method,
        };
        console.error('[Calendars API] GHL API Error Response:', ghlErrorDetails);
      }
      
      console.error('[Calendars API] Error details:', {
        message: errorMessage,
        name: apiError instanceof Error ? apiError.name : undefined,
        stack: apiError instanceof Error ? apiError.stack : undefined,
        ghlErrorDetails,
      });
      console.error('[Calendars API] ============================================');
      
      // Return appropriate status code based on error type
      const statusCode = ghlErrorDetails?.status === 401 || ghlErrorDetails?.status === 403 ? 401 : 500;
      
      return NextResponse.json(
        { 
          error: `Failed to fetch calendars from GHL: ${errorMessage}`,
          calendars: [],
          details: {
            message: apiError instanceof Error ? apiError.message : String(apiError),
            name: apiError instanceof Error ? apiError.name : undefined,
            ghlError: ghlErrorDetails,
          },
        },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error('[Calendars API] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Failed to fetch calendars',
        calendars: [],
      },
      { status: 500 }
    );
  }
}

