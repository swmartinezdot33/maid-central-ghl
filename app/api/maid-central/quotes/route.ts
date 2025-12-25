import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('leadId');

    if (!leadId) {
      return NextResponse.json(
        { error: 'leadId is required to fetch quotes for a lead' },
        { status: 400 }
      );
    }

    // For now, we will rely on MaidCentral's Lead/Quote endpoints accessed via maidCentralAPI
    // A dedicated getLead/getQuote implementation can be added here as needed.
    return NextResponse.json(
      { error: 'GET /api/maid-central/quotes is not yet implemented for MaidCentral Lead API' },
      { status: 501 }
    );
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

// Create or update a Quote for a Lead (used by the booking widget Step 2)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      leadId,
      homeAddress1,
      homeAddress2,
      homeCity,
      homeRegion,
      homePostalCode,
      billingAddress1,
      billingAddress2,
      billingCity,
      billingRegion,
      billingPostalCode,
      scopeGroupId,
      scopesOfWork,
      questions,
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
    } = body;

    if (!leadId) {
      return NextResponse.json(
        { error: 'LeadId is required to create a quote' },
        { status: 400 }
      );
    }

    // Map widget payload to MaidCentral CreateOrUpdateQuote payload
    const quotePayload: any = {
      LeadId: Number(leadId),
      HomeAddress1: homeAddress1,
      HomeAddress2: homeAddress2,
      HomeCity: homeCity,
      HomeRegion: homeRegion,
      HomePostalCode: homePostalCode,
      BillingAddress1: billingAddress1,
      BillingAddress2: billingAddress2,
      BillingCity: billingCity,
      BillingRegion: billingRegion,
      BillingPostalCode: billingPostalCode,
      SendQuoteEmail: false,
      AddToCampaigns: true,
      TriggerWebhook: true,
      ScopeGroupId: scopeGroupId,
      ScopesOfWork: scopesOfWork,
      Questions: questions,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
    };

    const quoteResponse = await maidCentralAPI.createOrUpdateQuote(quotePayload);

    if (!quoteResponse?.IsSuccess) {
      const message = quoteResponse?.Message || 'MaidCentral CreateOrUpdateQuote failed';
      return NextResponse.json({ error: message, raw: quoteResponse }, { status: 400 });
    }

    const result = quoteResponse.Result || {};

    return NextResponse.json(
      {
        quoteId: result.QuoteId || result.CustomerQuoteId,
        leadId: result.LeadId,
        maidServiceQuoteUrl: result.MaidServiceQuoteUrl,
        raw: quoteResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating quote:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quote' },
      { status: 500 }
    );
  }
}

