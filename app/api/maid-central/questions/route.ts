import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const scopeIdsParam = request.nextUrl.searchParams.get('scopeIds');

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    if (!scopeIdsParam) {
      return NextResponse.json(
        { error: 'scopeIds is required (comma-separated)' },
        { status: 400 }
      );
    }

    const scopeIds = scopeIdsParam.split(',').map(id => id.trim());
    const questions = await maidCentralAPI.getQuestions(scopeIds, locationId);
    
    return NextResponse.json({
      questions,
      scopeIds,
      count: questions.length,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locationId = getLocationIdFromRequest(request) || body.locationId;
    const { scopeIds } = body;

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    if (!scopeIds || !Array.isArray(scopeIds) || scopeIds.length === 0) {
      return NextResponse.json(
        { error: 'scopeIds is required and must be a non-empty array' },
        { status: 400 }
      );
    }

    const questions = await maidCentralAPI.getQuestions(scopeIds, locationId);
    
    return NextResponse.json({
      questions,
      scopeIds,
      count: questions.length,
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}
