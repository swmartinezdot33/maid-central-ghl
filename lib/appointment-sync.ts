/**
 * Appointment Sync Service
 * Handles bidirectional synchronization of appointments between Maid Central and GoHighLevel
 */

import { maidCentralAPI } from './maid-central';
import { maidCentralCustomersAPI } from './maid-central-customers';
import { ghlAPI } from './ghl';
import { mapMaidCentralToGHL, mapGHLToMaidCentral, getAppointmentMatchKey } from './appointment-mapper';
import { 
  storeAppointmentSync, 
  getAppointmentSync, 
  updateSyncTimestamps,
  getAllAppointmentSyncs,
  type AppointmentSync 
} from './db';
import { getIntegrationConfig } from './db';

export interface SyncResult {
  success: boolean;
  mcAppointmentId?: string;
  ghlAppointmentId?: string;
  error?: string;
  action?: 'created' | 'updated' | 'skipped';
}

/**
 * Sync a single Maid Central appointment to GoHighLevel
 */
export async function syncMaidCentralToGHL(mcAppointment: any): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments) {
      return { success: false, error: 'Appointment syncing is disabled' };
    }

    if (!config.ghlCalendarId) {
      return { success: false, error: 'GHL Calendar ID not configured' };
    }

    if (!config.ghlLocationId) {
      return { success: false, error: 'GHL Location ID not configured' };
    }

    const mcAppointmentId = mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id;
    if (!mcAppointmentId) {
      return { success: false, error: 'Maid Central appointment ID is missing' };
    }

    // Check if sync record exists
    const existingSync = await getAppointmentSync(mcAppointmentId, undefined);
    
    // Map MC appointment to GHL format
    const ghlAppointmentData = mapMaidCentralToGHL(mcAppointment);
    
    let ghlAppointmentId: string;
    let action: 'created' | 'updated';

    if (existingSync?.ghlAppointmentId) {
      // Update existing GHL appointment
      const updated = await ghlAPI.updateCalendarAppointment(
        config.ghlCalendarId,
        existingSync.ghlAppointmentId,
        config.ghlLocationId,
        ghlAppointmentData
      );
      ghlAppointmentId = updated.id || updated.appointmentId || existingSync.ghlAppointmentId;
      action = 'updated';
    } else {
      // Create new GHL appointment
      const created = await ghlAPI.createCalendarAppointment(
        config.ghlCalendarId,
        config.ghlLocationId,
        ghlAppointmentData
      );
      ghlAppointmentId = created.id || created.appointmentId;
      action = 'created';
    }

    // Store/update sync record
    const mcLastModified = mcAppointment.LastModified ? new Date(mcAppointment.LastModified) : new Date();
    await storeAppointmentSync({
      maidCentralAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      ghlCalendarId: config.ghlCalendarId,
      maidCentralLastModified: mcLastModified,
      ghlLastModified: new Date(),
      syncDirection: 'mc_to_ghl',
      conflictResolution: config.appointmentConflictResolution || 'timestamp',
    });

    return {
      success: true,
      mcAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      action,
    };
  } catch (error) {
    console.error('[Appointment Sync] Error syncing MC to GHL:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Sync a single GoHighLevel appointment to Maid Central
 */
export async function syncGHLToMaidCentral(ghlAppointment: any): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments) {
      return { success: false, error: 'Appointment syncing is disabled' };
    }

    const ghlAppointmentId = ghlAppointment.id || ghlAppointment.appointmentId;
    if (!ghlAppointmentId) {
      return { success: false, error: 'GHL appointment ID is missing' };
    }

    // Check if sync record exists
    const existingSync = await getAppointmentSync(undefined, String(ghlAppointmentId));
    
    // Map GHL appointment to MC format
    const mcAppointmentData = mapGHLToMaidCentral(ghlAppointment);
    
    let mcAppointmentId: string;
    let action: 'created' | 'updated';

    if (existingSync?.maidCentralAppointmentId) {
      // Update existing MC appointment
      const updated = await maidCentralAPI.updateAppointment(existingSync.maidCentralAppointmentId, mcAppointmentData);
      mcAppointmentId = updated.Id || updated.AppointmentId || existingSync.maidCentralAppointmentId;
      action = 'updated';
    } else {
      // Create new MC appointment using the multi-step Lead > Quote > Book flow
      console.log('[Appointment Sync] Creating new Maid Central appointment from GHL:', ghlAppointmentId);
      
      // Step 1: Customer Lookup/Creation
      let leadId: string | number;
      let customerInfoId: string | number | undefined;
      let homeInfoId: string | number | undefined;

      const email = ghlAppointment.contact?.email || ghlAppointment.email;
      const phone = ghlAppointment.contact?.phone || ghlAppointment.phone;

      if (!email && !phone) {
          throw new Error('GHL appointment missing email and phone. Cannot create Maid Central customer.');
      }

      // Try to find existing customer by email
      let existingCustomer: any = null;
      if (email) {
          const searchResults = await maidCentralCustomersAPI.searchCustomers(email);
          if (Array.isArray(searchResults) && searchResults.length > 0) {
              existingCustomer = searchResults[0];
          }
      }

      if (existingCustomer) {
          console.log('[Appointment Sync] Found existing customer:', existingCustomer.id);
          leadId = existingCustomer.id;
      } 
      
      // Create/Update Lead to ensure we have a valid Lead ID for the quote
      const leadPayload = {
          FirstName: mcAppointmentData.FirstName || 'GHL',
          LastName: mcAppointmentData.LastName || 'User',
          Email: email,
          Phone: phone,
          PostalCode: mcAppointmentData.PostalCode || '00000',
          // Add default fields required by MC
          AllowDuplicates: false
      };
      
      const leadResult = await maidCentralAPI.createLead(leadPayload);
      if (!leadResult?.LeadId) {
          throw new Error('Failed to create/retrieve Lead from Maid Central');
      }
      leadId = leadResult.LeadId;
      customerInfoId = leadResult.CustomerInformationId;
      homeInfoId = leadResult.HomeInformationId;

      console.log('[Appointment Sync] Using Lead ID:', leadId);

      // Step 2: Create Quote
      // We need to map GHL service type/calendar to MC Scope Group
      // For now using a default or looking for a mapped custom field if available
      const serviceType = ghlAppointment.customFields?.find((f: any) => f.key === 'service_type')?.value || 'General Cleaning';
      
      const quotePayload = {
          LeadId: leadId,
          CustomerInformationId: customerInfoId,
          HomeInformationId: homeInfoId,
          ServiceSetId: 1, // Default Service Set
          ScopeGroupId: 1, // Default Scope Group
          FrequencyId: 1, // One Time
      };
      
      // Step 2.5: Availability Check
      // Before creating the quote, let's verify if the slot is actually available (via price calculation which validates slot)
      // This acts as our "Availability Check" since CalculatePrice usually fails for invalid/blocked times
      console.log('[Appointment Sync] Checking availability for:', mcAppointmentData.ScheduledStart);
      const pricePayload = {
          ...quotePayload,
          Date: mcAppointmentData.ScheduledStart,
          StartTime: mcAppointmentData.ScheduledStart,
          EndTime: mcAppointmentData.ScheduledEnd,
      };
      
      try {
          // If this fails, the slot is likely invalid or unavailable
          await maidCentralAPI.calculatePrice(pricePayload);
      } catch (priceError: any) {
          console.error('[Appointment Sync] Availability check failed:', priceError.message);
          throw new Error(`Appointment slot unavailable in Maid Central: ${priceError.message}`);
      }

      const quoteResult = await maidCentralAPI.createOrUpdateQuote(quotePayload);
      const quoteId = quoteResult?.QuoteId || quoteResult?.id;

      if (!quoteId) {
          throw new Error('Failed to create Quote in Maid Central');
      }
      console.log('[Appointment Sync] Created Quote ID:', quoteId);

      // Step 3: Book Quote
      const bookingPayload = {
          QuoteId: quoteId,
          ServiceDate: mcAppointmentData.ScheduledStart,
          StartTime: mcAppointmentData.ScheduledStart,
          EndTime: mcAppointmentData.ScheduledEnd,
          Notes: mcAppointmentData.Notes,
          PaymentMethod: 'Check/Cash', // Default placeholder
      };

      const bookingResult = await maidCentralAPI.createBooking(bookingPayload);
      
      mcAppointmentId = bookingResult?.AppointmentId || bookingResult?.JobId || bookingResult?.id;
      
      if (!mcAppointmentId) {
           console.warn('[Appointment Sync] Booking created but ID not returned directly. Fetching recent appointments...');
           const recentApps = await maidCentralAPI.getAppointments({ leadId: leadId, startDate: mcAppointmentData.ScheduledStart });
           const createdApp = recentApps.find((app: any) => app.QuoteId === quoteId);
           mcAppointmentId = createdApp?.Id || createdApp?.AppointmentId;
      }

      if (!mcAppointmentId) {
          throw new Error('Booking finalized but failed to retrieve new Appointment ID');
      }

      action = 'created';
    }

    // Store/update sync record
    const ghlLastModified = ghlAppointment.updatedAt ? new Date(ghlAppointment.updatedAt) : new Date();
    await storeAppointmentSync({
      maidCentralAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      ghlCalendarId: ghlAppointment.calendarId || config.ghlCalendarId,
      maidCentralLastModified: new Date(),
      ghlLastModified: ghlLastModified,
      syncDirection: 'ghl_to_mc',
      conflictResolution: config.appointmentConflictResolution || 'timestamp',
    });

    return {
      success: true,
      mcAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      action,
    };
  } catch (error) {
    console.error('[Appointment Sync] Error syncing GHL to MC:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Perform full bidirectional sync of all appointments
 */
export async function syncAllAppointments(): Promise<{ synced: number; errors: number; results: SyncResult[] }> {
  const results: SyncResult[] = [];
  let synced = 0;
  let errors = 0;

  try {
    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments) {
      return { synced: 0, errors: 0, results: [] };
    }

    if (!config.ghlCalendarId || !config.ghlLocationId) {
      return { synced: 0, errors: 0, results: [] };
    }

    // Fetch all appointments from both systems
    // Get last 30 days by default for historical sync + future
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];

    const [mcAppointments, ghlAppointments] = await Promise.all([
      maidCentralAPI.getAppointments({ startDate: startDateStr }),
      ghlAPI.getCalendarAppointments(config.ghlCalendarId, config.ghlLocationId, { startDate: startDateStr }),
    ]);

    // Create a map of existing syncs by MC ID and GHL ID
    const existingSyncs = await getAllAppointmentSyncs();
    const mcSyncMap = new Map<string, AppointmentSync>();
    const ghlSyncMap = new Map<string, AppointmentSync>();
    
    existingSyncs.forEach(sync => {
      if (sync.maidCentralAppointmentId) {
        mcSyncMap.set(sync.maidCentralAppointmentId, sync);
      }
      if (sync.ghlAppointmentId) {
        ghlSyncMap.set(sync.ghlAppointmentId, sync);
      }
    });

    // 1. Sync MC appointments to GHL (New & Updates)
    for (const mcAppointment of mcAppointments) {
      const mcId = String(mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id);
      const existingSync = mcSyncMap.get(mcId);
      
      const mcModified = mcAppointment.LastModified ? new Date(mcAppointment.LastModified) : new Date();
      const lastSynced = existingSync?.maidCentralLastModified;

      // Sync if:
      // - It's new (no sync record)
      // - It's updated (MC modified time > last synced time)
      if (!existingSync || (lastSynced && mcModified > lastSynced)) {
        const result = await syncMaidCentralToGHL(mcAppointment);
        results.push(result);
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      }
    }

    // 2. Sync GHL appointments to MC (New & Updates)
    for (const ghlAppointment of ghlAppointments) {
      const ghlId = String(ghlAppointment.id || ghlAppointment.appointmentId);
      const existingSync = ghlSyncMap.get(ghlId);
      
      const ghlModified = ghlAppointment.updatedAt ? new Date(ghlAppointment.updatedAt) : new Date();
      const lastSynced = existingSync?.ghlLastModified;

      // Sync if:
      // - It's new (no sync record)
      // - It's updated (GHL modified time > last synced time)
      // AND we haven't already processed it via the MC loop above (bidirectional check)
      if (!existingSync || (lastSynced && ghlModified > lastSynced)) {
        const result = await syncGHLToMaidCentral(ghlAppointment);
        results.push(result);
        if (result.success) {
          synced++;
        } else {
          errors++;
        }
      }
    }

    return { synced, errors, results };
  } catch (error) {
    console.error('[Appointment Sync] Error in full sync:', error);
    return { synced, errors: errors + 1, results };
  }
}

