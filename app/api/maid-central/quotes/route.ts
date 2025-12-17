import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const status = searchParams.get('status') || undefined;

    const quotes = await maidCentralAPI.getQuotes({ limit, offset, status });
    
    // Ensure we always return an array
    const quoteArray = Array.isArray(quotes) ? quotes : (quotes?.data || quotes?.quotes || []);
    
    return NextResponse.json(quoteArray);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch quotes';
    
    // If it's a known API endpoint issue, return empty array with a message
    if (errorMessage.includes('not found') || errorMessage.includes('404')) {
      return NextResponse.json([], { status: 200 }); // Return empty array, not an error
    }
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

