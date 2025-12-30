import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig } from '@/lib/kv';
import { getLocationId } from '@/lib/request-utils';
import { syncQuote } from '@/lib/quote-sync';

// Set max duration for Vercel serverless function (60 seconds for webhook processing)
export const maxDuration = 60;

// Webhook handler optimized for serverless/Vercel
// This endpoint is designed to handle concurrent requests efficiently
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let quoteId: string | number | undefined;

  try {
    // Fast-fail checks first
    // Get locationId from request (iframe context, query param, or header)
    const locationId = await getLocationId(request);
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled) {
      return NextResponse.json({ message: 'Integration is disabled' }, { status: 200 });
    }

    if (!config.syncQuotes) {
      return NextResponse.json({ message: 'Quote syncing is disabled' }, { status: 200 });
    }

    if (!config.ghlLocationId) {
      console.error('[Webhook] CRM Location ID not configured');
      return NextResponse.json(
        { error: 'CRM Location ID not configured' },
        { status: 400 }
      );
    }

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
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

    // Use the shared sync function
    const syncResult = await syncQuote(locationId, quoteId, config);
    
    if (!syncResult.success) {
      throw new Error(syncResult.error || 'Failed to sync quote');
    }

    const duration = Date.now() - startTime;
    console.log(`[Webhook] Successfully processed quote ${quoteId} in ${duration}ms`);

    return NextResponse.json({
      success: true,
      message: 'Quote synced to CRM',
      contactId: syncResult.contactId,
      opportunityId: syncResult.opportunityId,
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

