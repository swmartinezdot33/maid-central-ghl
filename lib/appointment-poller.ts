/**
 * Appointment Poller Service
 * Polls both Maid Central and GoHighLevel for new/updated appointments
 * Used as a fallback when webhooks are not available
 */

import { maidCentralAPI } from './maid-central';
import { ghlAPI } from './ghl';
import { syncMaidCentralToGHL, syncGHLToMaidCentral } from './appointment-sync';
import { getAppointmentSync, getAllAppointmentSyncs } from './db';
import { getIntegrationConfig } from './db';

export interface PollResult {
  mcSynced: number;
  ghlSynced: number;
  mcErrors: number;
  ghlErrors: number;
  totalProcessed: number;
}

/**
 * Poll Maid Central for recent appointments and sync to GHL
 */
export async function pollMaidCentralAppointments(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments || !config.ghlCalendarId) {
      return { synced: 0, errors: 0 };
    }

    // Get last sync time from existing syncs to only fetch new/updated appointments
    const existingSyncs = await getAllAppointmentSyncs();
    const lastSyncTime = existingSyncs.length > 0 && existingSyncs[0].updatedAt
      ? existingSyncs[0].updatedAt
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours

    // Fetch appointments from Maid Central (modified since last sync)
    const mcAppointments = await maidCentralAPI.getAppointments({
      startDate: lastSyncTime.toISOString().split('T')[0],
    });

    // Sync each appointment
    for (const appointment of mcAppointments) {
      try {
        const sync = await getAppointmentSync(String(appointment.Id || appointment.AppointmentId || appointment.id), undefined);
        const appointmentModified = appointment.LastModified 
          ? new Date(appointment.LastModified)
          : new Date();

        // Only sync if appointment is new or has been modified since last sync
        if (!sync || (sync.maidCentralLastModified && appointmentModified > sync.maidCentralLastModified)) {
          const result = await syncMaidCentralToGHL(appointment);
          if (result.success) {
            synced++;
          } else {
            errors++;
            console.error(`[Poll] Failed to sync MC appointment ${appointment.Id}:`, result.error);
          }
        }
      } catch (error) {
        errors++;
        console.error(`[Poll] Error syncing MC appointment:`, error);
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error('[Poll] Error polling Maid Central appointments:', error);
    return { synced, errors: errors + 1 };
  }
}

/**
 * Poll GoHighLevel for recent appointments and sync to Maid Central
 */
export async function pollGHLAppointments(): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;

  try {
    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments || !config.ghlCalendarId || !config.ghlLocationId) {
      return { synced: 0, errors: 0 };
    }

    // Get last sync time from existing syncs
    const existingSyncs = await getAllAppointmentSyncs();
    const lastSyncTime = existingSyncs.length > 0 && existingSyncs[0].updatedAt
      ? existingSyncs[0].updatedAt
      : new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to last 24 hours

    // Fetch appointments from GHL (modified since last sync)
    const ghlAppointments = await ghlAPI.getCalendarAppointments(
      config.ghlCalendarId,
      config.ghlLocationId,
      {
        startDate: lastSyncTime.toISOString().split('T')[0],
      }
    );

    // Sync each appointment
    for (const appointment of ghlAppointments) {
      try {
        const appointmentId = String(appointment.id || appointment.appointmentId);
        const sync = await getAppointmentSync(undefined, appointmentId);
        const appointmentModified = appointment.updatedAt 
          ? new Date(appointment.updatedAt)
          : appointment.modifiedAt
          ? new Date(appointment.modifiedAt)
          : new Date();

        // Only sync if appointment is new or has been modified since last sync
        if (!sync || (sync.ghlLastModified && appointmentModified > sync.ghlLastModified)) {
          const result = await syncGHLToMaidCentral(appointment);
          if (result.success) {
            synced++;
          } else {
            errors++;
            console.error(`[Poll] Failed to sync GHL appointment ${appointmentId}:`, result.error);
          }
        }
      } catch (error) {
        errors++;
        console.error(`[Poll] Error syncing GHL appointment:`, error);
      }
    }

    return { synced, errors };
  } catch (error) {
    console.error('[Poll] Error polling GHL appointments:', error);
    return { synced, errors: errors + 1 };
  }
}

/**
 * Run full poll of both systems
 */
export async function pollAllAppointments(): Promise<PollResult> {
  const [mcResult, ghlResult] = await Promise.all([
    pollMaidCentralAppointments(),
    pollGHLAppointments(),
  ]);

  return {
    mcSynced: mcResult.synced,
    ghlSynced: ghlResult.synced,
    mcErrors: mcResult.errors,
    ghlErrors: ghlResult.errors,
    totalProcessed: mcResult.synced + ghlResult.synced + mcResult.errors + ghlResult.errors,
  };
}











