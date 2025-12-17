import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/kv';

// Set max duration for Vercel serverless function (60 seconds for webhook processing)
export const maxDuration = 60;

// Webhook handler optimized for serverless/Vercel
// This endpoint is designed to handle concurrent requests efficiently
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let quoteId: string | number | undefined;

  try {
    // Fast-fail checks first
    const config = await getIntegrationConfig();
    
    if (!config?.enabled) {
      return NextResponse.json({ message: 'Integration is disabled' }, { status: 200 });
    }

    if (!config.syncQuotes) {
      return NextResponse.json({ message: 'Quote syncing is disabled' }, { status: 200 });
    }

    if (!config.ghlLocationId) {
      console.error('[Webhook] GHL Location ID not configured');
      return NextResponse.json(
        { error: 'GHL Location ID not configured' },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    quoteId = body.quoteId || body.id || body.quote_id;

    if (!quoteId) {
      return NextResponse.json(
        { error: 'Quote ID is required' },
        { status: 400 }
      );
    }

    // Get quote data
    const quote = await maidCentralAPI.getQuote(quoteId);
    
    // Automatically map fields - basic fields to native GHL fields, rest as custom fields
    const prefix = config.customFieldPrefix || 'maidcentral_quote_';
    let contactData = ghlAPI.autoMapFields(quote, prefix);

    // Ensure custom fields exist in GHL if auto-create is enabled
    if (config.autoCreateFields) {
      const customFieldNames = Object.keys(contactData).filter(key => key.startsWith(prefix));
      await ghlAPI.ensureCustomFields(config.ghlLocationId, customFieldNames, prefix);
    }

    // Create contact in GHL
    const contactResult = await ghlAPI.createContact(config.ghlLocationId, contactData);
    const contactId = contactResult.id || contactResult.contactId || contactResult._id;

    if (!contactId) {
      throw new Error('Failed to get contact ID from GHL response');
    }

    // Add tags to contact if configured (support both single tag and multiple tags)
    const tagsToAdd: string[] = [];
    if (config.ghlTags && config.ghlTags.length > 0) {
      tagsToAdd.push(...config.ghlTags.filter(t => t && t.trim()));
    } else if (config.ghlTag) {
      tagsToAdd.push(config.ghlTag);
    }
    
    if (tagsToAdd.length > 0) {
      try {
        await ghlAPI.addTagsToContact(config.ghlLocationId, contactId, tagsToAdd);
        console.log(`[Webhook] Added tags "${tagsToAdd.join(', ')}" to contact ${contactId}`);
      } catch (tagError) {
        console.error(`[Webhook] Failed to add tags to contact:`, tagError);
        // Don't fail the whole process if tag addition fails
      }
    }

    // Create opportunity/deal in GHL if enabled
    let opportunityId = null;
    if (config.createOpportunities !== false) {
      try {
        const opportunityData: Record<string, any> = {
          title: quote.quoteNumber || quote.id || `Quote ${quoteId}`,
          status: 'new',
          source: 'Maid Central',
          monetaryValue: quote.totalAmount || quote.amount || quote.price,
        };

        const opportunityResult = await ghlAPI.createOpportunity(config.ghlLocationId, contactId, opportunityData);
        opportunityId = opportunityResult.id || opportunityResult.opportunityId || opportunityResult._id;
        console.log(`[Webhook] Created opportunity ${opportunityId} for contact ${contactId}`);
      } catch (oppError) {
        console.error(`[Webhook] Failed to create opportunity:`, oppError);
        // Don't fail the whole process if opportunity creation fails
        // Contact was created successfully, which is the main goal
      }
    } else {
      console.log(`[Webhook] Opportunity creation is disabled, skipping`);
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Successfully processed quote ${quoteId} in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Quote synced to GoHighLevel',
      contactId,
      opportunityId,
            tagsAdded: tagsToAdd.length > 0 ? tagsToAdd : undefined,
      quoteId,
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Webhook] Error processing quote ${quoteId || 'unknown'}:`, error);
    console.error(`[Webhook] Duration: ${duration}ms`);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Return appropriate status codes based on error type
    const statusCode = errorMessage.includes('not configured') ? 400 : 500;
    
    return NextResponse.json(
      { 
        error: 'Failed to process webhook',
        message: errorMessage,
        quoteId: quoteId || undefined,
        duration: `${duration}ms`,
      },
      { status: statusCode }
    );
  }
}

// Also support GET for testing
export async function GET(request: NextRequest) {
  const quoteId = request.nextUrl.searchParams.get('quoteId');
  
  if (!quoteId) {
    return NextResponse.json(
      { error: 'quoteId query parameter is required' },
      { status: 400 }
    );
  }

  // Process as if it was a POST webhook
  return POST(new NextRequest(request.url, {
    method: 'POST',
    body: JSON.stringify({ quoteId }),
    headers: {
      'Content-Type': 'application/json',
    },
  }));
}

