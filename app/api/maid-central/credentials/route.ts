import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeMaidCentralCredentials, getMaidCentralCredentials, type MaidCentralCredentials } from '@/lib/kv';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function POST(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const credentials: MaidCentralCredentials = {
      username,
      password,
    };

    await storeMaidCentralCredentials(credentials, locationId);

    // Test the credentials by attempting authentication with locationId
    try {
      // Get the credentials we just stored to validate them
      const storedCreds = await getMaidCentralCredentials(locationId);
      if (!storedCreds || !storedCreds.username || !storedCreds.password) {
        throw new Error('Failed to retrieve stored credentials for validation');
      }

      // Attempt to authenticate with Maid Central API
      const params = new URLSearchParams({
        username: storedCreds.username,
        password: storedCreds.password,
        grant_type: 'password',
      });

      const response = await fetch(`${process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com'}/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Authentication failed' }));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      // Update credentials with the token we received
      const updatedCreds: MaidCentralCredentials = {
        ...storedCreds,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: tokenData.expires_in
          ? Date.now() + (tokenData.expires_in * 1000)
          : Date.now() + 3600 * 1000,
      };
      
      await storeMaidCentralCredentials(updatedCreds, locationId);

      return NextResponse.json({ success: true, message: 'Credentials saved and validated' });
    } catch (authError) {
      // Store credentials even if auth fails (might be temporary issue)
      console.error('[Credentials API] Validation error:', authError);
      return NextResponse.json(
        { 
          success: true, 
          message: 'Credentials saved, but validation failed. Please check your credentials.',
          warning: authError instanceof Error ? authError.message : 'Authentication failed'
        },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error('Error saving Maid Central credentials:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to save credentials';
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
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }
    
    const { getMaidCentralCredentials } = await import('@/lib/kv');
    const credentials = await getMaidCentralCredentials(locationId);
    
    if (!credentials) {
      return NextResponse.json({ credentials: null });
    }

    // Don't return password in response
    return NextResponse.json({
      credentials: {
        username: credentials.username,
        hasPassword: !!credentials.password,
        hasToken: !!credentials.accessToken,
      },
    });
  } catch (error) {
    console.error('Error fetching Maid Central credentials:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch credentials';
    if (errorMessage.includes('DATABASE_URL') || errorMessage.includes('database')) {
      return NextResponse.json({ credentials: null }, { status: 200 });
    }
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

