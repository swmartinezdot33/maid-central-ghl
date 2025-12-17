import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getWebhookConfigs, storeWebhookEvent, updateWebhookEventStatus } from '@/lib/maid-central-webhooks';
import { maidCentralAPI } from '@/lib/maid-central';
import { maidCentralCustomersAPI } from '@/lib/maid-central-customers';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig, getFieldMappings } from '@/lib/kv';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const eventType = body.eventType || body.type;
    const entityId = body.id || body.entityId || body.quoteId || body.customerId || body.serviceId;
    const payload = body;

    if (!eventType || !entityId) {
      return NextResponse.json(
        { error: 'Event type and entity ID are required' },
        { status: 400 }
      );
    }

    // Store webhook event for tracking
    const event = await storeWebhookEvent({
      eventType,
      entityId: String(entityId),
      payload,
      deliveryStatus: 'pending',
      deliveryAttempts: 0,
    });

    // Process the webhook based on event type
    try {
      await processWebhookEvent(eventType, entityId, payload);
      
      // Update event status to delivered
      if (event.id) {
        await updateWebhookEventStatus(event.id, 'delivered');
      }

      return NextResponse.json({ success: true, eventId: event.id });
    } catch (processError) {
      // Update event status to failed
      if (event.id) {
        await updateWebhookEventStatus(
          event.id,
          'failed',
          processError instanceof Error ? processError.message : 'Unknown error'
        );
      }
      throw processError;
    }
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}

async function processWebhookEvent(eventType: string, entityId: any, payload: any) {
  const config = await getIntegrationConfig();
  
  if (!config?.enabled) {
    console.log('[Webhook] Integration is disabled, skipping event:', eventType);
    return;
  }

  if (!config.ghlLocationId) {
    throw new Error('GHL Location ID not configured');
  }

  const mappings = await getFieldMappings();

  switch (eventType) {
    case 'quote.created':
    case 'quote.updated':
      await handleQuoteEvent(entityId, config.ghlLocationId, mappings);
      break;
    
    case 'customer.created':
    case 'customer.updated':
      await handleCustomerEvent(entityId, config.ghlLocationId, mappings);
      break;
    
    case 'service.created':
    case 'service.updated':
      await handleServiceEvent(entityId, config.ghlLocationId);
      break;
    
    default:
      console.log(`[Webhook] Unhandled event type: ${eventType}`);
  }
}

async function handleQuoteEvent(quoteId: any, locationId: string, mappings: any[]) {
  const quote = await maidCentralAPI.getQuote(quoteId);
  
  const contactData: Record<string, any> = {};
  for (const mapping of mappings) {
    const value = quote[mapping.maidCentralField];
    if (value !== undefined && value !== null) {
      contactData[mapping.ghlField] = value;
    }
  }

  await ghlAPI.createContact(locationId, contactData);
  console.log(`[Webhook] Quote ${quoteId} synced to GHL`);
}

async function handleCustomerEvent(customerId: any, locationId: string, mappings: any[]) {
  const customer = await maidCentralCustomersAPI.getCustomer(customerId);
  
  const contactData: Record<string, any> = {};
  for (const mapping of mappings) {
    const value = customer[mapping.maidCentralField];
    if (value !== undefined && value !== null) {
      contactData[mapping.ghlField] = value;
    }
  }

  await ghlAPI.createContact(locationId, contactData);
  console.log(`[Webhook] Customer ${customerId} synced to GHL`);
}

async function handleServiceEvent(serviceId: any, locationId: string) {
  // Services would sync as products in GHL if needed
  // This is a placeholder for future implementation
  console.log(`[Webhook] Service ${serviceId} event received`);
}

