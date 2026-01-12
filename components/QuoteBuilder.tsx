'use client';

import { useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

interface QuoteBuilderProps {
  locationId?: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
}

export function QuoteBuilder({ locationId, onSuccess, onError }: QuoteBuilderProps) {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Customer Information
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Step 2: Service Selection
  const [scopeGroups, setScopeGroups] = useState<any[]>([]);
  const [scopeGroupId, setScopeGroupId] = useState('');
  const [scopes, setScopes] = useState<any[]>([]);
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);

  // Step 3: Quote Details
  const [homeAddress1, setHomeAddress1] = useState('');
  const [homeAddress2, setHomeAddress2] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeRegion, setHomeRegion] = useState('');
  const [homePostalCode, setHomePostalCode] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, any>>({});

  // Step 4: Review
  const [quoteAmount, setQuoteAmount] = useState<number | null>(null);

  // Step 5: Booking
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00');

  // Quote data for submission
  const [quoteData, setQuoteData] = useState<any>(null);
  const [ghlContactId, setGhlContactId] = useState<string | null>(null);
  const [ghlOpportunityId, setGhlOpportunityId] = useState<string | null>(null);

  // Load scope groups on mount or step 2
  const loadScopeGroups = async () => {
    try {
      const response = await fetch(`/api/maid-central/scope-groups?locationId=${locationId}`);
      if (response.ok) {
        const data = await response.json();
        setScopeGroups(data.scopeGroups || []);
      }
    } catch (err) {
      console.error('Error loading scope groups:', err);
    }
  };

  // Load scopes when scope group is selected
  const handleScopeGroupChange = async (groupId: string) => {
    setScopeGroupId(groupId);
    setSelectedScopes([]);
    setScopes([]);

    if (!groupId) return;

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

  // Load questions when scopes are selected
  const handleScopesChange = async (scopeIds: string[]) => {
    setSelectedScopes(scopeIds);

    if (scopeIds.length === 0) {
      setQuestions([]);
      return;
    }

    try {
      const response = await fetch(`/api/maid-central/questions?scopeIds=${scopeIds.join(',')}&locationId=${locationId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (err) {
      console.error('Error loading questions:', err);
    }
  };

  // Handle step progression
  const handleNextStep = async () => {
    setError(null);

    if (step === 1) {
      if (!firstName || !email || !phone || !postalCode) {
        setError('Please fill in all required fields');
        return;
      }
      // Load scope groups for step 2
      await loadScopeGroups();
      setStep(2);
    } else if (step === 2) {
      if (!scopeGroupId || selectedScopes.length === 0) {
        setError('Please select at least one service scope');
        return;
      }
      setStep(3);
    } else if (step === 3) {
      if (!homeAddress1 || !homePostalCode) {
        setError('Please fill in address information');
        return;
      }
      // Calculate price
      await calculatePrice();
      setStep(4);
    } else if (step === 4) {
      setStep(5);
    }
  };

  const calculatePrice = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/quotes/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: email, // Use email as temp ID for calculation
          homeAddress1,
          homeCity,
          homeRegion,
          homePostalCode,
          scopeGroupId,
          scopesOfWork: selectedScopes,
          questions: questionAnswers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuoteAmount(data.QuoteTotal || data.TotalAmount || data.Amount || null);
      }
    } catch (err) {
      console.error('Error calculating price:', err);
      setError('Failed to calculate price');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateQuote = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/quotes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ghl-location-id': locationId || '' },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          postalCode,
          homeAddress1,
          homeAddress2,
          homeCity,
          homeRegion,
          homePostalCode,
          scopeGroupId,
          scopesOfWork: selectedScopes,
          questions: questionAnswers,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setQuoteData(data);
        setGhlContactId(data.ghlContactId);
        setGhlOpportunityId(data.ghlOpportunityId);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create quote');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create quote');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!quoteData?.quoteId) {
        setError('Quote data missing');
        return;
      }

      const response = await fetch('/api/bookings/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-ghl-location-id': locationId || '' },
        body: JSON.stringify({
          quoteId: quoteData.quoteId,
          leadId: quoteData.leadId,
          selectedDate,
          selectedTime,
          ghlContactId,
          ghlOpportunityId,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create booking');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousStep = () => {
    setStep((s) => (s > 1 ? ((s - 1) as any) : s));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Progress Indicator */}
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full transition-colors ${
              s <= step ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>

      {error && (
        <Alert variant="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card padding="lg">
        {/* Step 1: Customer Information */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Your Information</h2>
            <Input
              label="First Name *"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="John"
            />
            <Input
              label="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Doe"
            />
            <Input
              label="Email *"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
            />
            <Input
              label="Phone *"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
            <Input
              label="Postal Code *"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="12345"
            />
          </div>
        )}

        {/* Step 2: Service Selection */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Services</h2>
            <Select
              label="Service Type *"
              value={scopeGroupId}
              onChange={(e) => handleScopeGroupChange(e.target.value)}
              options={[
                { value: '', label: 'Select a service type' },
                ...scopeGroups.map((group: any) => ({
                  value: group.ScopeGroupId || group.scopeGroupId || group.id,
                  label: group.ScopeGroupName || group.scopeGroupName || group.name,
                })),
              ]}
            />

            {scopes.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Specific Services
                </label>
                <div className="space-y-2">
                  {scopes.map((scope: any) => (
                    <label key={scope.ScopeId || scope.scopeId || scope.id} className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(scope.ScopeId || scope.scopeId || scope.id)}
                        onChange={(e) => {
                          const scopeId = scope.ScopeId || scope.scopeId || scope.id;
                          if (e.target.checked) {
                            handleScopesChange([...selectedScopes, scopeId]);
                          } else {
                            handleScopesChange(selectedScopes.filter((s) => s !== scopeId));
                          }
                        }}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">
                        {scope.ScopeName || scope.scopeName || scope.name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Quote Details */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Service Address</h2>
            <Input
              label="Address *"
              value={homeAddress1}
              onChange={(e) => setHomeAddress1(e.target.value)}
              placeholder="123 Main St"
            />
            <Input
              label="Address (Apt/Suite)"
              value={homeAddress2}
              onChange={(e) => setHomeAddress2(e.target.value)}
              placeholder="Apt 4B"
            />
            <Input
              label="City"
              value={homeCity}
              onChange={(e) => setHomeCity(e.target.value)}
              placeholder="New York"
            />
            <Input
              label="State/Region"
              value={homeRegion}
              onChange={(e) => setHomeRegion(e.target.value)}
              placeholder="NY"
            />
            <Input
              label="Postal Code *"
              value={homePostalCode}
              onChange={(e) => setHomePostalCode(e.target.value)}
              placeholder="10001"
            />

            {questions.length > 0 && (
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Additional Questions</h3>
                {questions.map((q: any) => (
                  <Input
                    key={q.QuestionId || q.questionId || q.id}
                    label={q.QuestionText || q.questionText || q.text}
                    value={questionAnswers[q.QuestionId || q.questionId || q.id] || ''}
                    onChange={(e) => {
                      setQuestionAnswers({
                        ...questionAnswers,
                        [q.QuestionId || q.questionId || q.id]: e.target.value,
                      });
                    }}
                    className="mb-3"
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review Quote */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Review Your Quote</h2>
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Name:</span>
                <span className="font-medium">{firstName} {lastName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Email:</span>
                <span className="font-medium">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Address:</span>
                <span className="font-medium">{homeAddress1}, {homeCity}</span>
              </div>
              {quoteAmount && (
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-lg font-semibold">Estimated Amount:</span>
                  <span className="text-lg font-bold text-green-600">${quoteAmount.toFixed(2)}</span>
                </div>
              )}
            </div>
            <Button
              variant="primary"
              onClick={handleCreateQuote}
              disabled={loading}
              className="w-full"
            >
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Create Quote
            </Button>
          </div>
        )}

        {/* Step 5: Booking */}
        {step === 5 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Schedule Your Service</h2>
            <Input
              label="Preferred Date *"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <Input
              label="Preferred Time"
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
            />
            <Button
              variant="primary"
              onClick={handleCreateBooking}
              disabled={loading || !selectedDate}
              className="w-full"
            >
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Complete Booking
            </Button>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex gap-3 mt-6">
          {step > 1 && (
            <Button variant="secondary" onClick={handlePreviousStep} className="flex-1">
              Back
            </Button>
          )}
          {step < 5 && step < 4 && (
            <Button
              variant="primary"
              onClick={handleNextStep}
              disabled={loading}
              className="flex-1"
            >
              {loading ? <LoadingSpinner size="sm" className="mr-2" /> : null}
              Next
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
