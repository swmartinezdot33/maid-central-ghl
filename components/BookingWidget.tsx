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

interface WidgetConfig {
  themeColors?: any;
  typography?: any;
  layout?: any;
  customCss?: string;
  fieldVisibility?: Record<string, boolean>;
}

export default function BookingWidget() {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [leadData, setLeadData] = useState<Partial<LeadData>>({});
  const [quoteData, setQuoteData] = useState<Partial<QuoteData>>({});
  const [bookingData, setBookingData] = useState<Partial<BookingData>>({});

  const [leadId, setLeadId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);

  const [services, setServices] = useState<any[]>([]);
  const [scopeGroups, setScopeGroups] = useState<any[]>([]);
  const [scopeGroupId, setScopeGroupId] = useState('');
  const [scopes, setScopes] = useState<any[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, any>>({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [config, setConfig] = useState<WidgetConfig>({});

  // Load widget configuration and location ID
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const locId = params.get('locationId');
    setLocationId(locId);

    // Load widget configuration
    if (locId) {
      loadWidgetConfig(locId);
      loadScopeGroups(locId);
      loadUTMParams(params);
    }
  }, []);

  const loadWidgetConfig = async (locId: string) => {
    try {
      const response = await fetch(`/api/widget-config?locationId=${locId}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        applyCustomStyles(data);
      }
    } catch (err) {
      console.error('Error loading widget config:', err);
    }
  };

  const applyCustomStyles = (widgetConfig: WidgetConfig) => {
    if (!widgetConfig.themeColors) return;

    const style = document.createElement('style');
    let css = '';

    // Apply theme colors
    if (widgetConfig.themeColors) {
      css += `:root {
        --primary-color: ${widgetConfig.themeColors.primary || '#2563eb'};
        --secondary-color: ${widgetConfig.themeColors.secondary || '#059669'};
        --background-color: ${widgetConfig.themeColors.background || '#ffffff'};
        --text-color: ${widgetConfig.themeColors.text || '#1f2937'};
      }`;
    }

    // Apply typography
    if (widgetConfig.typography) {
      css += `body {
        font-family: ${widgetConfig.typography.fontFamily || 'system-ui, sans-serif'};
        font-size: ${widgetConfig.typography.bodySize || '1rem'};
        font-weight: ${widgetConfig.typography.bodyWeight || '400'};
      }
      h1 { font-size: ${widgetConfig.typography.heading1Size || '2rem'}; font-weight: ${widgetConfig.typography.headingWeight || '700'}; }
      h2 { font-size: ${widgetConfig.typography.heading2Size || '1.5rem'}; font-weight: ${widgetConfig.typography.headingWeight || '700'}; }`;
    }

    // Add custom CSS
    if (widgetConfig.customCss) {
      css += widgetConfig.customCss;
    }

    if (css) {
      style.textContent = css;
      document.head.appendChild(style);
    }
  };

  const loadUTMParams = (params: URLSearchParams) => {
    setLeadData((prev) => ({
      ...prev,
      utmSource: params.get('utm_source') || undefined,
      utmMedium: params.get('utm_medium') || undefined,
      utmCampaign: params.get('utm_campaign') || undefined,
    }));
  };

  const loadScopeGroups = async (locId: string) => {
    try {
      const response = await fetch(`/api/maid-central/scope-groups?locationId=${locId}`);
      const data = await response.json();
      
      if (response.ok) {
        setScopeGroups(data.scopeGroups || []);
        if (data.warning) {
          console.warn('[Widget] Scope Groups Warning:', data.warning);
        }
      } else {
        console.error('[Widget] Error loading scope groups:', data.error);
        setError(`Unable to load services: ${data.error}`);
      }
    } catch (err) {
      console.error('Error loading scope groups:', err);
      setError(`Unable to load services: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleScopeGroupChange = async (groupId: string) => {
    setScopeGroupId(groupId);
    setSelectedScopes([]);
    setScopes([]);
    setQuestions([]);
    setQuestionAnswers({});

    if (!groupId || !locationId) return;

    try {
      const response = await fetch(`/api/maid-central/scopes?scopeGroupId=${groupId}&locationId=${locationId}`);
      if (response.ok) {
        const data = await response.json();
        setScopes(data.scopes || []);
      }
    } catch (err) {
      console.error('Error loading scopes:', err);
    }
  };

  const handleScopeChange = async (scopeId: string, isChecked: boolean) => {
    let newScopes = [...selectedScopes];
    if (isChecked) {
      newScopes = [...newScopes, scopeId];
    } else {
      newScopes = newScopes.filter(s => s !== scopeId);
    }
    setSelectedScopes(newScopes);

    // Load questions for the selected scopes
    if (newScopes.length > 0 && locationId) {
      await loadQuestionsForScopes(newScopes);
    } else {
      setQuestions([]);
      setQuestionAnswers({});
    }
  };

  const loadQuestionsForScopes = async (scopeIds: string[]) => {
    try {
      const response = await fetch('/api/maid-central/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          scopeIds: scopeIds,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
        // Reset answers when questions change
        setQuestionAnswers({});
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  // Step 1: Create Lead in MaidCentral and Contact in GHL
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!locationId) {
      setError('Location ID not found');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/widget/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          firstName: leadData.firstName,
          lastName: leadData.lastName,
          email: leadData.email,
          phone: leadData.phone,
          postalCode: leadData.postalCode,
          homePostalCode: leadData.postalCode,
          scopeGroupId: scopeGroupId,
          scopesOfWork: selectedScopes,
          questions: questionAnswers,
        }),
      });

      const data = await response.json();

      if (response.ok && data.leadId) {
        setLeadId(String(data.leadId));
        setQuoteId(data.quoteId);
        setQuoteData((prev) => ({
          ...prev,
          leadId: String(data.leadId),
          selectedServices: selectedScopes,
        }));
        setStep(2);
      } else {
        setError(data.error || 'Failed to create quote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Booking
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!quoteId || !leadId || !locationId || !bookingData.selectedDate) {
      setError('Missing required booking information');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/widget/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          quoteId,
          leadId,
          selectedDate: bookingData.selectedDate,
          selectedTime: bookingData.selectedTime || '09:00',
        }),
      });

      const data = await response.json();

      if (response.ok && data.bookingId) {
        setBookingId(data.bookingId);
        setStep(3);
      } else {
        setError(data.error || 'Failed to create booking');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = config.themeColors?.primary || '#2563eb';
  const secondaryColor = config.themeColors?.secondary || '#059669';

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
        {config.layout?.showBranding !== false && (
          <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem', color: primaryColor }}>Book Your Service</h1>
        )}

        {config.layout?.showProgress !== false && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '1rem' }}>
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: s <= step ? primaryColor : '#e5e7eb',
                  color: s <= step ? 'white' : '#6b7280',
                  borderRadius: '4px',
                  fontWeight: s === step ? 'bold' : 'normal',
                }}
              >
                {s === 1 ? 'Contact' : s === 2 ? 'Booking' : 'Confirm'}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Step 1: Contact Information & Service Selection */}
      {step === 1 && (
        <form onSubmit={handleStep1Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Your Information</h2>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              First Name *
            </label>
            <input
              type="text"
              required
              value={leadData.firstName || ''}
              onChange={(e) => setLeadData((prev) => ({ ...prev, firstName: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Last Name
            </label>
            <input
              type="text"
              value={leadData.lastName || ''}
              onChange={(e) => setLeadData((prev) => ({ ...prev, lastName: e.target.value }))}
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
              onChange={(e) => setLeadData((prev) => ({ ...prev, email: e.target.value }))}
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
              onChange={(e) => setLeadData((prev) => ({ ...prev, phone: e.target.value }))}
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
              onChange={(e) => setLeadData((prev) => ({ ...prev, postalCode: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              placeholder="Enter your postal code"
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Select Service Type *
            </label>
            <select
              required
              value={scopeGroupId}
              onChange={(e) => handleScopeGroupChange(e.target.value)}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            >
              <option value="">Choose a service type</option>
              {scopeGroups.map((group: any) => (
                <option key={group.ScopeGroupId || group.id} value={group.ScopeGroupId || group.id}>
                  {group.ScopeGroupName || group.name}
                </option>
              ))}
            </select>
          </div>

          {scopes.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Select Services *
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {scopes.map((scope: any) => (
                  <label
                    key={scope.ScopeId || scope.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.ScopeId || scope.id)}
                      onChange={(e) => {
                        const scopeId = scope.ScopeId || scope.id;
                        handleScopeChange(scopeId, e.target.checked);
                      }}
                    />
                    <span>{scope.ScopeName || scope.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {questions.length > 0 && (
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                Service Details
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {questions.map((question: any) => {
                  const questionId = question.QuestionId || question.id;
                  const questionText = question.QuestionText || question.text || question.name;
                  const questionType = question.QuestionType || question.type || 'text';

                  return (
                    <div key={questionId}>
                      <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: '500', fontSize: '0.9rem' }}>
                        {questionText}
                        {question.IsRequired && <span style={{ color: 'red' }}>*</span>}
                      </label>
                      {questionType === 'text' || questionType === 'textarea' ? (
                        <textarea
                          value={questionAnswers[questionId] || ''}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                            fontFamily: 'inherit',
                            minHeight: '60px',
                          }}
                          placeholder={question.Placeholder || ''}
                        />
                      ) : questionType === 'dropdown' || questionType === 'select' ? (
                        <select
                          value={questionAnswers[questionId] || ''}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                          }}
                        >
                          <option value="">Select an option</option>
                          {question.Options && question.Options.map((opt: any) => (
                            <option key={opt.Id || opt.value} value={opt.Id || opt.value}>
                              {opt.Text || opt.label}
                            </option>
                          ))}
                        </select>
                      ) : questionType === 'checkbox' ? (
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={questionAnswers[questionId] || false}
                            onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [questionId]: e.target.checked }))}
                          />
                          <span>{question.CheckboxLabel || 'Yes'}</span>
                        </label>
                      ) : (
                        <input
                          type="text"
                          value={questionAnswers[questionId] || ''}
                          onChange={(e) => setQuestionAnswers((prev) => ({ ...prev, [questionId]: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            borderRadius: '4px',
                            border: '1px solid #d1d5db',
                          }}
                          placeholder={question.Placeholder || ''}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !leadData.firstName || !leadData.email || !leadData.phone || !leadData.postalCode || selectedScopes.length === 0}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: loading ? '#9ca3af' : primaryColor,
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '500',
              fontSize: '1rem',
            }}
          >
            {loading ? 'Creating Quote...' : 'Get Quote & Schedule Booking'}
          </button>
        </form>
      )}

      {/* Step 2: Booking Details */}
      {step === 2 && (
        <form onSubmit={handleStep2Submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Schedule Your Service</h2>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Preferred Date *
            </label>
            <input
              type="date"
              required
              min={new Date().toISOString().split('T')[0]}
              value={bookingData.selectedDate || ''}
              onChange={(e) => setBookingData((prev) => ({ ...prev, selectedDate: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
              Preferred Time (Optional)
            </label>
            <input
              type="time"
              value={bookingData.selectedTime || '09:00'}
              onChange={(e) => setBookingData((prev) => ({ ...prev, selectedTime: e.target.value }))}
              style={{ width: '100%', padding: '0.75rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                flex: 1,
                padding: '0.5rem 1rem',
                backgroundColor: '#e5e7eb',
                color: '#374151',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>

            <button
              type="submit"
              disabled={loading || !bookingData.selectedDate}
              style={{
                flex: 1,
                padding: '0.75rem 1.5rem',
                backgroundColor: loading ? '#9ca3af' : secondaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: '500',
                fontSize: '1rem',
              }}
            >
              {loading ? 'Confirming...' : 'Confirm Booking'}
            </button>
          </div>
        </form>
      )}

      {/* Step 3: Success */}
      {step === 3 && bookingId && (
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#d1fae5',
            color: '#065f46',
            borderRadius: '4px',
            marginTop: '2rem',
            textAlign: 'center',
          }}
        >
          <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Booking Confirmed!</h3>
          <p>Your booking ID: {bookingId}</p>
          <p style={{ marginTop: '0.5rem' }}>Thank you for your booking. You will receive a confirmation email shortly.</p>
        </div>
      )}
    </div>
  );
}
