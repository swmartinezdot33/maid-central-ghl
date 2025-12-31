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
  type AppointmentSync,
  getTeamForGHLCalendar,
  getGHLCalendarForTeam,
  getAllTeamCalendarMappings,
} from './db';
import { getIntegrationConfig } from './db';
import { checkAvailability, findAvailableTeams } from './availability-checker';
import { detectDuplicates } from './conflict-detector';

export interface SyncResult {
  success: boolean;
  mcAppointmentId?: string;
  ghlAppointmentId?: string;
  error?: string;
  action?: 'created' | 'updated' | 'skipped';
}

/**
 * Sync a single Maid Central appointment to GoHighLevel
 * Uses team-to-calendar mapping to determine which GHL calendar to sync to
 */
export async function syncMaidCentralToGHL(mcAppointment: any, locationId?: string): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled) {
      return { success: false, error: 'Integration is disabled' };
    }
    
    if (!config?.syncAppointments) {
      return { success: false, error: 'Appointment syncing is disabled' };
    }

    if (!config.ghlLocationId) {
      return { success: false, error: 'GHL Location ID not configured' };
    }

    const mcAppointmentId = mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id;
    if (!mcAppointmentId) {
      return { success: false, error: 'Maid Central appointment ID is missing' };
    }

    // Extract team/employee info from MC appointment
    const mcTeamId = mcAppointment.TeamId || mcAppointment.teamId || mcAppointment.EmployeeId || mcAppointment.employeeId || mcAppointment.AssignedToId || mcAppointment.assignedToId;
    const mcEmployeeId = mcAppointment.EmployeeId || mcAppointment.employeeId || mcAppointment.AssignedToId || mcAppointment.assignedToId;

    // Find corresponding GHL calendar using team mapping
    let ghlCalendarId: string | null = null;
    if (mcTeamId && locationId) {
      ghlCalendarId = await getGHLCalendarForTeam(locationId, String(mcTeamId));
    }

    // Fallback to default calendar if no mapping found
    if (!ghlCalendarId) {
      ghlCalendarId = config.ghlCalendarId || null;
      if (!ghlCalendarId) {
        return { success: false, error: 'GHL Calendar ID not configured and no team mapping found' };
      }
      console.log(`[Appointment Sync] No team mapping found for team ${mcTeamId}, using default calendar ${ghlCalendarId}`);
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
        ghlCalendarId,
        existingSync.ghlAppointmentId,
        config.ghlLocationId,
        ghlAppointmentData
      );
      ghlAppointmentId = updated.id || updated.appointmentId || existingSync.ghlAppointmentId;
      action = 'updated';
    } else {
      // Create new GHL appointment
      const created = await ghlAPI.createCalendarAppointment(
        ghlCalendarId,
        config.ghlLocationId,
        ghlAppointmentData
      );
      ghlAppointmentId = created.id || created.appointmentId;
      action = 'created';
    }

    // Store/update sync record with team info
    const mcLastModified = mcAppointment.LastModified ? new Date(mcAppointment.LastModified) : new Date();
    await storeAppointmentSync({
      maidCentralAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      ghlCalendarId: ghlCalendarId,
      teamId: mcTeamId ? String(mcTeamId) : undefined,
      employeeId: mcEmployeeId ? String(mcEmployeeId) : undefined,
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
export async function syncGHLToMaidCentral(ghlAppointment: any, locationId?: string): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled) {
      return { success: false, error: 'Integration is disabled' };
    }
    
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
      
      // Step 2.5: Availability Check across all teams
      // Check availability before creating appointment to prevent conflicts
      console.log('[Appointment Sync] Checking availability across all teams for:', mcAppointmentData.ScheduledStart);
      
      if (!locationId) {
        throw new Error('Location ID is required for availability checking');
      }
      
      const availabilityResult = await checkAvailability(
        mcAppointmentData.ScheduledStart,
        mcAppointmentData.ScheduledEnd,
        locationId,
        existingSync?.maidCentralAppointmentId ? [existingSync.maidCentralAppointmentId] : undefined
      );
      
      if (!availabilityResult.available) {
        const conflictDetails = availabilityResult.conflicts.map(c => 
          `Team ${c.teamName || c.teamId}: ${c.appointment.Id || c.appointment.AppointmentId || 'unknown'}`
        ).join(', ');
        throw new Error(`Appointment slot conflicts with existing appointments: ${conflictDetails}`);
      }
      
      // Determine which team to assign based on GHL calendar mapping
      let assignedTeamId: string | number | undefined;
      const ghlCalendarId = ghlAppointment.calendarId || config.ghlCalendarId;
      if (ghlCalendarId && locationId) {
        const teamMapping = await getTeamForGHLCalendar(locationId, ghlCalendarId);
        if (teamMapping) {
          assignedTeamId = teamMapping.maidCentralTeamId;
          console.log(`[Appointment Sync] Assigning to team ${teamMapping.maidCentralTeamName} (${assignedTeamId}) based on calendar mapping`);
        }
      }
      
      // If no mapping found, try to find an available team
      if (!assignedTeamId && availabilityResult.availableTeams.length > 0) {
        assignedTeamId = availabilityResult.availableTeams[0].teamId;
        console.log(`[Appointment Sync] No calendar mapping found, using first available team: ${assignedTeamId}`);
      }
      
      // If still no team, use default or throw error
      if (!assignedTeamId) {
        console.warn('[Appointment Sync] No team assignment available, proceeding without team assignment');
      }
      
      // Enhanced availability check with team assignment
      const pricePayload = {
          ...quotePayload,
          Date: mcAppointmentData.ScheduledStart,
          StartTime: mcAppointmentData.ScheduledStart,
          EndTime: mcAppointmentData.ScheduledEnd,
          TeamId: assignedTeamId, // Include team ID if available
      };
      
      try {
          // If this fails, the slot is likely invalid or unavailable
          await maidCentralAPI.calculatePrice(pricePayload);
      } catch (priceError: any) {
          console.error('[Appointment Sync] Price calculation/availability check failed:', priceError.message);
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

    // Extract team info from created appointment
    const createdAppointment = await maidCentralAPI.getAppointment(mcAppointmentId, locationId).catch(() => null);
    const mcTeamId = createdAppointment?.TeamId || createdAppointment?.teamId || createdAppointment?.EmployeeId || createdAppointment?.employeeId;
    const mcEmployeeId = createdAppointment?.EmployeeId || createdAppointment?.employeeId;
    
    // Store/update sync record with team info
    const ghlLastModified = ghlAppointment.updatedAt ? new Date(ghlAppointment.updatedAt) : new Date();
    await storeAppointmentSync({
      maidCentralAppointmentId: String(mcAppointmentId),
      ghlAppointmentId: String(ghlAppointmentId),
      ghlCalendarId: ghlAppointment.calendarId || config.ghlCalendarId,
      teamId: mcTeamId ? String(mcTeamId) : undefined,
      employeeId: mcEmployeeId ? String(mcEmployeeId) : undefined,
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
 * Sync appointments for all teams
 * Iterates through all team mappings and syncs appointments for each team to its mapped calendar
 */
export async function syncAllTeamsAppointments(locationId?: string): Promise<{ synced: number; errors: number; results: SyncResult[] }> {
  const results: SyncResult[] = [];
  let synced = 0;
  let errors = 0;

  try {
    if (!locationId) {
      return { synced: 0, errors: 0, results: [] };
    }

    const config = await getIntegrationConfig(locationId);
    
    if (!config?.syncAppointments) {
      return { synced: 0, errors: 0, results: [] };
    }

    // Get all team mappings
    const teamMappings = await getAllTeamCalendarMappings(locationId);
    const enabledMappings = teamMappings.filter(m => m.enabled);

    if (enabledMappings.length === 0) {
      console.log('[Appointment Sync] No enabled team mappings found');
      return { synced: 0, errors: 0, results: [] };
    }

    // Get last 30 days for historical sync + future
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const startDateStr = startDate.toISOString().split('T')[0];

    // Sync appointments for each team
    for (const mapping of enabledMappings) {
      try {
        console.log(`[Appointment Sync] Syncing team ${mapping.maidCentralTeamName} (${mapping.maidCentralTeamId}) to calendar ${mapping.ghlCalendarName} (${mapping.ghlCalendarId})`);
        
        // Get appointments for this team
        const teamAppointments = await maidCentralAPI.getTeamAppointments(
          mapping.maidCentralTeamId,
          { startDate: startDateStr },
          locationId
        );

        // Get existing syncs for this team
        const existingSyncs = await getAllAppointmentSyncs();
        const teamSyncMap = new Map<string, AppointmentSync>();
        existingSyncs.forEach(sync => {
          if (sync.teamId === mapping.maidCentralTeamId && sync.maidCentralAppointmentId) {
            teamSyncMap.set(sync.maidCentralAppointmentId, sync);
          }
        });

        // Sync each appointment
        for (const mcAppointment of teamAppointments) {
          const mcId = String(mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id);
          const existingSync = teamSyncMap.get(mcId);
          
          const mcModified = mcAppointment.LastModified ? new Date(mcAppointment.LastModified) : new Date();
          const lastSynced = existingSync?.maidCentralLastModified;

          // Sync if new or updated
          if (!existingSync || (lastSynced && mcModified > lastSynced)) {
            // Temporarily override calendar ID for this sync
            const originalCalendarId = config.ghlCalendarId;
            config.ghlCalendarId = mapping.ghlCalendarId;
            
            const result = await syncMaidCentralToGHL(mcAppointment, locationId);
            results.push(result);
            
            // Restore original calendar ID
            config.ghlCalendarId = originalCalendarId;
            
            if (result.success) {
              synced++;
            } else {
              errors++;
            }
          }
        }
      } catch (error) {
        console.error(`[Appointment Sync] Error syncing team ${mapping.maidCentralTeamId}:`, error);
        errors++;
      }
    }

    return { synced, errors, results };
  } catch (error) {
    console.error('[Appointment Sync] Error in team sync:', error);
    return { synced, errors: errors + 1, results };
  }
}

/**
 * Perform full bidirectional sync of all appointments
 * Now uses team mappings when available
 */
export async function syncAllAppointments(locationId?: string): Promise<{ synced: number; errors: number; results: SyncResult[] }> {
  const results: SyncResult[] = [];
  let synced = 0;
  let errors = 0;

  try {
    const config = await getIntegrationConfig(locationId);
    
    if (!config?.enabled) {
      console.log(`[Appointment Sync] Integration is disabled for location ${locationId}`);
      return { synced: 0, errors: 0, results: [] };
    }
    
    if (!config?.syncAppointments) {
      console.log(`[Appointment Sync] Appointment syncing is disabled for location ${locationId}`);
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
      maidCentralAPI.getAppointments({ startDate: startDateStr }, locationId),
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
    // Use team-based sync if mappings exist, otherwise use default calendar
    const teamMappings = locationId ? await getAllTeamCalendarMappings(locationId) : [];
    const hasTeamMappings = teamMappings.length > 0;

    if (hasTeamMappings) {
      // Use team-based sync
      const teamSyncResult = await syncAllTeamsAppointments(locationId);
      synced += teamSyncResult.synced;
      errors += teamSyncResult.errors;
      results.push(...teamSyncResult.results);
    } else {
      // Fallback to original sync method
      for (const mcAppointment of mcAppointments) {
        const mcId = String(mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.id);
        const existingSync = mcSyncMap.get(mcId);
        
        const mcModified = mcAppointment.LastModified ? new Date(mcAppointment.LastModified) : new Date();
        const lastSynced = existingSync?.maidCentralLastModified;

        // Sync if:
        // - It's new (no sync record)
        // - It's updated (MC modified time > last synced time)
        if (!existingSync || (lastSynced && mcModified > lastSynced)) {
          const result = await syncMaidCentralToGHL(mcAppointment, locationId);
          results.push(result);
          if (result.success) {
            synced++;
          } else {
            errors++;
          }
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
        const result = await syncGHLToMaidCentral(ghlAppointment, locationId);
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
  strategy: 'maid_central_wins' | 'ghl_wins' | 'timestamp' = 'timestamp',
  locationId?: string
): Promise<SyncResult> {
  try {
    const config = await getIntegrationConfig(locationId);
    
    if (!config || !config.ghlCalendarId || !config.ghlLocationId) {
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
