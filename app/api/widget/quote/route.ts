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
      scopeGroupId,
      scopesOfWork,
      questions,
    } = body;

    if (!firstName || !email || !phone || !scopeGroupId) {
      return NextResponse.json(
        { error: 'firstName, email, phone, and scopeGroupId are required' },
        { status: 400 }
      );
    }

    // Step 1: Create Lead in MaidCentral
    let leadId = null;
    try {
      const leadPayload: any = {
        FirstName: firstName,
        LastName: lastName || '',
        Email: email,
        Phone: phone,
        PostalCode: postalCode || homePostalCode,
      };

      const leadResponse = await maidCentralAPI.createLead(leadPayload, locationId);
      leadId = leadResponse?.Result?.LeadId || leadResponse?.LeadId;
      console.log('[Widget Quote] Lead created in MaidCentral:', leadId);
    } catch (leadError) {
      console.error('[Widget Quote] Error creating lead in MaidCentral:', leadError);
      return NextResponse.json(
        { error: `Failed to create lead: ${leadError instanceof Error ? leadError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    if (!leadId) {
      return NextResponse.json(
        { error: 'Failed to get lead ID from MaidCentral response' },
        { status: 500 }
      );
    }

    // Step 2: Create Contact in GHL simultaneously
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
      console.log('[Widget Quote] Contact created in GHL:', ghlContactId);
    } catch (ghlContactError) {
      console.error('[Widget Quote] Error creating contact in GHL:', ghlContactError);
      // Continue without GHL contact, quote can still be created
    }

    // Step 3: Create Quote in MaidCentral
    const quotePayload: any = {
      LeadId: Number(leadId),
      HomeAddress1: homeAddress1,
      HomeAddress2: homeAddress2,
      HomeCity: homeCity,
      HomeRegion: homeRegion,
      HomePostalCode: homePostalCode,
      ScopeGroupId: scopeGroupId,
      ScopesOfWork: scopesOfWork,
      Questions: questions,
      SendQuoteEmail: true,
      AddToCampaigns: true,
      TriggerWebhook: true,
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
      console.log('[Widget Quote] Quote created in MaidCentral:', quoteId);
    } catch (quoteError) {
      console.error('[Widget Quote] Error creating quote in MaidCentral:', quoteError);
      return NextResponse.json(
        { error: `Failed to create quote: ${quoteError instanceof Error ? quoteError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Step 4: Create Opportunity in GHL with quote details (if contact was created)
    let opportunityId = null;
    if (ghlContactId) {
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
          }
        );

        opportunityId = opportunityResponse.id || opportunityResponse._id;
        console.log('[Widget Quote] Opportunity created in GHL:', opportunityId);
      } catch (oppError) {
        console.warn('[Widget Quote] Error creating opportunity in GHL:', oppError);
        // Don't fail if opportunity creation fails
      }
    }

    // Add tags if configured
    if (ghlContactId && config.ghlTags && config.ghlTags.length > 0) {
      try {
        await ghlAPI.addTagsToContact(config.ghlLocationId, ghlContactId, config.ghlTags.filter(t => t && t.trim()));
      } catch (tagError) {
        console.warn('[Widget Quote] Error adding tags to contact:', tagError);
      }
    }

    return NextResponse.json({
      success: true,
      leadId: leadId,
      quoteId: quoteId,
      ghlContactId: ghlContactId,
      ghlOpportunityId: opportunityId,
      quote: quoteData,
      quoteUrl: quoteData?.MaidServiceQuoteUrl || quoteData?.QuoteUrl,
    });
  } catch (error) {
    console.error('Error in widget quote creation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create quote' },
      { status: 500 }
    );
  }
}