/**
 * Resolve conflicts between MC and GHL appointments
 */
export async function resolveConflict(
  mcAppointment: any,
  ghlAppointment: any,
  strategy: 'maid_central_wins' | 'ghl_wins' | 'timestamp' = 'timestamp'
): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig();
    
    if (!config.ghlCalendarId || !config.ghlLocationId) {
      return { success: false, error: 'GHL Calendar or Location ID not configured' };
    }

    const mcId = String(mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id);
    const ghlId = String(ghlAppointment.id || ghlAppointment.appointmentId);
    const sync = await getAppointmentSync(mcId, ghlId);

    if (!sync) {
      return { success: false, error: 'Sync record not found' };
    }

    let shouldUpdateGHL = false;
    let shouldUpdateMC = false;

    // Determine which system's data to use based on strategy
    if (strategy === 'maid_central_wins') {
      shouldUpdateGHL = true;
    } else if (strategy === 'ghl_wins') {
      shouldUpdateMC = true;
    } else if (strategy === 'timestamp') {
      // Use most recent modification
      const mcTime = sync.maidCentralLastModified?.getTime() || 0;
      const ghlTime = sync.ghlLastModified?.getTime() || 0;
      if (mcTime > ghlTime) {
        shouldUpdateGHL = true;
      } else {
        shouldUpdateMC = true;
      }
    }

    // Update the system that should receive changes
    if (shouldUpdateGHL) {
      const ghlData = mapMaidCentralToGHL(mcAppointment);
      await ghlAPI.updateCalendarAppointment(config.ghlCalendarId, ghlId, config.ghlLocationId, ghlData);
      await updateSyncTimestamps(mcId, ghlId, new Date(), new Date());
    } else if (shouldUpdateMC) {
      const mcData = mapGHLToMaidCentral(ghlAppointment);
      await maidCentralAPI.updateAppointment(mcId, mcData);
      await updateSyncTimestamps(mcId, ghlId, new Date(), new Date());
    }

    return {
      success: true,
      mcAppointmentId: mcId,
      ghlAppointmentId: ghlId,
      action: 'updated',
    };
  } catch (error) {
    console.error('[Appointment Sync] Error resolving conflict:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
