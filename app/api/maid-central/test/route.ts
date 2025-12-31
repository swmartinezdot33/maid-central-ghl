import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { getLocationIdFromRequest } from '@/lib/request-utils';

export async function GET(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('leadId');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      locationId: locationId || 'not provided',
    };

    // Test 1: Check credentials first
    try {
      const { getMaidCentralCredentials } = await import('@/lib/db');
      const credentials = await getMaidCentralCredentials(locationId || undefined);
      
      results.credentials = {
        configured: !!credentials,
        hasUsername: !!credentials?.username,
        hasPassword: !!credentials?.password,
        note: credentials 
          ? 'Credentials found in database' 
          : 'No credentials configured. Please configure Maid Central credentials first.',
      };
      
      if (!credentials || !credentials.username || !credentials.password) {
        results.authentication = {
          success: false,
          error: 'Maid Central credentials not configured',
          suggestion: 'Please configure credentials via /setup page or POST /api/maid-central/credentials',
        };
        return NextResponse.json(results, { status: 200 }); // Return 200 so user can see the helpful message
      }
    } catch (credError) {
      results.credentials = {
        configured: false,
        error: credError instanceof Error ? credError.message : 'Failed to check credentials',
      };
    }

    // Test 2: Authentication
    try {
      const token = await maidCentralAPI.authenticate(locationId || undefined);
      results.authentication = {
        success: true,
        message: 'Maid Central authentication successful',
        hasToken: !!token,
        tokenLength: token?.length || 0,
        tokenPreview: token ? `${token.substring(0, 20)}...` : 'none',
      };
    } catch (authError) {
      results.authentication = {
        success: false,
        error: authError instanceof Error ? authError.message : 'Authentication failed',
        suggestion: 'Check that your Maid Central API credentials are correct',
      };
      // Don't return early - continue with other tests
    }

    // Test 3: Get Quote Fields
    try {
      const fields = await maidCentralAPI.getQuoteFields();
      results.quoteFields = {
        success: true,
        count: fields.length,
        fields: fields.slice(0, 20), // Show first 20 fields
        totalFields: fields.length,
      };
    } catch (fieldsError) {
      results.quoteFields = {
        success: false,
        error: fieldsError instanceof Error ? fieldsError.message : 'Failed to get quote fields',
      };
    }

    // Test 4: Fetch a specific lead/quote if leadId is provided
    if (leadId) {
      try {
        const leadData = await maidCentralAPI.getLead(leadId, locationId);
        
        // Extract key information from the lead
        const extractedData = {
          hasData: !!leadData,
          dataType: typeof leadData,
          isArray: Array.isArray(leadData),
          keys: leadData && typeof leadData === 'object' ? Object.keys(leadData).slice(0, 30) : [],
          sampleFields: {} as Record<string, any>,
        };

        // Extract some common fields if they exist
        if (leadData && typeof leadData === 'object' && !Array.isArray(leadData)) {
          const commonFields = [
            'LeadId', 'leadId', 'Id', 'id',
            'FirstName', 'firstName', 'first_name',
            'LastName', 'lastName', 'last_name',
            'Email', 'email',
            'Phone', 'phone',
            'QuoteNumber', 'quoteNumber', 'quote_number',
            'QuoteTotal', 'quoteTotal', 'TotalAmount', 'totalAmount',
            'StatusName', 'statusName', 'status_name',
            'HomeAddress1', 'homeAddress1', 'home_address1',
            'HomeCity', 'homeCity', 'home_city',
          ];

          for (const field of commonFields) {
            if (leadData[field] !== undefined) {
              extractedData.sampleFields[field] = leadData[field];
            }
          }

          // Get a sample of all fields (first 20 non-empty values)
          let fieldCount = 0;
          for (const [key, value] of Object.entries(leadData)) {
            if (fieldCount >= 20) break;
            if (value !== null && value !== undefined && value !== '') {
              extractedData.sampleFields[key] = 
                typeof value === 'object' ? '[Object]' : 
                typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : 
                value;
              fieldCount++;
            }
          }
        }

        results.leadData = {
          success: true,
          leadId: leadId,
          ...extractedData,
          rawDataSize: JSON.stringify(leadData).length,
          note: 'Full data structure available. Showing sample fields only.',
        };
      } catch (leadError) {
        results.leadData = {
          success: false,
          leadId: leadId,
          error: leadError instanceof Error ? leadError.message : 'Failed to fetch lead',
          suggestion: 'Make sure the leadId exists and you have access to it',
        };
      }
    } else {
      results.leadData = {
        note: 'No leadId provided. Add ?leadId=123 to test fetching a specific lead/quote',
      };
    }

    // Test 5: API Configuration
    results.config = {
      apiBaseUrl: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
      hasLocationId: !!locationId,
    };

    const allTestsPassed = 
      results.authentication?.success && 
      results.quoteFields?.success &&
      (!leadId || results.leadData?.success);

    return NextResponse.json({
      success: allTestsPassed,
      message: allTestsPassed 
        ? 'All tests passed!' 
        : 'Some tests failed. Check individual test results.',
      ...results,
    });
  } catch (error) {
    console.error('Maid Central test failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Test failed',
        apiBaseUrl: process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com',
      },
      { status: 500 }
    );
  }
}









