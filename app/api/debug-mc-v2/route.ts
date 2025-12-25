import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { getMaidCentralCredentials } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const credentials = await getMaidCentralCredentials();
    
    if (!credentials) {
      return NextResponse.json({ error: 'No Maid Central credentials found' }, { status: 400 });
    }

    const baseUrl = process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com';
    const tokenUrl = `${baseUrl}/oauth/token`;
    
    // 1. Authenticate
    console.log('[MC Debug] Authenticating...');
    const tokenBody = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      grant_type: 'password',
    });

    let token = '';
    let authResult = {};
    try {
      const tokenResponse = await axios.post(tokenUrl, tokenBody, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      token = tokenResponse.data.access_token;
      authResult = { success: true, status: tokenResponse.status };
    } catch (error: any) {
      return NextResponse.json({ 
        step: 'Authentication',
        error: error.message, 
        response: error.response?.data 
      }, { status: 401 });
    }

    const headers = { Authorization: `Bearer ${token}` };

    // 2. Test Endpoints
    const tests = [
      // Auxiliary Data (should always work)
      { name: 'Get Scope Groups', method: 'GET', url: `${baseUrl}/api/Lead/ScopeGroups` },
      { name: 'Get Billing Terms', method: 'GET', url: `${baseUrl}/api/Lead/BillingTerms` },
      { name: 'Get Postal Codes', method: 'GET', url: `${baseUrl}/api/Lead/PostalCodes` },
      
      // Lead/Customer Data
      // Note: Some might return 404 if no ID provided, testing generic paths
      { name: 'Get Tags', method: 'GET', url: `${baseUrl}/api/Lead/Tags` },
      { name: 'Get Customer Sources', method: 'GET', url: `${baseUrl}/api/Lead/CustomerSources` },
      
      // Booking/Schedule
      // Trying to find where appointments live
      { name: 'Get Teams', method: 'GET', url: `${baseUrl}/api/Lead/Teams` },
    ];

    const results = [];

    for (const test of tests) {
      try {
        console.log(`[MC Debug] Testing ${test.name}: ${test.url}`);
        const response = await axios({
          method: test.method,
          url: test.url,
          headers,
          validateStatus: () => true,
        });
        
        const isHtml = typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE');
        
        results.push({
          test: test.name,
          url: test.url,
          status: response.status,
          statusText: response.statusText,
          isHtml,
          dataSample: isHtml ? 'HTML Content' : JSON.stringify(response.data).substring(0, 200)
        });
      } catch (error: any) {
        results.push({
          test: test.name,
          url: test.url,
          error: error.message
        });
      }
    }

    return NextResponse.json({ 
      auth: authResult,
      results 
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

