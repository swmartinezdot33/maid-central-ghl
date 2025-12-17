import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralCustomersAPI } from '@/lib/maid-central-customers';
import { ghlAPI } from '@/lib/ghl';
import { getIntegrationConfig } from '@/lib/kv';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerId } = body;

    if (!customerId) {
      return NextResponse.json(
        { error: 'Customer ID is required' },
        { status: 400 }
      );
    }

    const config = await getIntegrationConfig();
    
    if (!config?.enabled) {
      return NextResponse.json(
        { error: 'Integration is disabled' },
        { status: 400 }
      );
    }

    if (!config.syncCustomers) {
      return NextResponse.json(
        { error: 'Customer syncing is disabled. Enable it in Settings.' },
        { status: 400 }
      );
    }

    if (!config.ghlLocationId) {
      return NextResponse.json(
        { error: 'GHL Location ID not configured' },
        { status: 400 }
      );
    }

    // Get customer data from Maid Central
    const customer = await maidCentralCustomersAPI.getCustomer(customerId);
    
    // Automatically map fields - basic fields to native GHL fields, rest as custom fields
    const prefix = config.customFieldPrefix || 'maidcentral_quote_';
    let contactData = ghlAPI.autoMapFields(customer, prefix);

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
        console.log(`[Sync] Added tags "${tagsToAdd.join(', ')}" to contact ${contactId}`);
      } catch (tagError) {
        console.error(`[Sync] Failed to add tags to contact:`, tagError);
        // Don't fail the whole process if tag addition fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Customer synced to GoHighLevel successfully',
      contactId,
      customerId,
    });
  } catch (error) {
    console.error('Error syncing customer to GHL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to sync customer to GHL',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}

