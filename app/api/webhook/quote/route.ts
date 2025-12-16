import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig, getFieldMappings } from '@/lib/kv';

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

    // Parallel data fetching where possible
    const [quote, mappings] = await Promise.all([
      maidCentralAPI.getQuote(quoteId),
      getFieldMappings(),
    ]);
    
    // Map quote data to GHL contact format
    const contactData: Record<string, any> = {};
    
    for (const mapping of mappings) {
      const maidCentralValue = quote[mapping.maidCentralField];
      if (maidCentralValue !== undefined && maidCentralValue !== null) {
        contactData[mapping.ghlField] = maidCentralValue;
      }
    }

    // Create contact in GHL
    const result = await ghlAPI.createContact(config.ghlLocationId, contactData);

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Successfully processed quote ${quoteId} in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Quote synced to GoHighLevel',
      contactId: result.id || result.contactId,
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

