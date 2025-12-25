'use client';

import { useState, useEffect } from 'react';

interface LeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  postalCode: string;
  services: string[];
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  [key: string]: any;
}

interface QuoteData {
  leadId: string;
  serviceAnswers: Record<string, any>;
  selectedServices: string[];
  totalAmount?: number;
  [key: string]: any;
}

interface BookingData {
  quoteId: string;
  selectedDate: string;
  selectedTime?: string;
  paymentInfo?: any;
  [key: string]: any;
}

interface Service {
  id: string;
  name: string;
  description?: string;
  basePrice?: number;
  [key: string]: any;
}

export default function BookingWidget() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [leadData, setLeadData] = useState<Partial<LeadData>>({});
  const [quoteData, setQuoteData] = useState<Partial<QuoteData>>({});
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({});
  
  const [leadId, setLeadId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load services on mount
  useEffect(() => {
    loadServices();
    loadUTMParams();
  }, []);

  const loadUTMParams = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setLeadData(prev => ({
        ...prev,
        utmSource: params.get('utm_source') || undefined,
        utmMedium: params.get('utm_medium') || undefined,
        utmCampaign: params.get('utm_campaign') || undefined,
      }));
    }
  };

  const loadServices = async () => {
    try {
      const response = await fetch('/api/maid-central/services');
      if (response.ok) {
        const data = await response.json();
        setServices(Array.isArray(data) ? data : (data.data || data.services || []));
      }
    } catch (error) {
      console.error('Error loading services:', error);
    }
  };

  // Step 1: Create Lead
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/maid-central/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadData),
      });

      const data = await response.json();

      if (response.ok && data.leadId) {
        setLeadId(String(data.leadId));
        setQuoteData(prev => ({ ...prev, leadId: String(data.leadId) }));
        setStep(2);
      } else {
        setError(data.error || 'Failed to create lead');
      }
    } catch (error) {
      console.error('Error creating lead:', error);
      setError('Failed to create lead. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Create Quote
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/maid-central/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: leadId,
          ...quoteData,
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        setQuoteId(data.id);
        setBookingData(prev => ({ ...prev, quoteId: data.id }));
        setStep(3);
      } else {
        setError(data.error || 'Failed to create quote');
      }
    } catch (error) {
      console.error('Error creating quote:', error);
      setError('Failed to create quote. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Create Booking
  const handleStep3Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/maid-central/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteId: quoteId,
          ...bookingData,
        }),
      });

      const data = await response.json();

      if (response.ok && data.id) {
        setBookingId(data.id);
        // Trigger sync to GHL
        if (quoteId) {
          try {
            await fetch('/api/webhook/quote', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ quoteId }),
            });
          } catch (syncError) {
            console.error('Error syncing to GHL:', syncError);
            // Don't fail the booking if sync fails
          }
        }
        // Show success message
        alert('Booking confirmed! Thank you for your booking.');
      } else {
        setError(data.error || 'Failed to create booking');
      }
    } catch (error) {
      console.error('Error creating booking:', error);
      setError('Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>Book Your Service</h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
          <div style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: step >= 1 ? '#2563eb' : '#e5e7eb', 
            color: step >= 1 ? 'white' : '#6b7280',
            borderRadius: '4px',
            fontWeight: step === 1 ? 'bold' : 'normal'
          }}>
            1. Contact Info
          </div>
          <div style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: step >= 2 ? '#2563eb' : '#e5e7eb', 
            color: step >= 2 ? 'white' : '#6b7280',
            borderRadius: '4px',
            fontWeight: step === 2 ? 'bold' : 'normal'
          }}>
            2. Get Quote
          </div>
          <div style={{ 
            padding: '0.5rem 1rem', 
            backgroundColor: step >= 3 ? '#2563eb' : '#e5e7eb', 
            color: step >= 3 ? 'white' : '#6b7280',
            borderRadius: '4px',
            fontWeight: step === 3 ? 'bold' : 'normal'
          }}>
            3. Book
          </div>
        </div>
      </div>

      {error && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fee2e2', 
          color: '#991b1b', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          {error}
        </div>
      )}

      {/* Step 1: Lead Creation */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Contact Information</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              First Name *
            </label>
            <input
              type="text"
              required
              value={leadData.firstName || ''}
              onChange={(e) => setLeadData(prev => ({ ...prev, firstName: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Last Name *
            </label>
            <input
              type="text"
              required
              value={leadData.lastName || ''}
              onChange={(e) => setLeadData(prev => ({ ...prev, lastName: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Email *
            </label>
            <input
              type="email"
              required
              value={leadData.email || ''}
              onChange={(e) => setLeadData(prev => ({ ...prev, email: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Phone *
            </label>
            <input
              type="tel"
              required
              value={leadData.phone || ''}
              onChange={(e) => setLeadData(prev => ({ ...prev, phone: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Postal Code *
            </label>
            <input
              type="text"
              required
              value={leadData.postalCode || ''}
              onChange={(e) => setLeadData(prev => ({ ...prev, postalCode: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              placeholder="Enter your postal code"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Select Services *
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {services.map((service) => (
                <label key={service.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={(leadData.services || []).includes(service.id)}
                    onChange={(e) => {
                      const current = leadData.services || [];
                      if (e.target.checked) {
                        setLeadData(prev => ({ ...prev, services: [...current, service.id] }));
                      } else {
                        setLeadData(prev => ({ ...prev, services: current.filter(s => s !== service.id) }));
                      }
                    }}
                  />
                  <span>{service.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !leadData.firstName || !leadData.email || !leadData.phone || !leadData.postalCode}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Creating Lead...' : 'Continue to Get Quote'}
          </button>
        </form>
      )}

      {/* Step 2: Quote Creation */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Get Your Quote</h2>
          
          <div>
            <p style={{ marginBottom: '1rem' }}>Please answer the following questions to get an accurate quote:</p>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1rem' }}>
              (This step will be expanded with actual pricing questions from Maid Central API)
            </p>
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <p><strong>Selected Services:</strong></p>
            <ul>
              {leadData.services?.map(serviceId => {
                const service = services.find(s => s.id === serviceId);
                return <li key={serviceId}>{service?.name || serviceId}</li>;
              })}
            </ul>
          </div>

          <button
            type="button"
            onClick={() => setStep(1)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>

          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Creating Quote...' : 'Continue to Booking'}
          </button>
        </form>
      )}

      {/* Step 3: Booking Creation */}
      {step === 3 && (
        <form onSubmit={handleStep3Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Complete Your Booking</h2>
          
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Preferred Date *
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={bookingData.selectedDate || ''}
              onChange={(e) => setBookingData(prev => ({ ...prev, selectedDate: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Preferred Time (Optional)
            </label>
            <input
              type="time"
              value={bookingData.selectedTime || ''}
              onChange={(e) => setBookingData(prev => ({ ...prev, selectedTime: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#f3f4f6', 
            borderRadius: '4px',
            marginBottom: '1rem'
          }}>
            <p><strong>Quote ID:</strong> {quoteId}</p>
            <p style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              Payment information will be collected in the next step
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            ← Back
          </button>

          <button
            type="submit"
            disabled={loading || !bookingData.selectedDate}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#9ca3af' : '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '1rem'
            }}
          >
            {loading ? 'Confirming Booking...' : 'Confirm Booking'}
          </button>
        </form>
      )}

      {bookingId && (
        <div style={{
          padding: '2rem',
          backgroundColor: '#d1fae5',
          color: '#065f46',
          borderRadius: '4px',
          marginTop: '2rem',
          textAlign: 'center'
        }}>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Booking Confirmed!</h3>
          <p>Your booking ID: {bookingId}</p>
          <p style={{ marginTop: '0.5rem' }}>Thank you for your booking. You will receive a confirmation email shortly.</p>
        </div>
      )}
    </div>
  );
}

