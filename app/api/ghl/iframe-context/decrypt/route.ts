import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { getIntegrationConfig, storeIntegrationConfig } from '@/lib/db';
import type { GHLIframeData } from '@/lib/ghl-iframe-types';

/**
 * POST /api/ghl/iframe-context/decrypt
 * Decrypt GHL encrypted user data
 * 
 * Note: GHL sends encrypted user data that may need decryption.
 * If the payload is already decrypted or doesn't need decryption,
 * we'll extract the data directly.
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

    // GHL may send the data encrypted or already decrypted
    // Try to parse it directly first
    let userData: any;
    
    if (typeof encryptedData === 'string') {
      try {
        // Try to parse as JSON
        userData = JSON.parse(encryptedData);
      } catch {
        // If it's not JSON, it might be encrypted
        // For now, we'll return an error - you may need to implement decryption
        // based on GHL's encryption method
        return NextResponse.json(
          { 
            error: 'Data appears to be encrypted. Decryption may be required.',
            // Return the encrypted data so frontend can try to use it directly
            encryptedData 
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


