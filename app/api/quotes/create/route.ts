import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { getLocationIdFromRequest } from '@/lib/request-utils';
import { getIntegrationConfig } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const config = await getIntegrationConfig(locationId);
    if (!config?.ghlLocationId) {
      return NextResponse.json(
        { error: 'GHL Location ID not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      // Lead data
      leadId,
      firstName,
      lastName,
      email,
      phone,
      postalCode,
      // Quote data
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
      // UTM data
      utmSource,
      utmMedium,
      utmCampaign,
      utmTerm,
      utmContent,
    } = body;

    if (!leadId || !scopeGroupId) {
      return NextResponse.json(
        { error: 'leadId and scopeGroupId are required' },
        { status: 400 }
      );
    }

    // Step 1: Ensure we have the lead in MaidCentral
    const leadData = {
      LeadId: Number(leadId),
      FirstName: firstName,
      LastName: lastName,
      Email: email,
      Phone: phone,
      PostalCode: postalCode,
    };

    let maidCentralLeadId = leadId;
    try {
      const leadResponse = await maidCentralAPI.createLead(leadData, locationId);
      maidCentralLeadId = leadResponse?.Result?.LeadId || leadResponse?.LeadId || leadId;
      console.log('[Quote Creation] Lead created/updated in MaidCentral:', maidCentralLeadId);
    } catch (leadError) {
      console.error('[Quote Creation] Error creating lead in MaidCentral:', leadError);
      // Continue anyway, as the lead might already exist
    }

    // Step 2: Create Contact in GHL
    let ghlContactId = null;
    try {
      const ghlContactData: any = {
        firstName: firstName || '',
        lastName: lastName || '',
        email: email,
        phone: phone,
        postalCode: homePostalCode || postalCode,
      };

      if (homeAddress1) ghlContactData.address1 = homeAddress1;
      if (homeCity) ghlContactData.city = homeCity;
      if (homeRegion) ghlContactData.state = homeRegion;

      const ghlContactResponse = await ghlAPI.createContact(config.ghlLocationId, ghlContactData);
      ghlContactId = ghlContactResponse.id || ghlContactResponse.contactId || ghlContactResponse._id;
      console.log('[Quote Creation] Contact created in GHL:', ghlContactId);
    } catch (ghlContactError) {
      console.error('[Quote Creation] Error creating contact in GHL:', ghlContactError);
      return NextResponse.json(
        { error: `Failed to create contact in GHL: ${ghlContactError instanceof Error ? ghlContactError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Step 3: Create Quote in MaidCentral
    const quotePayload: any = {
      LeadId: Number(maidCentralLeadId),
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
      ScopeGroupId: scopeGroupId,
      ScopesOfWork: scopesOfWork,
      Questions: questions,
      SendQuoteEmail: false,
      AddToCampaigns: true,
      TriggerWebhook: true,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
    };

    let quoteData = null;
    let quoteId = null;
    try {
      const quoteResponse = await maidCentralAPI.createOrUpdateQuote(quotePayload);
      
      if (!quoteResponse?.IsSuccess && !quoteResponse?.Result) {
        throw new Error(quoteResponse?.Message || 'Quote creation failed');
      }

      quoteData = quoteResponse.Result || quoteResponse;
      quoteId = quoteData?.QuoteId || quoteData?.CustomerQuoteId || quoteData?.id;
      console.log('[Quote Creation] Quote created in MaidCentral:', quoteId);
    } catch (quoteError) {
      console.error('[Quote Creation] Error creating quote in MaidCentral:', quoteError);
      return NextResponse.json(
        { error: `Failed to create quote in MaidCentral: ${quoteError instanceof Error ? quoteError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Step 4: Create Opportunity in GHL with quote details
    let opportunityId = null;
    try {
      const opportunityResponse = await ghlAPI.createOpportunityWithQuote(
        config.ghlLocationId,
        ghlContactId,
        {
          title: `Quote #${quoteId || 'New'}`,
          quoteNumber: quoteId,
          amount: quoteData?.QuoteTotal || quoteData?.TotalAmount || quoteData?.Amount || 0,
          serviceDetails: scopesOfWork ? JSON.stringify(scopesOfWork) : undefined,
          address: homeAddress1,
          postalCode: homePostalCode || postalCode,
          estimatedDate: undefined,
        }
      );

      opportunityId = opportunityResponse.id || opportunityResponse._id;
      console.log('[Quote Creation] Opportunity created in GHL:', opportunityId);
    } catch (oppError) {
      console.error('[Quote Creation] Error creating opportunity in GHL:', oppError);
      // Don't fail if opportunity creation fails, as quote and contact were created
    }

    // Add tags if configured
    if (config.ghlTags && config.ghlTags.length > 0) {
      try {
        await ghlAPI.addTagsToContact(config.ghlLocationId, ghlContactId, config.ghlTags.filter(t => t && t.trim()));
      } catch (tagError) {
        console.warn('[Quote Creation] Error adding tags to contact:', tagError);
      }
    }

    return NextResponse.json({
      success: true,
      leadId: maidCentralLeadId,
      quoteId: quoteId,
      ghlContactId: ghlContactId,
      ghlOpportunityId: opportunityId,
      quote: quoteData,
    });
  } catch (error) {
    console.error('Error in quote creation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quote' },
      { status: 500 }
    );
  }
}
