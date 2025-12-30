import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralCustomersAPI } from '@/lib/maid-central-customers';
import { getLocationId } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = await getLocationId(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required. Provide it via query param (?locationId=...), header (x-ghl-location-id), or in request body.' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const search = searchParams.get('search') || searchParams.get('query') || searchParams.get('q') || undefined;

    console.log('[Customers API] Fetching customers with params:', { limit, offset, search });
    
    const customers = await maidCentralCustomersAPI.getCustomers({ limit, offset, search }, locationId);
    
    console.log('[Customers API] Received customers:', Array.isArray(customers) ? customers.length : 'non-array response');
    
    // Ensure we return an array
    const customerArray = Array.isArray(customers) ? customers : (customers?.data || customers?.customers || []);
    
    return NextResponse.json(customerArray);
  } catch (error) {
    console.error('Error fetching customers:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch customers';
    
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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const customer = await maidCentralCustomersAPI.createCustomer(body);
    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error('Error creating customer:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create customer' },
      { status: 500 }
    );
  }
}

