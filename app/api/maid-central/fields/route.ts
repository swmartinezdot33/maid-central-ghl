import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function GET(request: NextRequest) {
  try {
    const fields = await maidCentralAPI.getQuoteFields();
    return NextResponse.json({ fields });
  } catch (error) {
    console.error('Error fetching Maid Central fields:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch fields' },
      { status: 500 }
    );
  }
}








