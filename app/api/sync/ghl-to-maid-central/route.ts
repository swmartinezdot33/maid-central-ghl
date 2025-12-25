import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { ghlAPI } from '@/lib/ghl';
import { maidCentralCustomersAPI } from '@/lib/maid-central-customers';
import { maidCentralAPI } from '@/lib/maid-central';
import { getIntegrationConfig, getFieldMappings } from '@/lib/kv';
import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contactId, quoteId } = body;

    if (!contactId && !quoteId) {
      return NextResponse.json(
        { error: 'Contact ID or Quote ID is required' },
        { status: 400 }
      );
    }

    const config = await getIntegrationConfig();
    if (!config?.enabled || !config.ghlLocationId) {
      return NextResponse.json(
        { error: 'Integration is not enabled or GHL Location ID is not configured' },
        { status: 400 }
      );
    }

    if (contactId) {
      // Sync GHL contact to Maid Central customer
      const contact = await ghlAPI.getContact(config.ghlLocationId, contactId);
      const mappings = await getFieldMappings();
      
      const customerData: Record<string, any> = {};
      for (const mapping of mappings) {
        const value = contact[mapping.ghlField];
        if (value !== undefined && value !== null) {
          customerData[mapping.maidCentralField] = value;
        }
      }

      const customer = await maidCentralCustomersAPI.createCustomer(customerData);
      
      // Store sync relationship
      const sql = getSql();
      await sql`
        INSERT INTO maid_central_customers (maid_central_id, ghl_contact_id, sync_status, last_synced_at, data)
        VALUES (${customer.id || customer.customerId}, ${contactId}, 'synced', NOW(), ${JSON.stringify(customer)})
        ON CONFLICT (maid_central_id) 
        DO UPDATE SET ghl_contact_id = ${contactId}, sync_status = 'synced', last_synced_at = NOW(), data = ${JSON.stringify(customer)}, updated_at = NOW()
      `;

      return NextResponse.json({ success: true, customer });
    }

    if (quoteId) {
      // Sync GHL opportunity to Maid Central quote (placeholder)
      // This would require GHL opportunity API access
      return NextResponse.json({ success: true, message: 'Quote sync not yet implemented' });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch (error) {
    console.error('Error syncing GHL to Maid Central:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to sync' },
      { status: 500 }
    );
  }
}








