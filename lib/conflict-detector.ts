/**
 * Conflict Detection Service
 * Detects overlapping appointments and duplicate appointments
 */

export interface AppointmentTimeSlot {
  startTime: Date | string;
  endTime: Date | string;
  id?: string | number;
  teamId?: string | number;
  employeeId?: string | number;
}

export interface ConflictResult {
  hasConflict: boolean;
  conflicts: Array<{
    appointment: AppointmentTimeSlot;
    overlapType: 'full' | 'partial' | 'adjacent';
    overlapStart: Date;
    overlapEnd: Date;
  }>;
}

/**
 * Detect overlapping appointments
 * @param appointments Array of existing appointments
 * @param newStartTime Start time of new appointment
 * @param newEndTime End time of new appointment
 * @param bufferMinutes Optional buffer time in minutes (default: 0)
 * @returns Conflict result with overlapping appointments
 */
export function detectOverlaps(
  appointments: AppointmentTimeSlot[],
  newStartTime: Date | string,
  newEndTime: Date | string,
  bufferMinutes: number = 0
): ConflictResult {
  const newStart = typeof newStartTime === 'string' ? new Date(newStartTime) : newStartTime;
  const newEnd = typeof newEndTime === 'string' ? new Date(newEndTime) : newEndTime;
  
  // Apply buffer time
  const bufferedStart = new Date(newStart.getTime() - bufferMinutes * 60 * 1000);
  const bufferedEnd = new Date(newEnd.getTime() + bufferMinutes * 60 * 1000);
  
  const conflicts: ConflictResult['conflicts'] = [];
  
  for (const appointment of appointments) {
    const apptStart = typeof appointment.startTime === 'string' 
      ? new Date(appointment.startTime) 
      : appointment.startTime;
    const apptEnd = typeof appointment.endTime === 'string' 
      ? new Date(appointment.endTime) 
      : appointment.endTime;
    
    // Check for overlap (with buffer)
    if (apptStart < bufferedEnd && apptEnd > bufferedStart) {
      // Determine overlap type
      let overlapType: 'full' | 'partial' | 'adjacent';
      const overlapStart = apptStart > bufferedStart ? apptStart : bufferedStart;
      const overlapEnd = apptEnd < bufferedEnd ? apptEnd : bufferedEnd;
      
      // Check if fully contained
      if (apptStart <= bufferedStart && apptEnd >= bufferedEnd) {
        overlapType = 'full'; // New appointment is fully within existing
      } else if (bufferedStart <= apptStart && bufferedEnd >= apptEnd) {
        overlapType = 'full'; // Existing appointment is fully within new
      } else {
        // Check if adjacent (within buffer time)
        const timeDiff = Math.min(
          Math.abs(apptStart.getTime() - bufferedEnd.getTime()),
          Math.abs(apptEnd.getTime() - bufferedStart.getTime())
        );
        if (timeDiff <= bufferMinutes * 60 * 1000 && timeDiff > 0) {
          overlapType = 'adjacent';
        } else {
          overlapType = 'partial';
        }
      }
      
      conflicts.push({
        appointment,
        overlapType,
        overlapStart,
        overlapEnd,
      });
    }
  }
  
  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

/**
 * Detect duplicate appointments
 * Matches by customer/contact + date/time (within a small time window)
 * @param mcAppointment MaidCentral appointment
 * @param ghlAppointments Array of GHL appointments to check against
 * @param timeWindowMinutes Time window in minutes to consider as duplicate (default: 5)
 * @returns Matching appointment if duplicate found, null otherwise
 */
export function detectDuplicates(
  mcAppointment: any,
  ghlAppointments: any[],
  timeWindowMinutes: number = 5
): any | null {
  const mcCustomerId = mcAppointment.CustomerId || mcAppointment.ContactId || mcAppointment.LeadId;
  const mcEmail = mcAppointment.Email || mcAppointment.CustomerEmail;
  const mcPhone = mcAppointment.Phone || mcAppointment.CustomerPhone;
  const mcStart = new Date(mcAppointment.StartTime || mcAppointment.ScheduledStart || mcAppointment.ServiceDate || mcAppointment.Date);
  const timeWindow = timeWindowMinutes * 60 * 1000;
  
  for (const ghlAppt of ghlAppointments) {
    const ghlContactId = ghlAppt.contactId || ghlAppt.customerId;
    const ghlEmail = ghlAppt.contact?.email || ghlAppt.email;
    const ghlPhone = ghlAppt.contact?.phone || ghlAppt.phone;
    const ghlStart = new Date(ghlAppt.startTime || ghlAppt.start || ghlAppt.date);
    
    // Match by contact ID if available
    if (mcCustomerId && ghlContactId && String(mcCustomerId) === String(ghlContactId)) {
      const timeDiff = Math.abs(mcStart.getTime() - ghlStart.getTime());
      if (timeDiff <= timeWindow) {
        return ghlAppt;
      }
    }
    
    // Match by email if available
    if (mcEmail && ghlEmail && mcEmail.toLowerCase() === ghlEmail.toLowerCase()) {
      const timeDiff = Math.abs(mcStart.getTime() - ghlStart.getTime());
      if (timeDiff <= timeWindow) {
        return ghlAppt;
      }
    }
    
    // Match by phone if available
    if (mcPhone && ghlPhone) {
      // Normalize phone numbers (remove formatting)
      const normalizePhone = (phone: string) => phone.replace(/\D/g, '');
      if (normalizePhone(mcPhone) === normalizePhone(ghlPhone)) {
        const timeDiff = Math.abs(mcStart.getTime() - ghlStart.getTime());
        if (timeDiff <= timeWindow) {
          return ghlAppt;
        }
      }
    }
  }
  
  return null;
}

/**
 * Check if two time slots overlap
 */
export function timeSlotsOverlap(
  start1: Date | string,
  end1: Date | string,
  start2: Date | string,
  end2: Date | string
): boolean {
  const s1 = typeof start1 === 'string' ? new Date(start1) : start1;
  const e1 = typeof end1 === 'string' ? new Date(end1) : end1;
  const s2 = typeof start2 === 'string' ? new Date(start2) : start2;
  const e2 = typeof end2 === 'string' ? new Date(end2) : end2;
  
  return s1 < e2 && e1 > s2;
}

/**
 * Find available time slots within a range
 * @param existingAppointments Array of existing appointments
 * @param startRange Start of time range to search
 * @param endRange End of time range to search
 * @param slotDurationMinutes Duration of desired slot in minutes
 * @param bufferMinutes Buffer time between slots (default: 0)
 * @returns Array of available time slots
 */
export function findAvailableSlots(
  existingAppointments: AppointmentTimeSlot[],
  startRange: Date | string,
  endRange: Date | string,
  slotDurationMinutes: number,
  bufferMinutes: number = 0
): Array<{ start: Date; end: Date }> {
  const rangeStart = typeof startRange === 'string' ? new Date(startRange) : startRange;
  const rangeEnd = typeof endRange === 'string' ? new Date(endRange) : endRange;
  const slotDuration = slotDurationMinutes * 60 * 1000;
  const buffer = bufferMinutes * 60 * 1000;
  
  // Sort appointments by start time
  const sorted = [...existingAppointments].sort((a, b) => {
    const aStart = typeof a.startTime === 'string' ? new Date(a.startTime) : a.startTime;
    const bStart = typeof b.startTime === 'string' ? new Date(b.startTime) : b.startTime;
    return aStart.getTime() - bStart.getTime();
  });
  
  const availableSlots: Array<{ start: Date; end: Date }> = [];
  let currentTime = rangeStart;
  
  for (const appointment of sorted) {
    const apptStart = typeof appointment.startTime === 'string' 
      ? new Date(appointment.startTime) 
      : appointment.startTime;
    const apptEnd = typeof appointment.endTime === 'string' 
      ? new Date(appointment.endTime) 
      : appointment.endTime;
    
    // If there's a gap before this appointment
    if (currentTime.getTime() + slotDuration <= apptStart.getTime() - buffer) {
      // Add available slots in this gap
      let slotStart = currentTime;
      while (slotStart.getTime() + slotDuration <= apptStart.getTime() - buffer) {
        availableSlots.push({
          start: new Date(slotStart),
          end: new Date(slotStart.getTime() + slotDuration),
        });
        slotStart = new Date(slotStart.getTime() + slotDuration + buffer);
      }
    }
    
    // Move current time to after this appointment
    currentTime = apptEnd.getTime() > currentTime.getTime() ? apptEnd : currentTime;
  }
  
  // Check for available slots after the last appointment
  while (currentTime.getTime() + slotDuration <= rangeEnd.getTime()) {
    availableSlots.push({
      start: new Date(currentTime),
      end: new Date(currentTime.getTime() + slotDuration),
    });
    currentTime = new Date(currentTime.getTime() + slotDuration + buffer);
  }
  
  return availableSlots;
}

