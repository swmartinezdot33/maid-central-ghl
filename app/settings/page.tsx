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
}

export default function SettingsPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

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
        });
      }
    } catch (error) {
      console.error('Error loading config:', error);
      setMessage({ type: 'error', text: 'Failed to load configuration' });
    } finally {
      setLoading(false);
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

