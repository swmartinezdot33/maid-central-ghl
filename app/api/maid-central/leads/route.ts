import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Map our widget payload (camelCase) to MaidCentral's expected fields (PascalCase)
    const leadPayload: any = {
      FirstName: body.firstName,
      LastName: body.lastName,
      Email: body.email,
      Phone: body.phone,
      PostalCode: body.postalCode,
      // Sensible defaults - can be made configurable later
      SendLeadEmail: true,
      AddToCampaigns: true,
      TriggerWebhook: true,
      AllowDuplicates: false,
      // UTM tracking
      utm_source: body.utmSource,
      utm_medium: body.utmMedium,
      utm_campaign: body.utmCampaign,
      utm_term: body.utmTerm,
      utm_content: body.utmContent,
    };

    // Create or update lead in Maid Central
    const leadResponse = await maidCentralAPI.createLead(leadPayload);

    // MaidCentral wraps the result in IsSuccess/Message/Result
    if (!leadResponse?.IsSuccess) {
      const message = leadResponse?.Message || 'MaidCentral CreateOrUpdate lead failed';
      return NextResponse.json({ error: message, raw: leadResponse }, { status: 400 });
    }

    const result = leadResponse.Result || {};

    return NextResponse.json(
      {
        leadId: result.LeadId,
        maidServiceQuoteUrl: result.MaidServiceQuoteUrl,
        statusName: result.StatusName,
        raw: leadResponse,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating lead:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create lead' },
      { status: 500 }
    );
  }
}

