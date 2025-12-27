import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function GET(request: NextRequest) {
  try {
    // Test authentication
    const token = await maidCentralAPI.authenticate();
    
    return NextResponse.json({
      success: true,
      message: 'Maid Central authentication successful',
      hasToken: !!token,
      tokenLength: token?.length || 0,
      apiBaseUrl: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
    });
  } catch (error) {
    console.error('Maid Central authentication test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Authentication failed',
        apiBaseUrl: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
      },
      { status: 500 }
    );
  }
}









