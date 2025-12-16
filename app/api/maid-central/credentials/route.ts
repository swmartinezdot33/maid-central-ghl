import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeMaidCentralCredentials, type MaidCentralCredentials } from '@/lib/kv';
import { maidCentralAPI } from '@/lib/maid-central';

export async function POST(request: NextRequest) {
  try {
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

    await storeMaidCentralCredentials(credentials);

    // Test the credentials by attempting authentication
    try {
      await maidCentralAPI.authenticate();
      return NextResponse.json({ success: true, message: 'Credentials saved and validated' });
    } catch (authError) {
      // Store credentials even if auth fails (might be temporary issue)
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
    const { getMaidCentralCredentials } = await import('@/lib/kv');
    const credentials = await getMaidCentralCredentials();
    
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

