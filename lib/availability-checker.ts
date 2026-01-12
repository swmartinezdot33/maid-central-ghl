/**
 * Availability Checking Service
 * Provides comprehensive availability checking across all MaidCentral teams
 */

import { maidCentralAPI } from './maid-central';
import { detectOverlaps, type AppointmentTimeSlot, findAvailableSlots } from './conflict-detector';
import { getAllTeamCalendarMappings } from './db';

export interface AvailabilityCheckResult {
  available: boolean;
  conflicts: Array<{
    teamId: string;
    teamName?: string;
    appointment: any;
    overlapType: 'full' | 'partial' | 'adjacent';
  }>;
  availableTeams: Array<{
    teamId: string;
    teamName?: string;
  }>;
}

export interface TeamAvailabilityResult {
  teamId: string;
  teamName?: string;
  available: boolean;
  conflicts: any[];
}

/**
 * Check availability across all MaidCentral teams for a time slot
 * @param startTime Start time of the appointment
 * @param endTime End time of the appointment
 * @param locationId Location ID for multi-tenant support
 * @param excludeAppointmentIds Array of appointment IDs to exclude from conflict check
 * @param bufferMinutes Buffer time in minutes to consider around appointments (default: 0)
 * @returns Availability check result with conflicts and available teams
 */
export async function checkAvailability(
  startTime: string | Date,
  endTime: string | Date,
  locationId: string,
  excludeAppointmentIds?: Array<string | number>,
  bufferMinutes: number = 0
): Promise<AvailabilityCheckResult> {
  try {
    // Use MaidCentral API's built-in availability check
    const availabilityResult = await maidCentralAPI.checkAvailabilityAcrossTeams(
      startTime,
      endTime,
      excludeAppointmentIds?.[0], // API only supports single exclude, use first if multiple
      locationId
    );
    
    // Get all teams to identify available ones
    const teams = await maidCentralAPI.getTeams(locationId);
    
    // Get all appointments in the time range for detailed conflict detection
    const startDate = typeof startTime === 'string' ? startTime : startTime.toISOString().split('T')[0];
    const endDate = typeof endTime === 'string' ? endTime : endTime.toISOString().split('T')[0];
    const allAppointments = await maidCentralAPI.getAppointments(
      { startDate, endDate },
      locationId
    );
    
    // Filter out excluded appointments
    const relevantAppointments = excludeAppointmentIds
      ? allAppointments.filter((appt: any) => {
          const apptId = appt.Id || appt.AppointmentId || appt.id;
          return !excludeAppointmentIds.some(exId => String(apptId) === String(exId));
        })
      : allAppointments;
    
    // Convert to AppointmentTimeSlot format for conflict detection
    const appointmentSlots: AppointmentTimeSlot[] = relevantAppointments.map((appt: any) => ({
      startTime: appt.StartTime || appt.ScheduledStart || appt.ServiceDate || appt.Date,
      endTime: appt.EndTime || appt.ScheduledEnd || appt.ServiceEndTime,
      id: appt.Id || appt.AppointmentId || appt.id,
      teamId: appt.TeamId || appt.teamId || appt.EmployeeId || appt.employeeId,
      employeeId: appt.EmployeeId || appt.employeeId || appt.AssignedToId || appt.assignedToId,
    }));
    
    // Use conflict detector for detailed overlap analysis
    const conflictResult = detectOverlaps(appointmentSlots, startTime, endTime, bufferMinutes);
    
    // Build conflicts with team information
    const conflicts = conflictResult.conflicts.map(conflict => {
      const teamId = conflict.appointment.teamId || 'unknown';
      const team = teams.find((t: any) => String(t.Id || t.id || t.TeamId || t.teamId) === String(teamId));
      const teamName = team?.Name || team?.name || team?.TeamName || team?.teamName;
      
      // Find the original appointment data
      const originalAppt = relevantAppointments.find((appt: any) => {
        const apptId = appt.Id || appt.AppointmentId || appt.id;
        return String(apptId) === String(conflict.appointment.id);
      });
      
      return {
        teamId: String(teamId),
        teamName,
        appointment: originalAppt || conflict.appointment,
        overlapType: conflict.overlapType,
      };
    });
    
    // Find available teams (teams that don't have conflicts)
    const conflictingTeamIds = new Set(conflicts.map(c => c.teamId));
    const availableTeams = teams
      .filter((team: any) => {
        const teamId = String(team.Id || team.id || team.TeamId || team.teamId);
        return !conflictingTeamIds.has(teamId);
      })
      .map((team: any) => ({
        teamId: String(team.Id || team.id || team.TeamId || team.teamId),
        teamName: team.Name || team.name || team.TeamName || team.teamName,
      }));
    
    return {
      available: conflicts.length === 0,
      conflicts,
      availableTeams,
    };
  } catch (error) {
    console.error('[Availability Checker] Error checking availability:', error);
    // On error, assume not available to be safe
    return {
      available: false,
      conflicts: [],
      availableTeams: [],
    };
  }
}

