import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { maidCentralAPI } from '@/lib/maid-central';
import { ghlAPI } from '@/lib/ghl';
import { getLocationIdFromRequest } from '@/lib/request-utils';
import { getIntegrationConfig } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const locationId = getLocationIdFromRequest(request);
    
    if (!locationId) {
      return NextResponse.json(
        { error: 'Location ID is required' },
        { status: 400 }
      );
    }

    const config = await getIntegrationConfig(locationId);
    if (!config?.ghlLocationId) {
      return NextResponse.json(
        { error: 'GHL Location ID not configured' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      quoteId,
      leadId,
      selectedDate,
      selectedTime,
      teamId,
      teamName,
      ghlContactId,
      ghlOpportunityId,
      paymentInfo,
    } = body;

    if (!quoteId || !leadId) {
      return NextResponse.json(
        { error: 'quoteId and leadId are required' },
        { status: 400 }
      );
    }

    if (!selectedDate) {
      return NextResponse.json(
        { error: 'selectedDate is required' },
        { status: 400 }
      );
    }

    // Step 1: Check availability
    let availabilityOk = true;
    try {
      if (selectedDate) {
        const startTime = new Date(selectedDate + 'T' + (selectedTime || '09:00'));
        const endTime = new Date(startTime);
        endTime.setHours(endTime.getHours() + 2); // Assume 2-hour appointment

        const availability = await maidCentralAPI.checkAvailabilityAcrossTeams(
          startTime,
          endTime,
          undefined,
          locationId
        );

        availabilityOk = availability.available;
        
        if (!availabilityOk) {
          console.warn('[Booking Creation] No availability for requested time slot');
          return NextResponse.json(
            {
              error: 'No teams available for the selected date and time',
              conflicts: availability.conflicts,
            },
            { status: 409 }
          );
        }
      }
    } catch (availError) {
      console.warn('[Booking Creation] Error checking availability:', availError);
      // Continue anyway, allow booking even if availability check fails
    }

    // Step 2: Create Booking in MaidCentral
    const bookingPayload: any = {
      QuoteId: quoteId,
      LeadId: Number(leadId),
      ServiceDate: selectedDate,
      BookingTime: selectedTime || '09:00',
    };

    if (teamId) {
      bookingPayload.TeamId = teamId;
    }

    let bookingData = null;
    let bookingId = null;
    try {
      const bookingResponse = await maidCentralAPI.createBooking(bookingPayload);

      if (!bookingResponse?.IsSuccess && !bookingResponse?.Result && !bookingResponse?.BookingId) {
        throw new Error(bookingResponse?.Message || 'Booking creation failed');
      }

      bookingData = bookingResponse.Result || bookingResponse;
      bookingId = bookingData?.BookingId || bookingData?.id || bookingData?.AppointmentId;
      console.log('[Booking Creation] Booking created in MaidCentral:', bookingId);
    } catch (bookingError) {
      console.error('[Booking Creation] Error creating booking in MaidCentral:', bookingError);
      return NextResponse.json(
        { error: `Failed to create booking in MaidCentral: ${bookingError instanceof Error ? bookingError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    // Step 3: Update Opportunity in GHL with booking details
    if (ghlOpportunityId) {
      try {
        await ghlAPI.updateOpportunityWithBooking(
          config.ghlLocationId,
          ghlOpportunityId,
          {
            bookingId: bookingId,
            bookingDate: selectedDate,
            bookingTime: selectedTime,
            status: 'confirmed',
            teamName: teamName,
            appointmentId: bookingId,
          }
        );
        console.log('[Booking Creation] Opportunity updated in GHL with booking details');
      } catch (oppUpdateError) {
        console.error('[Booking Creation] Error updating opportunity in GHL:', oppUpdateError);
        // Don't fail if opportunity update fails
      }
    }

    // Step 4: Create calendar event in GHL if configured
    if (config.ghlCalendarId && ghlContactId) {
      try {
        const startDateTime = new Date(selectedDate + 'T' + (selectedTime || '09:00'));
        const endDateTime = new Date(startDateTime);
        endDateTime.setHours(endDateTime.getHours() + 2);

        await ghlAPI.createCalendarAppointment(
          config.ghlCalendarId,
          config.ghlLocationId,
          {
            title: `Cleaning Service Booking - Quote #${quoteId}`,
            description: `Booked service for lead ${leadId}. Booking ID: ${bookingId}`,
            startTime: startDateTime.toISOString(),
            endTime: endDateTime.toISOString(),
            contactId: ghlContactId,
          }
        );
        console.log('[Booking Creation] Calendar event created in GHL');
      } catch (eventError) {
        console.warn('[Booking Creation] Error creating calendar event in GHL:', eventError);
        // Don't fail if calendar event creation fails
      }
    }

    return NextResponse.json({
      success: true,
      bookingId: bookingId,
      quoteId: quoteId,
      leadId: leadId,
      selectedDate: selectedDate,
      selectedTime: selectedTime || '09:00',
      booking: bookingData,
    });
  } catch (error) {
    console.error('Error in booking creation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create booking' },
      { status: 500 }
    );
  }
}
