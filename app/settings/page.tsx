'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';
import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Alert } from '@/components/ui/Alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  TagIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

interface Config {
  enabled: boolean;
  ghlLocationId?: string;
  ghlTag?: string;
  ghlTags?: string[];
  syncQuotes: boolean;
  syncCustomers: boolean;
  createOpportunities: boolean;
  autoCreateFields: boolean;
  customFieldPrefix: string;
  syncAppointments?: boolean;
  ghlCalendarId?: string;
  appointmentSyncInterval?: number;
  appointmentConflictResolution?: 'maid_central_wins' | 'ghl_wins' | 'timestamp';
  quotePollingEnabled?: boolean;
  quotePollingInterval?: number;
  lastQuotePollAt?: number;
  fieldMappings?: FieldMapping[];
}

interface Calendar {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
}

interface Field {
  name: string;
  label: string;
  type?: string;
  category?: string;
}

interface FieldMapping {
  maidCentralField: string;
  ghlField: string;
  maidCentralLabel?: string;
  ghlLabel?: string;
}

function SettingsPageContent() {
  const router = useRouter();
  const { ghlData } = useGHLIframe();
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);
  const [ghlConnected, setGhlConnected] = useState(false);
  const [mcFields, setMcFields] = useState<Field[]>([]);
  const [ghlFields, setGhlFields] = useState<Field[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [savingMappings, setSavingMappings] = useState(false);
  const [loadingFields, setLoadingFields] = useState(false);

  useEffect(() => {
    if (ghlData?.locationId) {
      loadConfig();
    }
  }, [ghlData?.locationId]);

  useEffect(() => {
    if (ghlData?.locationId) {
      loadCalendars();
    }
  }, [ghlData?.locationId]);

  useEffect(() => {
    if (ghlData?.locationId) {
      loadFieldData();
    }
  }, [ghlData?.locationId]);

  const loadConfig = async () => {
    if (!ghlData?.locationId) {
      console.warn('[Settings] Cannot load config without locationId');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const response = await fetch(`/api/config?locationId=${ghlData.locationId}`);
      const data = await response.json();
      
      if (response.ok) {
        const loadedConfig = data.config || {
          enabled: false,
          syncQuotes: true,
          syncCustomers: false,
          createOpportunities: true,
          autoCreateFields: true,
          customFieldPrefix: 'maidcentral_quote_',
          syncAppointments: false,
          appointmentSyncInterval: 15,
          appointmentConflictResolution: 'timestamp',
        };
        setConfig(loadedConfig);
        setMappings(loadedConfig.fieldMappings || []);
        setGhlConnected(data.ghlConnected || false);
      } else {
        if (data.error) {
          setMessage({ type: 'error', text: `Failed to load configuration: ${data.error}` });
        }
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const loadCalendars = async () => {
    if (!ghlData?.locationId) return;
    
    try {
      setLoadingCalendars(true);
      const response = await fetch(`/api/ghl/calendars?locationId=${encodeURIComponent(ghlData.locationId)}`, {
        headers: { 'x-ghl-location-id': ghlData.locationId },
      });
      const data = await response.json();
      
      if (response.ok && data.calendars && Array.isArray(data.calendars)) {
        setCalendars(data.calendars);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    } finally {
      setLoadingCalendars(false);
    }
  };

  const loadFieldData = async () => {
    if (!ghlData?.locationId) return;
    
    try {
      setLoadingFields(true);
      
      // Load MaidCentral fields
      try {
        const mcRes = await fetch('/api/maid-central/fields');
        const mcData = await mcRes.json();
        const fields = mcData.fields.map((field: string) => ({
          name: field,
          label: field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1'),
        }));
        setMcFields(fields);
      } catch (error) {
        console.error('Error loading Maid Central fields:', error);
        setMessage({ type: 'error', text: 'Failed to load MaidCentral fields. Please ensure credentials are configured.' });
      }

      // Load GHL fields
      const locationIdToUse = ghlData.locationId;
      if (locationIdToUse) {
        try {
          const ghlRes = await fetch(`/api/ghl/fields?locationId=${locationIdToUse}`);
          if (!ghlRes.ok) {
            const errorData = await ghlRes.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${ghlRes.status}: ${ghlRes.statusText}`);
          }
          
          const ghlData = await ghlRes.json();
          if (ghlData.error) {
            throw new Error(ghlData.error);
          }
          
          if (!ghlData.fields || !Array.isArray(ghlData.fields)) {
            throw new Error('Invalid response format from GHL fields API');
          }
          
          setGhlFields(ghlData.fields);
        } catch (error) {
          console.error('Error loading GHL fields:', error);
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          setMessage({ type: 'error', text: `Failed to load CRM fields: ${errorMsg}` });
        }
      }
    } catch (error) {
      console.error('Error loading field data:', error);
    } finally {
      setLoadingFields(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { maidCentralField: '', ghlField: '' }]);
  };

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    
    if (field === 'maidCentralField') {
      const mcField = mcFields.find(f => f.name === value);
      updated[index].maidCentralLabel = mcField?.label;
    }
    if (field === 'ghlField') {
      const ghlField = ghlFields.find(f => f.name === value);
      updated[index].ghlLabel = ghlField?.label;
    }
    
    setMappings(updated);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const saveMappings = async () => {
    if (!ghlData?.locationId) {
      setMessage({ type: 'error', text: 'Location ID is required' });
      return;
    }

    setSavingMappings(true);
    setMessage(null);

    const validMappings = mappings.filter(m => m.maidCentralField && m.ghlField);

    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: validMappings }),
      });

      if (response.ok) {
        // Update config with new mappings
        setConfig({ ...config!, fieldMappings: validMappings });
        setMappings(validMappings);
        setMessage({ type: 'success', text: 'Field mappings saved successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save mappings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save mappings' });
    } finally {
      setSavingMappings(false);
    }
  };

  const saveConfig = async () => {
    if (!ghlData?.locationId || !config) {
      setMessage({ type: 'error', text: 'Location ID is required or no configuration to save' });
      return;
    }
    
    setSaving(true);
    setMessage(null);

    try {
      const configToSave = { ...config, ghlLocationId: ghlData.locationId, fieldMappings: mappings };
      const response = await fetch(`/api/config?locationId=${ghlData.locationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configToSave),
      });

      if (response.ok) {
        await loadConfig();
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      console.error('[Settings] Error saving config:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-12 w-64" />
        <Card padding="lg">
          <Skeleton className="h-6 w-48 mb-4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <LocationGuard>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="p-2">
            <ArrowLeftIcon className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Integration Settings</h1>
            <p className="text-gray-600 mt-1">Configure how data flows from MaidCentral to CRM</p>
          </div>
        </div>

        {message && (
          <Alert
            variant={message.type === 'error' ? 'error' : 'success'}
            onClose={() => setMessage(null)}
          >
            {message.text}
          </Alert>
        )}

        {/* Connection Status */}
        <Card padding="lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">CRM Connection</h3>
              <p className="text-sm text-gray-500">OAuth connection status for this location</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusIndicator
                status={ghlConnected ? 'connected' : 'disconnected'}
                label={ghlConnected ? 'Connected' : 'Not Connected'}
              />
              {!ghlConnected && (
                <Link href="/setup">
                  <Button variant="primary" size="sm">Setup OAuth</Button>
                </Link>
              )}
            </div>
          </div>
        </Card>

        <Tabs defaultValue="integration">
          <TabsList>
            <TabsTrigger value="integration">Integration Controls</TabsTrigger>
            <TabsTrigger value="quote-sync">Quote Sync</TabsTrigger>
            <TabsTrigger value="appointments">Appointment Sync</TabsTrigger>
            <TabsTrigger value="field-mapping">Field Mapping</TabsTrigger>
            <TabsTrigger value="tags">Tags & Fields</TabsTrigger>
          </TabsList>

          <TabsContent value="integration">
            <Card padding="lg">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Enable Integration"
                      description="Master switch to enable/disable the entire integration"
                      checked={config?.enabled || false}
                      onChange={(e) => setConfig({ ...config!, enabled: e.target.checked })}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Sync Customers"
                      description="When enabled, customer updates from MaidCentral will sync to CRM"
                      checked={config?.syncCustomers || false}
                      onChange={(e) => setConfig({ ...config!, syncCustomers: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Auto-Create Custom Fields"
                      description="Automatically create custom fields in CRM for MaidCentral data that doesn't map to native fields"
                      checked={config?.autoCreateFields !== false}
                      onChange={(e) => setConfig({ ...config!, autoCreateFields: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="quote-sync">
            <Card padding="lg">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Quote Syncing Configuration</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Configure how quotes from MaidCentral are synced to CRM contacts and opportunities.
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Enable Quote Syncing"
                      description="When enabled, new quotes from MaidCentral will automatically create contacts and opportunities in CRM"
                      checked={config?.syncQuotes !== false}
                      onChange={(e) => setConfig({ ...config!, syncQuotes: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>

                {config?.syncQuotes !== false && (
                  <>
                    <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <Toggle
                            label="Automatic Quote Polling"
                            description="Automatically poll for new quotes at regular intervals. When disabled, quotes must be synced manually or via webhook."
                            checked={config?.quotePollingEnabled || false}
                            onChange={(e) => setConfig({ ...config!, quotePollingEnabled: e.target.checked })}
                            disabled={!config?.enabled || !config?.syncQuotes}
                          />
                        </div>
                      </div>

                      {config?.quotePollingEnabled && (
                        <div>
                          <Input
                            label="Polling Interval (minutes)"
                            type="number"
                            min="5"
                            max="1440"
                            step="5"
                            value={config?.quotePollingInterval || 15}
                            onChange={(e) => setConfig({ ...config!, quotePollingInterval: parseInt(e.target.value) || 15 })}
                            disabled={!config?.enabled || !config?.syncQuotes || !config?.quotePollingEnabled}
                            helperText="How often to automatically check for new quotes (5-1440 minutes). Default: 15 minutes."
                          />
                          {config?.lastQuotePollAt && (
                            <div className="mt-3 p-3 bg-white rounded border border-primary-200">
                              <p className="text-sm font-medium text-gray-700 mb-1">Last Poll Status</p>
                              <p className="text-sm text-gray-600">
                                Last poll: {new Date(config.lastQuotePollAt).toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Next poll in approximately {Math.max(0, Math.round(((config.quotePollingInterval || 15) * 60 * 1000 - (Date.now() - config.lastQuotePollAt)) / 1000 / 60))} minutes
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <Toggle
                          label="Create Opportunities/Deals"
                          description="When enabled, an opportunity/deal will be created in CRM for each quote synced. The opportunity will include the quote amount and details."
                          checked={config?.createOpportunities !== false}
                          onChange={(e) => setConfig({ ...config!, createOpportunities: e.target.checked })}
                          disabled={!config?.enabled || !config?.syncQuotes}
                        />
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Sync Methods</h3>
                      <div className="space-y-2 text-sm text-gray-600">
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">Automatic Polling</p>
                            <p className="text-xs text-gray-500">
                              {config?.quotePollingEnabled 
                                ? `Enabled - Polls every ${config.quotePollingInterval || 15} minutes`
                                : 'Disabled - Enable above to use automatic polling'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">Webhook Endpoint</p>
                            <p className="text-xs text-gray-500">
                              Available at: <code className="bg-white px-1 py-0.5 rounded text-xs">{typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/quote` : '/api/webhook/quote'}</code>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircleIcon className="w-5 h-5 text-primary-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-gray-900">Manual Sync</p>
                            <p className="text-xs text-gray-500">
                              Use the Quotes page to view and sync individual quotes manually
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <Alert variant="info">
                      <p className="font-medium mb-2">How Quote Syncing Works:</p>
                      <ul className="text-sm space-y-1 list-disc list-inside">
                        <li>When a quote is synced, a contact is created in CRM with all quote data</li>
                        <li>If &quot;Create Opportunities&quot; is enabled, a deal/opportunity is also created</li>
                        <li>Tags configured in the Tags & Fields tab will be added to contacts</li>
                        <li>Custom fields are automatically created if needed (when auto-create is enabled)</li>
                        <li>Duplicate quotes are automatically detected and skipped</li>
                      </ul>
                    </Alert>
                  </>
                )}

                {config?.syncQuotes === false && (
                  <Alert variant="warning">
                    Quote syncing is currently disabled. Enable it above to start syncing quotes from MaidCentral to CRM.
                  </Alert>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="appointments">
            <Card padding="lg">
              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Sync Appointments"
                      description="When enabled, appointments will sync bidirectionally between MaidCentral and CRM calendars"
                      checked={config?.syncAppointments || false}
                      onChange={(e) => setConfig({ ...config!, syncAppointments: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>

                {config?.syncAppointments && (
                  <>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                        CRM Calendar
                      </label>
                      {loadingCalendars ? (
                        <div className="flex items-center gap-2 p-4 bg-gray-50 rounded-lg">
                          <LoadingSpinner size="sm" />
                          <span className="text-sm text-gray-500">Loading calendars...</span>
                        </div>
                      ) : calendars.length === 0 ? (
                        <Alert variant="warning">
                          <p className="mb-2"><strong>No calendars found.</strong></p>
                          <p className="text-sm mb-2">This could mean:</p>
                          <ul className="text-sm list-disc list-inside space-y-1">
                            <li>No calendars exist in your CRM location</li>
                            <li>The calendar API endpoint may need adjustment</li>
                            <li>Check the browser console and server logs for API errors</li>
                          </ul>
                          <p className="text-sm mt-2">
                            <strong>Note:</strong> You can still enter a calendar ID manually below.
                          </p>
                        </Alert>
                      ) : (
                        <Select
                          options={[
                            { value: '', label: 'Select a calendar...' },
                            ...calendars.map(c => ({ value: c.id, label: c.name }))
                          ]}
                          value={config?.ghlCalendarId || ''}
                          onChange={(e) => setConfig({ ...config!, ghlCalendarId: e.target.value || undefined })}
                          disabled={!config?.enabled || !config?.syncAppointments}
                        />
                      )}
                      <Input
                        label="Or enter Calendar ID manually"
                        value={config?.ghlCalendarId || ''}
                        onChange={(e) => setConfig({ ...config!, ghlCalendarId: e.target.value || undefined })}
                        disabled={!config?.enabled || !config?.syncAppointments}
                        placeholder="e.g., abc123xyz"
                        helperText="Enter the calendar ID if you know it from your CRM account"
                      />
                    </div>

                    <div>
                      <Select
                        label="Conflict Resolution Strategy"
                        options={[
                          { value: 'timestamp', label: 'Most Recent Wins (timestamp-based)' },
                          { value: 'maid_central_wins', label: 'MaidCentral Always Wins' },
                          { value: 'ghl_wins', label: 'CRM Always Wins' },
                        ]}
                        value={config?.appointmentConflictResolution || 'timestamp'}
                        onChange={(e) => setConfig({ 
                          ...config!, 
                          appointmentConflictResolution: e.target.value as 'maid_central_wins' | 'ghl_wins' | 'timestamp'
                        })}
                        disabled={!config?.enabled || !config?.syncAppointments}
                        helperText="How to handle conflicts when the same appointment is modified in both systems"
                      />
                    </div>

                    <div>
                      <Input
                        label="Sync Interval (minutes)"
                        type="number"
                        min="5"
                        max="1440"
                        step="5"
                        value={config?.appointmentSyncInterval || 15}
                        onChange={(e) => setConfig({ ...config!, appointmentSyncInterval: parseInt(e.target.value) || 15 })}
                        disabled={!config?.enabled || !config?.syncAppointments}
                        helperText="How often to poll for appointment changes (5-1440 minutes). Webhooks are used when available."
                      />
                    </div>

                    <div>
                      <Button
                        onClick={async () => {
                          if (!ghlData?.locationId) {
                            setMessage({ type: 'error', text: 'Location ID is required' });
                            return;
                          }
                          
                          try {
                            const response = await fetch(`/api/sync/appointments?action=full&locationId=${ghlData.locationId}`, { method: 'POST' });
                            const data = await response.json();
                            if (response.ok) {
                              setMessage({ 
                                type: 'success', 
                                text: `Sync completed! ${data.synced || 0} appointments synced, ${data.errors || 0} errors.` 
                              });
                            } else {
                              setMessage({ type: 'error', text: data.error || 'Failed to sync appointments' });
                            }
                          } catch (error) {
                            setMessage({ type: 'error', text: 'Failed to sync appointments' });
                          }
                        }}
                        disabled={!config?.enabled || !config?.syncAppointments || !config?.ghlCalendarId}
                        variant="primary"
                      >
                        Sync All Appointments Now
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="field-mapping">
            <Card padding="lg">
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Field Mappings</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Map MaidCentral quote fields to CRM contact fields. Fields not mapped here will use automatic mapping.
                  </p>
                </div>

                {loadingFields ? (
                  <div className="flex items-center justify-center py-8">
                    <LoadingSpinner size="lg" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm text-gray-600">
                        {mappings.length} mapping{mappings.length !== 1 ? 's' : ''} configured
                      </p>
                      <Button onClick={addMapping} variant="primary" size="sm">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Add Mapping
                      </Button>
                    </div>

                    {mappings.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-lg">
                        <p className="text-gray-500 mb-4">No mappings configured</p>
                        <p className="text-sm text-gray-400 mb-4">
                          Fields will be automatically mapped based on field names
                        </p>
                        <Button onClick={addMapping} variant="secondary">
                          <PlusIcon className="w-4 h-4 mr-2" />
                          Add Your First Mapping
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {mappings.map((mapping, index) => (
                          <Card key={index} padding="md" className="bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  MaidCentral Field
                                </label>
                                <Select
                                  options={[
                                    { value: '', label: 'Select field...' },
                                    ...mcFields.map(field => ({ value: field.name, label: field.label }))
                                  ]}
                                  value={mapping.maidCentralField}
                                  onChange={(e) => updateMapping(index, 'maidCentralField', e.target.value)}
                                />
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  CRM Field
                                </label>
                                <div className="flex gap-2">
                                  <Select
                                    options={[
                                      { value: '', label: 'Select field...' },
                                      ...ghlFields.map(field => ({
                                        value: field.name,
                                        label: `${field.label}${field.category === 'opportunity' ? ' (Opportunity)' : ''}${field.category === 'object' ? ' (Object)' : ''}${field.category === 'contact' && field.type !== 'standard' ? ' (Contact Custom)' : ''}${field.type === 'standard' ? ' (Standard)' : ''}`
                                      }))
                                    ]}
                                    value={mapping.ghlField}
                                    onChange={(e) => updateMapping(index, 'ghlField', e.target.value)}
                                    className="flex-1"
                                  />
                                  {mappings.length > 1 && (
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => removeMapping(index)}
                                      className="px-3"
                                    >
                                      <TrashIcon className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}

                    {mappings.length > 0 && (
                      <div className="mt-6">
                        <Button 
                          onClick={saveMappings} 
                          variant="primary" 
                          disabled={savingMappings}
                          className="w-full"
                          size="lg"
                        >
                          {savingMappings ? (
                            <>
                              <LoadingSpinner size="sm" className="mr-2" />
                              Saving...
                            </>
                          ) : (
                            'Save Mappings'
                          )}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="tags">
            <Card padding="lg">
              <div className="space-y-6">
                <div>
                  <Input
                    label="CRM Tags (comma-separated)"
                    value={config?.ghlTags ? config.ghlTags.join(', ') : (config?.ghlTag || '')}
                    onChange={(e) => {
                      const tagsStr = e.target.value.trim();
                      if (tagsStr) {
                        const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
                        setConfig({ ...config!, ghlTags: tags, ghlTag: tags[0] || undefined });
                      } else {
                        setConfig({ ...config!, ghlTags: [], ghlTag: undefined });
                      }
                    }}
                    placeholder="e.g., MaidCentral Quote, Quote Source, New Lead"
                    disabled={!config?.enabled}
                    helperText="Enter multiple tags separated by commas. These tags will be added to contacts created/updated by the integration. Leave empty to skip tagging."
                  />
                  {config?.ghlTags && config.ghlTags.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {config.ghlTags.map((tag, index) => (
                        <Badge key={index} variant="info" size="lg">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                <Alert variant="info">
                  <p className="font-medium mb-2">Automatic Field Mapping:</p>
                  <ul className="text-sm space-y-1 list-disc list-inside">
                    <li><strong>Basic Fields:</strong> Name, email, phone, and address automatically map to CRM&apos;s native contact fields</li>
                    <li><strong>All Other Fields:</strong> Automatically create custom fields with prefix <code className="bg-white/50 px-1 rounded">{config?.customFieldPrefix || 'maidcentral_quote_'}</code></li>
                    <li><strong>No Manual Mapping:</strong> Everything happens automatically based on field names</li>
                  </ul>
                </Alert>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <Card padding="lg">
          <Button 
            onClick={saveConfig} 
            variant="primary" 
            disabled={saving || !config}
            className="w-full"
            size="lg"
          >
            {saving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </Card>
      </div>
    </LocationGuard>
  );
}

export default function SettingsPage() {
  return <SettingsPageContent />;
}