/**
 * Check availability for a specific team
 * @param teamId Team ID to check
 * @param startTime Start time of the appointment
 * @param endTime End time of the appointment
 * @param locationId Location ID
 * @param excludeAppointmentId Appointment ID to exclude from check
 * @param bufferMinutes Buffer time in minutes
 * @returns Team availability result
 */
export async function checkTeamAvailability(
  teamId: string | number,
  startTime: string | Date,
  endTime: string | Date,
  locationId: string,
  excludeAppointmentId?: string | number,
  bufferMinutes: number = 0
): Promise<TeamAvailabilityResult> {
  try {
    // Get team appointments
    const startDate = typeof startTime === 'string' ? startTime : startTime.toISOString().split('T')[0];
    const endDate = typeof endTime === 'string' ? endTime : endTime.toISOString().split('T')[0];
    const teamAppointments = await maidCentralAPI.getTeamAppointments(
      teamId,
      { startDate, endDate },
      locationId
    );
    
    // Filter out excluded appointment
    const relevantAppointments = excludeAppointmentId
      ? teamAppointments.filter((appt: any) => {
          const apptId = appt.Id || appt.AppointmentId || appt.id;
          return String(apptId) !== String(excludeAppointmentId);
        })
      : teamAppointments;
    
    // Convert to AppointmentTimeSlot format
    const appointmentSlots: AppointmentTimeSlot[] = relevantAppointments.map((appt: any) => ({
      startTime: appt.StartTime || appt.ScheduledStart || appt.ServiceDate || appt.Date,
      endTime: appt.EndTime || appt.ScheduledEnd || appt.ServiceEndTime,
      id: appt.Id || appt.AppointmentId || appt.id,
      teamId: String(teamId),
    }));
    
    // Check for conflicts
    const conflictResult = detectOverlaps(appointmentSlots, startTime, endTime, bufferMinutes);
    
    // Get team name
    const teams = await maidCentralAPI.getTeams(locationId);
    const team = teams.find((t: any) => String(t.Id || t.id || t.TeamId || t.teamId) === String(teamId));
    const teamName = team?.Name || team?.name || team?.TeamName || team?.teamName;
    
    return {
      teamId: String(teamId),
      teamName,
      available: !conflictResult.hasConflict,
      conflicts: conflictResult.conflicts.map(c => c.appointment),
    };
  } catch (error) {
    console.error(`[Availability Checker] Error checking team ${teamId} availability:`, error);
    return {
      teamId: String(teamId),
      available: false,
      conflicts: [],
    };
  }
}

/**
 * Find available teams for a time slot
 * @param startTime Start time of the appointment
 * @param endTime End time of the appointment
 * @param locationId Location ID
 * @param excludeAppointmentIds Appointment IDs to exclude
 * @param bufferMinutes Buffer time in minutes
 * @returns Array of available team IDs
 */
export async function findAvailableTeams(
  startTime: string | Date,
  endTime: string | Date,
  locationId: string,
  excludeAppointmentIds?: Array<string | number>,
  bufferMinutes: number = 0
): Promise<Array<{ teamId: string; teamName?: string }>> {
  const availabilityResult = await checkAvailability(
    startTime,
    endTime,
    locationId,
    excludeAppointmentIds,
    bufferMinutes
  );
  
  return availabilityResult.availableTeams;
}

/**
 * Check if a specific time slot is available for any team
 * @param startTime Start time
 * @param endTime End time
 * @param locationId Location ID
 * @param excludeAppointmentIds Appointment IDs to exclude
 * @param bufferMinutes Buffer time
 * @returns True if at least one team is available
 */
export async function isTimeSlotAvailable(
  startTime: string | Date,
  endTime: string | Date,
  locationId: string,
  excludeAppointmentIds?: Array<string | number>,
  bufferMinutes: number = 0
): Promise<boolean> {
  const availabilityResult = await checkAvailability(
    startTime,
    endTime,
    locationId,
    excludeAppointmentIds,
    bufferMinutes
  );
  
  return availabilityResult.available;
}



