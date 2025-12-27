'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WebhookConfig {
  id?: number;
  eventType: string;
  webhookUrl: string;
  enabled: boolean;
  secretToken?: string;
}

const EVENT_TYPES = [
  'quote.created',
  'quote.updated',
  'quote.deleted',
  'customer.created',
  'customer.updated',
  'customer.deleted',
  'booking.created',
  'booking.updated',
  'service.created',
  'service.updated',
];

export default function WebhooksPage() {
  const [configs, setConfigs] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<WebhookConfig>({
    eventType: 'quote.created',
    webhookUrl: '',
    enabled: true,
  });

  useEffect(() => {
    loadWebhooks();
  }, []);

  const loadWebhooks = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/maid-central/webhooks');
      const data = await response.json();
      
      if (response.ok) {
        setConfigs(data.configs || []);
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load webhooks' });
      }
    } catch (error) {
      console.error('Error loading webhooks:', error);
      setMessage({ type: 'error', text: 'Failed to load webhooks' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      const response = await fetch('/api/maid-central/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: 'Webhook configured successfully!' });
        setShowForm(false);
        setFormData({ eventType: 'quote.created', webhookUrl: '', enabled: true });
        loadWebhooks();
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save webhook' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save webhook' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this webhook configuration?')) {
      return;
    }

    try {
      const response = await fetch(`/api/maid-central/webhooks?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Webhook deleted successfully!' });
        loadWebhooks();
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || 'Failed to delete webhook' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete webhook' });
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>Webhook Configuration</h1>
        <p>Configure webhooks to receive real-time events from Maid Central</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="section">
        <div className="flex-between mb-2">
          <h2 className="section-title">Webhook Configurations</h2>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
              {showForm ? 'Cancel' : '+ Add Webhook'}
            </button>
            <Link href="/" className="btn" style={{ backgroundColor: '#e0e0e0' }}>
              ← Back
            </Link>
          </div>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="section" style={{ backgroundColor: '#f9f9f9', marginBottom: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>New Webhook Configuration</h3>
            <div className="form-group">
              <label htmlFor="eventType">Event Type</label>
              <select
                id="eventType"
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                required
              >
                {EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="webhookUrl">Webhook URL</label>
              <input
                type="url"
                id="webhookUrl"
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                placeholder="https://your-app.com/api/webhooks/maid-central"
                required
              />
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                This should point to: <code>https://maid-central-ghl.vercel.app/api/maid-central/webhooks/handler</code>
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="secretToken">Secret Token (optional)</label>
              <input
                type="text"
                id="secretToken"
                value={formData.secretToken || ''}
                onChange={(e) => setFormData({ ...formData, secretToken: e.target.value })}
                placeholder="Optional secret for webhook validation"
              />
            </div>

            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                />
                Enabled
              </label>
            </div>

            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Webhook'}
            </button>
          </form>
        )}

        {loading ? (
          <p>Loading webhooks...</p>
        ) : configs.length === 0 ? (
          <p style={{ color: '#666', fontStyle: 'italic' }}>No webhooks configured. Click "Add Webhook" to create one.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {configs.map((config) => (
              <div key={config.id} style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: '0.25rem' }}>
                      {config.eventType}
                      {config.enabled ? (
                        <span className="status-badge success" style={{ marginLeft: '0.5rem' }}>Enabled</span>
                      ) : (
                        <span className="status-badge" style={{ marginLeft: '0.5rem' }}>Disabled</span>
                      )}
                    </h3>
                    <p style={{ margin: 0, color: '#666', fontSize: '0.85rem', wordBreak: 'break-all' }}>
                      {config.webhookUrl}
                    </p>
                  </div>
                  <button
                    onClick={() => config.id && handleDelete(config.id)}
                    className="btn"
                    style={{ backgroundColor: '#dc2626', color: 'white' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}









