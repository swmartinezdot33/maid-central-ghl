import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const config = await getIntegrationConfig();
    
    if (!config?.ghlLocationId) {
      return NextResponse.json(
        { error: 'GHL Location ID not configured. Please configure your GHL connection first.' },
        { status: 400 }
      );
    }

    console.log(`[Calendars API] Fetching calendars for location: ${config.ghlLocationId}`);
    
    try {
      const calendars = await ghlAPI.getCalendars(config.ghlLocationId);
      
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
      console.error('[Calendars API] Error calling GHL API:', apiError);
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError);
      console.error('[Calendars API] Error details:', {
        message: errorMessage,
        stack: apiError instanceof Error ? apiError.stack : undefined,
      });
      
      return NextResponse.json(
        { 
          error: `Failed to fetch calendars from GHL: ${errorMessage}`,
          calendars: [],
          details: apiError instanceof Error ? {
            message: apiError.message,
            name: apiError.name,
          } : undefined,
        },
        { status: 500 }
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

