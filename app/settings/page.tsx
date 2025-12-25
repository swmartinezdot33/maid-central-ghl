'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Config {
  enabled: boolean;
  ghlLocationId?: string;
  ghlTag?: string; // DEPRECATED - kept for backward compatibility
  ghlTags?: string[]; // Multiple tags support
  syncQuotes: boolean;
  syncCustomers: boolean;
  createOpportunities: boolean;
  autoCreateFields: boolean;
  customFieldPrefix: string;
  // Appointment sync fields
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

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [loadingCalendars, setLoadingCalendars] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    // Load calendars when config is loaded and has location ID
    if (config?.ghlLocationId) {
      loadCalendars();
    }
  }, [config?.ghlLocationId]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/config');
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
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
    }
  };

  const loadCalendars = async () => {
    if (!config?.ghlLocationId) return;
    
    try {
      setLoadingCalendars(true);
      const response = await fetch('/api/ghl/calendars');
      const data = await response.json();
      
      if (response.ok) {
        if (data.calendars && Array.isArray(data.calendars)) {
          setCalendars(data.calendars);
          if (data.calendars.length === 0 && !data.error) {
            console.warn('No calendars found. This could mean:');
            console.warn('1. No calendars exist in your GHL location');
            console.warn('2. The calendar API endpoint may be incorrect');
            console.warn('3. Check the server logs for API errors');
          }
        } else {
          console.error('Invalid calendars response:', data);
          setCalendars([]);
        }
      } else {
        console.error('Failed to load calendars:', data.error);
        setCalendars([]);
        if (data.error) {
          setMessage({ type: 'error', text: `Failed to load calendars: ${data.error}` });
        }
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
      setCalendars([]);
      setMessage({ type: 'error', text: `Error loading calendars: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setLoadingCalendars(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Settings saved successfully!' });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save settings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Settings</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Integration Settings</h1>
        <p>Configure how data flows from Maid Central to GoHighLevel</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Integration Controls</h2>
          <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
            ← Back to Home
          </Link>
        </div>

        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Enable Integration</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                Master switch to enable/disable the entire integration
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.enabled || false}
                onChange={(e) => setConfig({ ...config!, enabled: e.target.checked })}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Sync Quotes</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                When enabled, new quotes from Maid Central will automatically create contacts and opportunities in GHL
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.syncQuotes !== false}
                onChange={(e) => setConfig({ ...config!, syncQuotes: e.target.checked })}
                disabled={!config?.enabled}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Sync Customers</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                When enabled, customer updates from Maid Central will sync to GHL
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.syncCustomers || false}
                onChange={(e) => setConfig({ ...config!, syncCustomers: e.target.checked })}
                disabled={!config?.enabled}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Create Opportunities</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                When enabled, an opportunity/deal will be created in GHL for each quote synced
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.createOpportunities !== false}
                onChange={(e) => setConfig({ ...config!, createOpportunities: e.target.checked })}
                disabled={!config?.enabled || !config?.syncQuotes}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Auto-Create Custom Fields</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                Automatically create custom fields in GHL for Maid Central data that doesn't map to native fields
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.autoCreateFields !== false}
                onChange={(e) => setConfig({ ...config!, autoCreateFields: e.target.checked })}
                disabled={!config?.enabled}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Appointment Sync Configuration</h2>
        
        <div className="mb-2" style={{ padding: '1rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <div className="flex-between mb-2">
            <div>
              <strong>Sync Appointments</strong>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                When enabled, appointments will sync bidirectionally between Maid Central and GoHighLevel calendars
              </p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={config?.syncAppointments || false}
                onChange={(e) => setConfig({ ...config!, syncAppointments: e.target.checked })}
                disabled={!config?.enabled}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {config?.syncAppointments && (
          <>
            <div className="form-group" style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
              <label htmlFor="ghlCalendar">GHL Calendar</label>
              {loadingCalendars ? (
                <select id="ghlCalendar" disabled style={{ padding: '0.5rem', width: '100%' }}>
                  <option>Loading calendars...</option>
                </select>
              ) : calendars.length === 0 ? (
                <div style={{ padding: '0.75rem', backgroundColor: '#fff3cd', borderRadius: '4px', fontSize: '0.85rem' }}>
                  <strong>No calendars found.</strong>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    This could mean:
                  </p>
                  <ul style={{ margin: '0.5rem 0 0 1.5rem', padding: 0, fontSize: '0.85rem' }}>
                    <li>No calendars exist in your GoHighLevel location</li>
                    <li>The calendar API endpoint may need adjustment</li>
                    <li>Check the browser console and server logs for API errors</li>
                  </ul>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    <strong>Note:</strong> You can still enter a calendar ID manually if you know it from your GHL account.
                  </p>
                </div>
              ) : (
                <select
                  id="ghlCalendar"
                  value={config?.ghlCalendarId || ''}
                  onChange={(e) => setConfig({ ...config!, ghlCalendarId: e.target.value || undefined })}
                  disabled={!config?.enabled || !config?.syncAppointments}
                  style={{ padding: '0.5rem', width: '100%' }}
                >
                  <option value="">Select a calendar...</option>
                  {calendars.map((calendar) => (
                    <option key={calendar.id} value={calendar.id}>
                      {calendar.name}
                    </option>
                  ))}
                </select>
              )}
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                Select which GoHighLevel calendar to sync appointments with. If no calendars appear above, check your GHL account to ensure calendars are set up in this location, or enter the calendar ID manually below.
              </p>
              <div className="form-group" style={{ maxWidth: '500px', marginTop: '1rem' }}>
                <label htmlFor="ghlCalendarIdManual">Or enter Calendar ID manually:</label>
                <input
                  type="text"
                  id="ghlCalendarIdManual"
                  value={config?.ghlCalendarId || ''}
                  onChange={(e) => setConfig({ ...config!, ghlCalendarId: e.target.value || undefined })}
                  disabled={!config?.enabled || !config?.syncAppointments}
                  placeholder="e.g., abc123xyz"
                  style={{ padding: '0.5rem', width: '100%' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
              <label htmlFor="conflictResolution">Conflict Resolution Strategy</label>
              <select
                id="conflictResolution"
                value={config?.appointmentConflictResolution || 'timestamp'}
                onChange={(e) => setConfig({ 
                  ...config!, 
                  appointmentConflictResolution: e.target.value as 'maid_central_wins' | 'ghl_wins' | 'timestamp'
                })}
                disabled={!config?.enabled || !config?.syncAppointments}
                style={{ padding: '0.5rem', width: '100%' }}
              >
                <option value="timestamp">Most Recent Wins (timestamp-based)</option>
                <option value="maid_central_wins">Maid Central Always Wins</option>
                <option value="ghl_wins">GoHighLevel Always Wins</option>
              </select>
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                How to handle conflicts when the same appointment is modified in both systems
              </p>
            </div>

            <div className="form-group" style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
              <label htmlFor="syncInterval">Sync Interval (minutes)</label>
              <input
                type="number"
                id="syncInterval"
                min="5"
                max="1440"
                step="5"
                value={config?.appointmentSyncInterval || 15}
                onChange={(e) => setConfig({ ...config!, appointmentSyncInterval: parseInt(e.target.value) || 15 })}
                disabled={!config?.enabled || !config?.syncAppointments}
                style={{ padding: '0.5rem', width: '100%' }}
              />
              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                How often to poll for appointment changes (5-1440 minutes). Webhooks are used when available.
              </p>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <button
                onClick={async () => {
                  try {
                    const response = await fetch('/api/sync/appointments?action=full', { method: 'POST' });
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
                className="btn"
                style={{ backgroundColor: '#2563eb', color: 'white' }}
              >
                Sync All Appointments Now
              </button>
            </div>
          </>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">GHL Tags Configuration</h2>
        <div className="form-group" style={{ maxWidth: '500px' }}>
          <label htmlFor="ghlTags">Tags (comma-separated)</label>
          <input
            type="text"
            id="ghlTags"
            value={config?.ghlTags ? config.ghlTags.join(', ') : (config?.ghlTag || '')}
            onChange={(e) => {
              const tagsStr = e.target.value.trim();
              if (tagsStr) {
                const tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
                setConfig({ ...config!, ghlTags: tags, ghlTag: tags[0] || undefined }); // Keep first tag for backward compatibility
              } else {
                setConfig({ ...config!, ghlTags: [], ghlTag: undefined });
              }
            }}
            placeholder="e.g., Maid Central Quote, Quote Source, New Lead"
            disabled={!config?.enabled}
          />
          <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
            Enter multiple tags separated by commas. These tags will be added to contacts created/updated by the integration. Leave empty to skip tagging.
          </p>
          {config?.ghlTags && config.ghlTags.length > 0 && (
            <div style={{ marginTop: '0.5rem', fontSize: '0.85rem' }}>
              <strong>Active tags:</strong> {config.ghlTags.join(', ')}
            </div>
          )}
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">How It Works</h2>
        <div style={{ padding: '1rem', backgroundColor: '#f0f7ff', borderRadius: '4px' }}>
          <p style={{ margin: '0 0 0.75rem 0', fontWeight: 500 }}>Automatic Field Mapping:</p>
          <ul style={{ margin: '0', paddingLeft: '1.5rem', lineHeight: '1.8' }}>
            <li><strong>Basic Fields:</strong> Name, email, phone, and address automatically map to GHL's native contact fields</li>
            <li><strong>All Other Fields:</strong> Automatically create custom fields with prefix <code>{config?.customFieldPrefix || 'maidcentral_quote_'}</code></li>
            <li><strong>No Manual Mapping:</strong> Everything happens automatically based on field names</li>
          </ul>
        </div>
      </div>

      <div className="section">
        <button 
          onClick={saveConfig} 
          className="btn btn-primary" 
          disabled={saving || !config}
          style={{ width: '100%' }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

