import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getWidgetConfig, storeWidgetConfig, deleteWidgetConfig, type WidgetConfig } from '@/lib/db';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const config = await getWidgetConfig(locationId);
    
    if (!config) {
      // Return default config if none exists
      return NextResponse.json({
        locationId,
        themeColors: {
          primary: '#2563eb',
          secondary: '#059669',
          background: '#ffffff',
          text: '#1f2937',
          textLight: '#6b7280',
          border: '#e5e7eb',
          success: '#10b981',
          error: '#ef4444',
        },
        typography: {
          fontFamily: 'system-ui, -apple-system, sans-serif',
          heading1Size: '2rem',
          heading2Size: '1.5rem',
          bodySize: '1rem',
          headingWeight: '700',
          bodyWeight: '400',
        },
        layout: {
          multiStep: true,
          fieldArrangement: 'single-column',
          showBranding: true,
          showProgress: true,
        },
        fieldVisibility: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          postalCode: true,
          services: true,
          address: true,
          date: true,
          time: true,
        },
      });
    }

    return NextResponse.json(config);
  } catch (error) {
    console.error('Error fetching widget config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch widget config' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const config: WidgetConfig = {
      locationId,
      themeColors: body.themeColors,
      typography: body.typography,
      layout: body.layout,
      customCss: body.customCss,
      fieldVisibility: body.fieldVisibility,
    };

    await storeWidgetConfig(config);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('Error saving widget config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save widget config' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    await deleteWidgetConfig(locationId);

    return NextResponse.json({
      success: true,
      message: 'Widget config deleted',
    });
  } catch (error) {
    console.error('Error deleting widget config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete widget config' },
      { status: 500 }
    );
  }
}
