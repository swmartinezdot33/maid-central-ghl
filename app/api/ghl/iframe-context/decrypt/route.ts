import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig } from '@/lib/db';
import type { GHLIframeData } from '@/lib/ghl-iframe-types';

// Import CryptoJS for decrypting GHL SSO data
// Based on official GHL marketplace app template
let CryptoJS: any;
try {
  CryptoJS = require('crypto-js');
} catch (e) {
  console.warn('[Decrypt] crypto-js not available, decryption will be limited');
}

/**
 * POST /api/ghl/iframe-context/decrypt
 * Decrypt GHL encrypted user data using SSO key
 * 
 * Based on official GHL marketplace app template:
 * https://github.com/GoHighLevel/ghl-marketplace-app-template
 * 
 * GHL sends encrypted user data via postMessage that needs to be decrypted
 * using the GHL_APP_SSO_KEY from your marketplace app settings.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { encryptedData } = body;

    if (!encryptedData) {
      return NextResponse.json(
        { error: 'Encrypted data is required' },
        { status: 400 }
      );
    }

    console.log('[Decrypt] Received encrypted data, type:', typeof encryptedData);
    console.log('[Decrypt] Encrypted data length:', encryptedData?.length || 'N/A');

    const ssoKey = process.env.GHL_APP_SSO_KEY;

    if (!ssoKey) {
      console.warn('[Decrypt] GHL_APP_SSO_KEY not configured, trying to parse as plain JSON');
      // Fallback: try to parse as plain JSON if SSO key not configured
    }

    let userData: any;
    
    // Try to decrypt if we have SSO key and data is a string
    if (ssoKey && typeof encryptedData === 'string' && CryptoJS) {
      try {
        console.log('[Decrypt] Attempting to decrypt using SSO key...');
        // GHL uses CryptoJS.AES.decrypt with the SSO key
        // The encrypted data is typically base64 encoded
        const decrypted = CryptoJS.AES.decrypt(encryptedData, ssoKey).toString(CryptoJS.enc.Utf8);
        
        if (!decrypted || decrypted.trim() === '') {
          console.warn('[Decrypt] Decryption resulted in empty string, trying to parse as JSON directly');
          // Fallback: try to parse as JSON (might be plain JSON, not encrypted)
          try {
            userData = JSON.parse(encryptedData);
          } catch {
            return NextResponse.json(
              { 
                error: 'Decryption resulted in empty string. Check that GHL_APP_SSO_KEY matches your marketplace app SSO key.',
                hint: 'Get your SSO key from: Marketplace App → Settings → SSO Key'
              },
              { status: 400 }
            );
          }
        } else {
          console.log('[Decrypt] Successfully decrypted, parsing JSON...');
          console.log('[Decrypt] Decrypted data length:', decrypted.length);
          userData = JSON.parse(decrypted);
        }
      } catch (decryptError) {
        console.warn('[Decrypt] Decryption failed, trying to parse as plain JSON:', decryptError);
        // Fallback: try to parse as plain JSON (data might not be encrypted)
        try {
          userData = JSON.parse(encryptedData);
          console.log('[Decrypt] Successfully parsed as plain JSON (data was not encrypted)');
        } catch (parseError) {
          return NextResponse.json(
            { 
              error: 'Failed to decrypt or parse user data.',
              details: decryptError instanceof Error ? decryptError.message : 'Unknown error',
              hint: 'Make sure GHL_APP_SSO_KEY is set correctly and matches your marketplace app SSO key'
            },
            { status: 400 }
          );
        }
      }
    } else if (typeof encryptedData === 'string') {
      // No SSO key, try to parse as JSON
      try {
        userData = JSON.parse(encryptedData);
      } catch {
        return NextResponse.json(
          { 
            error: 'Data appears to be encrypted but GHL_APP_SSO_KEY is not configured. Please set GHL_APP_SSO_KEY in your environment variables.',
            hint: 'Get your SSO key from your marketplace app settings in GoHighLevel'
          },
          { status: 400 }
        );
      }
    } else if (typeof encryptedData === 'object') {
      // Data is already an object (may be decrypted already)
      userData = encryptedData;
    } else {
      return NextResponse.json(
        { error: 'Invalid encrypted data format' },
        { status: 400 }
      );
    }
    
    console.log('[Decrypt] User data keys:', Object.keys(userData || {}));

    // Extract locationId and other user data
    // GHL uses 'activeLocation' for the current location (this is the key!)
    const locationId = 
      userData.activeLocation ||  // GHL uses 'activeLocation' for the current location
      userData.locationId || 
      userData.location_id || 
      userData.location?.id || 
      userData.location?.locationId ||
      (userData.context && userData.context.locationId);

    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID not found in user data' },
        { status: 400 }
      );
    }

    // Store the context in the database
    const ghlContext: GHLIframeData = {
      locationId,
      userId: userData.userId || userData.user_id || userData.user?.id,
      companyId: userData.companyId || userData.company_id,
      locationName: userData.locationName || userData.location_name || userData.location?.name,
      userName: userData.userName || userData.user_name || userData.user?.name,
      userEmail: userData.userEmail || userData.user_email || userData.user?.email,
      ...userData,
    };

    // Get or create config for this location
    let config = await getIntegrationConfig(locationId);
    
    if (!config) {
      // Create default config for this location
      config = {
        ghlLocationId: locationId,
        fieldMappings: [],
        enabled: false,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
        syncAppointments: false,
        appointmentSyncInterval: 15,
        appointmentConflictResolution: 'timestamp',
      };
      await storeIntegrationConfig(config, locationId);
    } else if (config.ghlLocationId !== locationId) {
      // Update location ID if it changed
      config.ghlLocationId = locationId;
      await storeIntegrationConfig(config, locationId);
    }

    // Return the decrypted user data
    return NextResponse.json({
      success: true,
      ...ghlContext,
      message: 'User data decrypted and stored successfully',
    });
  } catch (error) {
    console.error('Error decrypting GHL user data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to decrypt user data' },
      { status: 500 }
    );
  }
}


