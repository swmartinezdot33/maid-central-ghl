import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeGHLPrivateToken, getGHLPrivateToken, storeIntegrationConfig, getIntegrationConfig, type GHLPrivateToken } from '@/lib/kv';
import { ghlAPI } from '@/lib/ghl';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privateToken, locationId } = body;

    if (!privateToken || !locationId) {
      return NextResponse.json(
        { error: 'Private token and location ID are required' },
        { status: 400 }
      );
    }

    const tokenData: GHLPrivateToken = {
      privateToken,
      locationId,
    };

    await storeGHLPrivateToken(tokenData);

    // Update integration config with location ID
    const existingConfig = await getIntegrationConfig();
    const config = existingConfig || {
      fieldMappings: [],
      enabled: false,
    };
    
    config.ghlLocationId = locationId;
    await storeIntegrationConfig(config);

    // Test the token by fetching locations
    try {
      await ghlAPI.getLocations();
      return NextResponse.json({ 
        success: true, 
        message: 'Private token saved and validated',
        locationId 
      });
    } catch (authError) {
      // Store token even if validation fails (might be temporary issue)
      return NextResponse.json(
        { 
          success: true, 
          message: 'Private token saved, but validation failed. Please check your token.',
          warning: authError instanceof Error ? authError.message : 'Validation failed',
          locationId
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error saving GHL private token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save private token';
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('database')) {
      return NextResponse.json(
        { error: 'Database is not configured. Please set DATABASE_URL environment variable.' },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const tokenData = await getGHLPrivateToken();
    
    if (!tokenData) {
      return NextResponse.json({ token: null });
    }

    // Don't return the actual token in response for security
    return NextResponse.json({
      token: {
        hasToken: !!tokenData.privateToken,
        locationId: tokenData.locationId,
      },
    });
  } catch (error) {
    console.error('Error fetching GHL token:', error);
    // If database is not configured, just return null token (not an error state)
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch token';
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('database')) {
      return NextResponse.json({ token: null }, { status: 200 });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

