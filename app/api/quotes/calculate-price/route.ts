import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

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
    const {
      leadId,
      homeAddress1,
      homeAddress2,
      homeCity,
      homeRegion,
      homePostalCode,
      scopeGroupId,
      scopesOfWork,
      questions,
    } = body;

    if (!leadId || !scopeGroupId) {
      return NextResponse.json(
        { error: 'leadId and scopeGroupId are required for price calculation' },
        { status: 400 }
      );
    }

    // Build the price calculation payload
    const pricePayload: any = {
      LeadId: Number(leadId),
      ScopeGroupId: scopeGroupId,
      HomeAddress1: homeAddress1,
      HomeAddress2: homeAddress2,
      HomeCity: homeCity,
      HomeRegion: homeRegion,
      HomePostalCode: homePostalCode,
      ScopesOfWork: scopesOfWork,
      Questions: questions,
    };

    const priceResult = await maidCentralAPI.calculatePrice(pricePayload);

    if (!priceResult) {
      return NextResponse.json(
        { error: 'No price calculation result returned' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...priceResult,
    });
  } catch (error) {
    console.error('Error calculating price:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to calculate price' },
      { status: 500 }
    );
  }
}
