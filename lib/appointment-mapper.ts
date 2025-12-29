/**
 * Appointment Mapper
 * Transforms appointment data between Maid Central and GoHighLevel formats
 * 
 * Note: In Maid Central, appointments are booked quotes within leads.
 * The booking information comes from the Lead/Quote structure after BookQuote is called.
 * Reference: https://support.maidcentral.com/apidocs/online-booking-to-api-workflow
 */

/**
 * Map Maid Central appointment (Lead with booked Quote) to GoHighLevel calendar appointment format
 */
export function mapMaidCentralToGHL(mcAppointment: any): any {
  // Extract common fields from Maid Central appointment/lead/quote
  // Maid Central structure: Lead contains Quote, Quote can be Booked (becomes appointment)
  // Field names based on Maid Central Lead API response structure
  
  const ghlAppointment: any = {
    // Basic appointment info
    title: mcAppointment.ServiceName || mcAppointment.Title || 'Service Appointment',
    description: mcAppointment.Notes || mcAppointment.Description || '',
    
    // Date and time
    // From booked quote/lead structure
    startTime: mcAppointment.StartTime || mcAppointment.ScheduledStart || mcAppointment.ServiceDate || mcAppointment.Date || mcAppointment.ScheduledDate,
    endTime: mcAppointment.EndTime || mcAppointment.ScheduledEnd || mcAppointment.ServiceEndTime,
    
    // Customer/Contact information (will need to be linked to GHL contact)
    contactId: mcAppointment.ContactId || mcAppointment.CustomerId, // If available
    
    // Address (if applicable)
    address: mcAppointment.Address || mcAppointment.ServiceAddress,
    city: mcAppointment.City,
    state: mcAppointment.State || mcAppointment.Region,
    postalCode: mcAppointment.PostalCode || mcAppointment.ZipCode,
    
    // Status
    status: mapMCStatusToGHL(mcAppointment.Status || mcAppointment.StatusName),
    
    // Additional metadata (as custom fields if needed)
    metadata: {
      maidCentralAppointmentId: mcAppointment.Id || mcAppointment.AppointmentId || mcAppointment.BookingId,
      maidCentralQuoteId: mcAppointment.QuoteId || mcAppointment.Id, // Quote ID when booked
      maidCentralLeadId: mcAppointment.LeadId,
      serviceType: mcAppointment.ServiceType || mcAppointment.ScopeGroupName || mcAppointment.ScopeGroup,
      teamId: mcAppointment.TeamId || mcAppointment.AssignedTeamId,
      assignedTo: mcAppointment.AssignedTo || mcAppointment.Technician || mcAppointment.AssignedTechnician,
      // Maid Central specific fields
      customerInformationId: mcAppointment.CustomerInformationId,
      homeInformationId: mcAppointment.HomeInformationId,
    },
  };

  // Remove undefined/null fields
  Object.keys(ghlAppointment).forEach(key => {
    if (ghlAppointment[key] === undefined || ghlAppointment[key] === null) {
      delete ghlAppointment[key];
    }
  });

  return ghlAppointment;
}

/**
 * Map GoHighLevel calendar appointment to Maid Central appointment format
 */
export function mapGHLToMaidCentral(ghlAppointment: any): any {
  // Extract common fields from GHL appointment
  // NOTE: Field names need to be verified with actual GHL API response structure
  
  const mcAppointment: any = {
    // Basic appointment info
    Title: ghlAppointment.title || ghlAppointment.name || 'Service Appointment',
    Notes: ghlAppointment.description || ghlAppointment.notes || '',
    
    // Date and time
    ScheduledStart: ghlAppointment.startTime || ghlAppointment.start || ghlAppointment.date,
    ScheduledEnd: ghlAppointment.endTime || ghlAppointment.end,
    Date: ghlAppointment.startTime || ghlAppointment.start || ghlAppointment.date,
    
    // Customer information
    CustomerId: ghlAppointment.contactId || ghlAppointment.customerId,
    Email: ghlAppointment.contact?.email || ghlAppointment.email,
    Phone: ghlAppointment.contact?.phone || ghlAppointment.phone,
    FirstName: ghlAppointment.contact?.firstName || ghlAppointment.firstName,
    LastName: ghlAppointment.contact?.lastName || ghlAppointment.lastName,
    
    // Address
    Address: ghlAppointment.address || ghlAppointment.address1,
    City: ghlAppointment.city,
    State: ghlAppointment.state || ghlAppointment.region,
    PostalCode: ghlAppointment.postalCode || ghlAppointment.zipCode,
    
    // Status
    Status: mapGHLStatusToMC(ghlAppointment.status),
    
    // Additional metadata
    GHLAppointmentId: ghlAppointment.id || ghlAppointment.appointmentId,
    GHLCalendarId: ghlAppointment.calendarId,
  };

  // Remove undefined/null fields
  Object.keys(mcAppointment).forEach(key => {
    if (mcAppointment[key] === undefined || mcAppointment[key] === null) {
      delete mcAppointment[key];
    }
  });

  return mcAppointment;
}

/**
 * Map Maid Central status to GHL status
 */
function mapMCStatusToGHL(mcStatus: string | undefined): string {
  if (!mcStatus) return 'scheduled';
  
  const statusMap: Record<string, string> = {
    'Scheduled': 'scheduled',
    'Confirmed': 'confirmed',
    'In Progress': 'in_progress',
    'Completed': 'completed',
    'Cancelled': 'cancelled',
    'No Show': 'no_show',
    'Rescheduled': 'rescheduled',
  };

  return statusMap[mcStatus] || mcStatus.toLowerCase().replace(/\s+/g, '_');
}

/**
 * Map GHL status to Maid Central status
 */
function mapGHLStatusToMC(ghlStatus: string | undefined): string {
  if (!ghlStatus) return 'Scheduled';
  
  const statusMap: Record<string, string> = {
    'scheduled': 'Scheduled',
    'confirmed': 'Confirmed',
    'in_progress': 'In Progress',
    'completed': 'Completed',
    'cancelled': 'Cancelled',
    'no_show': 'No Show',
    'rescheduled': 'Rescheduled',
  };

  return statusMap[ghlStatus] || ghlStatus.charAt(0).toUpperCase() + ghlStatus.slice(1).replace(/_/g, ' ');
}

/**
 * Extract appointment identifier for matching/syncing
 * Uses customer/contact + date/time as key for matching appointments
 */
export function getAppointmentMatchKey(appointment: any, isMC: boolean): string {
  if (isMC) {
    const customerId = appointment.CustomerId || appointment.ContactId || '';
    const date = appointment.Date || appointment.ScheduledStart || '';
    const time = appointment.ScheduledStart || appointment.StartTime || '';
    return `${customerId}|${date}|${time}`;
  } else {
    const contactId = appointment.contactId || appointment.customerId || '';
    const date = appointment.date || appointment.startTime || appointment.start || '';
    const time = appointment.startTime || appointment.start || '';
    return `${contactId}|${date}|${time}`;
  }
}
