import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Create booking in Maid Central
    const booking = await maidCentralAPI.createBooking(body);
    
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    console.error('Error creating booking:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create booking' },
      { status: 500 }
    );
  }
}









