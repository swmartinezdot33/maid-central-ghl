'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Field {
  name: string;
  label: string;
  type?: string;
}

interface FieldMapping {
  maidCentralField: string;
  ghlField: string;
  maidCentralLabel?: string;
  ghlLabel?: string;
}

interface Config {
  enabled: boolean;
  ghlLocationId?: string;
  fieldMappings: FieldMapping[];
}

export default function MappingPage() {
  const router = useRouter();
  const [mcFields, setMcFields] = useState<Field[]>([]);
  const [ghlFields, setGhlFields] = useState<Field[]>([]);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load configuration
      const configRes = await fetch('/api/config');
      const configData = await configRes.json();
      setConfig(configData.config);
      setMappings(configData.config?.fieldMappings || []);

      // Load Maid Central fields
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
        setMessage({ type: 'error', text: 'Failed to load Maid Central fields. Please ensure credentials are configured.' });
      }

      // Load GHL fields (requires location ID)
      if (configData.config?.ghlLocationId) {
        try {
          const ghlRes = await fetch(`/api/ghl/fields?locationId=${configData.config.ghlLocationId}`);
          const ghlData = await ghlRes.json();
          setGhlFields(ghlData.fields || []);
        } catch (error) {
          console.error('Error loading GHL fields:', error);
          setMessage({ type: 'error', text: 'Failed to load GoHighLevel fields. Please ensure OAuth is completed.' });
        }
      } else {
        // Try to get locations first
        try {
          const locationsRes = await fetch('/api/ghl/locations');
          const locationsData = await locationsRes.json();
          if (locationsData.locations?.length > 0) {
            const firstLocation = locationsData.locations[0];
            const ghlRes = await fetch(`/api/ghl/fields?locationId=${firstLocation.id}`);
            const ghlData = await ghlRes.json();
            setGhlFields(ghlData.fields || []);
          }
        } catch (error) {
          console.error('Error loading GHL fields:', error);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage({ type: 'error', text: 'Failed to load data' });
    } finally {
      setLoading(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { maidCentralField: '', ghlField: '' }]);
  };

  const updateMapping = (index: number, field: keyof FieldMapping, value: string) => {
    const updated = [...mappings];
    updated[index] = { ...updated[index], [field]: value };
    
    // Update labels when field names change
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
    setSaving(true);
    setMessage(null);

    // Filter out incomplete mappings
    const validMappings = mappings.filter(m => m.maidCentralField && m.ghlField);

    try {
      const response = await fetch('/api/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: validMappings }),
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Field mappings saved successfully!' });
        setMappings(validMappings);
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to save mappings' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save mappings' });
    } finally {
      setSaving(false);
    }
  };

  const toggleIntegration = async (enabled: boolean) => {
    try {
      const response = await fetch('/api/config', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setConfig(data.config);
        setMessage({ type: 'success', text: `Integration ${enabled ? 'enabled' : 'disabled'}` });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update integration status' });
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Field Mapping</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Field Mapping</h1>
        <p>Map Maid Central quote fields to GoHighLevel contact fields</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Integration Toggle</h2>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={config?.enabled || false}
              onChange={(e) => toggleIntegration(e.target.checked)}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          {config?.enabled ? 'Integration is enabled and will process webhooks.' : 'Integration is disabled.'}
        </p>
      </div>

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Field Mappings</h2>
          <button onClick={addMapping} className="btn btn-primary btn-small">
            + Add Mapping
          </button>
        </div>

        {mappings.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>
            No mappings configured. Click "Add Mapping" to create one.
          </p>
        ) : (
          mappings.map((mapping, index) => (
            <div key={index} className="mapping-row">
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  Maid Central Field
                </label>
                <select
                  value={mapping.maidCentralField}
                  onChange={(e) => updateMapping(index, 'maidCentralField', e.target.value)}
                >
                  <option value="">Select field...</option>
                  {mcFields.map((field) => (
                    <option key={field.name} value={field.name}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                  GoHighLevel Field
                </label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select
                    value={mapping.ghlField}
                    onChange={(e) => updateMapping(index, 'ghlField', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select field...</option>
                    {ghlFields.map((field) => (
                      <option key={field.name} value={field.name}>
                        {field.label} {field.type === 'custom' ? '(Custom)' : ''}
                      </option>
                    ))}
                  </select>
                  {mappings.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeMapping(index)}
                      className="btn-remove"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        <div className="mt-2">
          <button onClick={saveMappings} className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Mappings'}
          </button>
        </div>
      </div>

      <div className="section">
        <button onClick={() => router.push('/')} className="btn" style={{ backgroundColor: '#e0e0e0' }}>
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

