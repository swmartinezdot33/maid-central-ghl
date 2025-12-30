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
}

interface Calendar {
  id: string;
  name: string;
  description?: string;
  timezone?: string;
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
        setConfig(data.config || {
          enabled: false,
          syncQuotes: true,
          syncCustomers: false,
          createOpportunities: true,
          autoCreateFields: true,
          customFieldPrefix: 'maidcentral_quote_',
          syncAppointments: false,
          appointmentSyncInterval: 15,
          appointmentConflictResolution: 'timestamp',
        });
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

  const saveConfig = async () => {
    if (!ghlData?.locationId || !config) {
      setMessage({ type: 'error', text: 'Location ID is required or no configuration to save' });
      return;
    }
    
    setSaving(true);
    setMessage(null);

    try {
      const configToSave = { ...config, ghlLocationId: ghlData.locationId };
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
            <p className="text-gray-600 mt-1">Configure how data flows from Maid Central to GoHighLevel</p>
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
              <h3 className="text-lg font-semibold text-gray-900 mb-1">GoHighLevel Connection</h3>
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
            <TabsTrigger value="appointments">Appointment Sync</TabsTrigger>
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
                      label="Sync Quotes"
                      description="When enabled, new quotes from Maid Central will automatically create contacts and opportunities in GHL"
                      checked={config?.syncQuotes !== false}
                      onChange={(e) => setConfig({ ...config!, syncQuotes: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Sync Customers"
                      description="When enabled, customer updates from Maid Central will sync to GHL"
                      checked={config?.syncCustomers || false}
                      onChange={(e) => setConfig({ ...config!, syncCustomers: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Create Opportunities"
                      description="When enabled, an opportunity/deal will be created in GHL for each quote synced"
                      checked={config?.createOpportunities !== false}
                      onChange={(e) => setConfig({ ...config!, createOpportunities: e.target.checked })}
                      disabled={!config?.enabled || !config?.syncQuotes}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <Toggle
                      label="Auto-Create Custom Fields"
                      description="Automatically create custom fields in GHL for Maid Central data that doesn't map to native fields"
                      checked={config?.autoCreateFields !== false}
                      onChange={(e) => setConfig({ ...config!, autoCreateFields: e.target.checked })}
                      disabled={!config?.enabled}
                    />
                  </div>
                </div>
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
                      description="When enabled, appointments will sync bidirectionally between Maid Central and GoHighLevel calendars"
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
                        GHL Calendar
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
                            <li>No calendars exist in your GoHighLevel location</li>
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
                        helperText="Enter the calendar ID if you know it from your GHL account"
                      />
                    </div>

                    <div>
                      <Select
                        label="Conflict Resolution Strategy"
                        options={[
                          { value: 'timestamp', label: 'Most Recent Wins (timestamp-based)' },
                          { value: 'maid_central_wins', label: 'Maid Central Always Wins' },
                          { value: 'ghl_wins', label: 'GoHighLevel Always Wins' },
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

          <TabsContent value="tags">
            <Card padding="lg">
              <div className="space-y-6">
                <div>
                  <Input
                    label="GHL Tags (comma-separated)"
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
                    placeholder="e.g., Maid Central Quote, Quote Source, New Lead"
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
                    <li><strong>Basic Fields:</strong> Name, email, phone, and address automatically map to GHL's native contact fields</li>
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
