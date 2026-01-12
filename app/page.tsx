'use client';

import { useEffect, useState } from 'react';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LocationGuard } from '@/components/LocationGuard';
import { OAuthGuard } from '@/components/OAuthGuard';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusIndicator } from '@/components/ui/StatusIndicator';
import { Alert } from '@/components/ui/Alert';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface ConfigStatus {
  config: {
    enabled: boolean;
    fieldMappings: any[];
    ghlLocationId?: string;
    ghlTag?: string;
    ghlTags?: string[];
    syncQuotes?: boolean;
    syncCustomers?: boolean;
    createOpportunities?: boolean;
    autoCreateFields?: boolean;
    customFieldPrefix?: string;
    syncAppointments?: boolean;
    ghlCalendarId?: string;
    appointmentSyncInterval?: number;
    appointmentConflictResolution?: string;
    quotePollingEnabled?: boolean;
    quotePollingInterval?: number;
    lastQuotePollAt?: number;
  };
  ghlConnected: boolean;
  hasLocationId: boolean;
  appointmentSyncStatus?: {
    enabled: boolean;
    totalSynced: number;
    lastSync: string | null;
    calendarId?: string;
  };
}

export default function Home() {
  const { ghlData, loading: iframeLoading, error: iframeError } = useGHLIframe();
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iframeLoading && ghlData?.locationId) {
      fetchStatus();
    }
  }, [iframeLoading, ghlData?.locationId]);

  const fetchStatus = async () => {
    if (!ghlData?.locationId) {
      console.warn('[Home] Cannot fetch status without locationId');
      return;
    }
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const locationId = ghlData.locationId;
        const configUrl = `/api/config?locationId=${locationId}`;
        const configResponse = await fetch(configUrl, { signal: controller.signal });
        
        clearTimeout(timeoutId);
        
        if (!configResponse.ok) {
          const errorText = await configResponse.text();
          console.error('API error response:', errorText);
          throw new Error(`HTTP ${configResponse.status}: ${configResponse.statusText}`);
        }
        
        const data = await configResponse.json();
        
        if (data.error && (data.error.includes('DATABASE_URL') || data.error.includes('database'))) {
          setStatus({
            config: { enabled: false, fieldMappings: [] },
            ghlConnected: data.ghlConnected ?? false,
            hasLocationId: data.hasLocationId ?? false,
            dbError: true,
          } as any);
        } else {
          setStatus(data);
        }
        
        if (data.config?.syncAppointments && locationId) {
          fetch(`/api/sync/appointments/status?locationId=${locationId}`, {
            headers: {
              'x-ghl-location-id': locationId,
            },
          })
            .then(async (response) => {
              if (response.ok) {
                const appointmentData = await response.json();
                setStatus((prev) => ({
                  ...prev!,
                  appointmentSyncStatus: {
                    enabled: appointmentData.enabled || false,
                    totalSynced: appointmentData.totalSynced || 0,
                    lastSync: appointmentData.lastSync || null,
                    calendarId: appointmentData.calendarId,
                  },
                }));
              }
            })
            .catch((err) => {
              if (err.name !== 'AbortError') {
                console.log('Appointment status fetch failed (non-critical):', err);
              }
            });
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        if (fetchError?.name === 'AbortError') {
          setStatus({
            config: { enabled: false, fieldMappings: [], syncQuotes: true, syncCustomers: false, createOpportunities: true, autoCreateFields: true, customFieldPrefix: 'maidcentral_quote_' },
            ghlConnected: false,
            hasLocationId: false,
            error: 'Request timed out. Please check your connection.',
          } as any);
          return;
        }
        
        throw fetchError;
      }
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error('Error fetching status:', error);
      }
      
      setStatus({
        config: { enabled: false, fieldMappings: [], syncQuotes: true, syncCustomers: false, createOpportunities: true, autoCreateFields: true, customFieldPrefix: 'maidcentral_quote_' },
        ghlConnected: false,
        hasLocationId: false,
        error: error instanceof Error && error.name !== 'AbortError' ? error.message : 'Unknown error',
      } as any);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LocationGuard>
      <OAuthGuard>
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Hero Section */}
          <div className="bg-gradient-to-br from-primary-500 via-primary-600 to-primary-700 rounded-2xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">MaidCentral → CRM Integration</h1>
                <p className="text-primary-100 text-lg">Sync quotes, customers, and appointments automatically</p>
                {ghlData?.locationId && (
                  <div className="mt-4 flex items-center gap-2">
                    <Badge variant="default" size="sm" className="bg-white/20 text-white border-white/30">
                      {ghlData.locationName || ghlData.locationId}
                    </Badge>
                    {ghlData.userName && (
                      <Badge variant="default" size="sm" className="bg-white/20 text-white border-white/30">
                        {ghlData.userName}
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="hidden md:block">
                <div className="w-32 h-32 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <DocumentTextIcon className="w-16 h-16 text-white" />
                </div>
              </div>
            </div>
          </div>

          {/* Error Alerts */}
          {(status as any)?.error && (
            <Alert variant="error" title="Error Loading Configuration">
              {(status as any).error}
            </Alert>
          )}

          {(status as any)?.dbError && (
            <Alert variant="error" title="Database Not Configured">
              Please set up your PostgreSQL database. Add <code className="bg-white/50 px-1 rounded">DATABASE_URL</code> to your environment variables.
            </Alert>
          )}

          {iframeError && (
            <Alert variant="warning" title="Iframe Context Error">
              {iframeError}
            </Alert>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Card key={i} padding="lg">
                  <Skeleton className="h-6 w-32 mb-4" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card hover padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-500">CRM</h3>
                    {status?.ghlConnected ? (
                      <CheckCircleIcon className="w-6 h-6 text-success-600" />
                    ) : (
                      <XCircleIcon className="w-6 h-6 text-error-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {status?.ghlConnected ? 'Connected' : 'Not Connected'}
                  </p>
                  <StatusIndicator
                    status={status?.ghlConnected ? 'connected' : 'disconnected'}
                    label={status?.ghlConnected ? 'Active' : 'Inactive'}
                    size="sm"
                  />
                </Card>

                <Card hover padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-500">MaidCentral</h3>
                    {status?.config ? (
                      <CheckCircleIcon className="w-6 h-6 text-success-600" />
                    ) : (
                      <XCircleIcon className="w-6 h-6 text-error-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {status?.config ? 'Configured' : 'Not Configured'}
                  </p>
                  <StatusIndicator
                    status={status?.config ? 'connected' : 'disconnected'}
                    label={status?.config ? 'Ready' : 'Setup Required'}
                    size="sm"
                  />
                </Card>

                <Card hover padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-500">Integration</h3>
                    {status?.config?.enabled ? (
                      <CheckCircleIcon className="w-6 h-6 text-success-600" />
                    ) : (
                      <XCircleIcon className="w-6 h-6 text-warning-600" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {status?.config?.enabled ? 'Enabled' : 'Disabled'}
                  </p>
                  <StatusIndicator
                    status={status?.config?.enabled ? 'connected' : 'warning'}
                    label={status?.config?.enabled ? 'Active' : 'Inactive'}
                    size="sm"
                  />
                </Card>

                <Card hover padding="lg">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-500">Appointments</h3>
                    {status?.appointmentSyncStatus?.enabled ? (
                      <CheckCircleIcon className="w-6 h-6 text-success-600" />
                    ) : (
                      <XCircleIcon className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-gray-900 mb-1">
                    {status?.appointmentSyncStatus?.totalSynced || 0}
                  </p>
                  <p className="text-sm text-gray-500">Synced</p>
                </Card>
              </div>

              {/* Sync Controls */}
              <Card padding="lg">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Sync Controls</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Quote Syncing</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {status?.config?.syncQuotes !== false ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Badge variant={status?.config?.syncQuotes !== false ? 'success' : 'error'}>
                      {status?.config?.syncQuotes !== false ? 'ON' : 'OFF'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Customer Syncing</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {status?.config?.syncCustomers ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Badge variant={status?.config?.syncCustomers ? 'success' : 'error'}>
                      {status?.config?.syncCustomers ? 'ON' : 'OFF'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Opportunities</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {status?.config?.createOpportunities !== false ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Badge variant={status?.config?.createOpportunities !== false ? 'success' : 'error'}>
                      {status?.config?.createOpportunities !== false ? 'ON' : 'OFF'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Auto-Create Fields</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {status?.config?.autoCreateFields !== false ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                    <Badge variant={status?.config?.autoCreateFields !== false ? 'success' : 'error'}>
                      {status?.config?.autoCreateFields !== false ? 'ON' : 'OFF'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">Appointment Syncing</p>
                      <p className="text-sm text-gray-500 mt-1">
                        {status?.config?.syncAppointments ? `Enabled - ${status?.appointmentSyncStatus?.totalSynced || 0} synced` : 'Disabled'}
                      </p>
                      {status?.appointmentSyncStatus?.lastSync && (
                        <p className="text-xs text-gray-400 mt-1">
                          Last sync: {new Date(status.appointmentSyncStatus.lastSync).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <Badge variant={status?.config?.syncAppointments ? 'success' : 'error'}>
                      {status?.config?.syncAppointments ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Tags Display */}
              {(status?.config?.ghlTags && status.config.ghlTags.length > 0) && (
                <Card padding="lg">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Tags</h2>
                  <div className="flex flex-wrap gap-2">
                    {status.config.ghlTags.map((tag, index) => (
                      <Badge key={index} variant="info" size="lg">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </Card>
              )}

              {/* Quote & Booking Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create Quote & Booking */}
                <Card hover padding="lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Create Quote & Booking</h3>
                      <p className="text-sm text-gray-500 mt-1">Create quotes and book services directly from the dashboard</p>
                    </div>
                    <DocumentTextIcon className="w-8 h-8 text-primary-600 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Create quotes with automatic pricing calculation, select services, and book appointments. Data is automatically synced to GHL for marketing.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => window.location.href = '/quotes'}
                    className="w-full"
                  >
                    Go to Quotes
                  </Button>
                </Card>

                {/* Widget Customization */}
                <Card hover padding="lg">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Widget Configuration</h3>
                      <p className="text-sm text-gray-500 mt-1">Customize and embed the booking widget on your website</p>
                    </div>
                    <SparklesIcon className="w-8 h-8 text-primary-600 flex-shrink-0" />
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Customize widget colors, fonts, layout, and field visibility. Get embed code to add the widget to your website.
                  </p>
                  <Button
                    variant="primary"
                    onClick={() => window.location.href = '/widget-config'}
                    className="w-full"
                  >
                    Configure Widget
                  </Button>
                </Card>
              </div>
            </>
          )}
        </div>
      </OAuthGuard>
    </LocationGuard>
  );
}
