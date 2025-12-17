'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
  };
  ghlConnected: boolean;
  hasLocationId: boolean;
}

export default function Home() {
  const [status, setStatus] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch('/api/config', {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (data.error && (data.error.includes('DATABASE_URL') || data.error.includes('database'))) {
          setStatus({
            config: { enabled: false, fieldMappings: [] },
            ghlConnected: false,
            hasLocationId: false,
            dbError: true,
          } as any);
        } else {
          setStatus(data);
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error: any) {
      console.error('Error fetching status:', error);
      // Set a default status so the page can render even on error
      setStatus({
        config: { enabled: false, fieldMappings: [], syncQuotes: true, syncCustomers: false, createOpportunities: true, autoCreateFields: true, customFieldPrefix: 'maidcentral_quote_' },
        ghlConnected: false,
        hasLocationId: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as any);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Maid Central → GoHighLevel Integration</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>Maid Central → GoHighLevel Integration</h1>
        <p>Sync quotes from Maid Central to GoHighLevel automatically</p>
      </div>

      {(status as any)?.error && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Error Loading Configuration</strong>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {(status as any).error}
          </p>
        </div>
      )}

      {(status as any)?.dbError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Database Not Configured</strong>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Please set up your PostgreSQL database. Add <code>DATABASE_URL</code> to your environment variables.
            See the README for setup instructions.
          </p>
        </div>
      )}

      {!status && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Unable to Load Status</strong>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Please check your browser console for errors and ensure the API server is running.
          </p>
        </div>
      )}

      <div className="section">
        <h2 className="section-title">Integration Status</h2>
        
        <div className="flex-between mb-1">
          <span>GoHighLevel Connection:</span>
          <span className={`status-badge ${status?.ghlConnected ? 'success' : 'error'}`}>
            {status?.ghlConnected ? 'Connected' : 'Not Connected'}
          </span>
        </div>

        <div className="flex-between mb-1">
          <span>Maid Central Credentials:</span>
          <span className={`status-badge ${status?.config ? 'success' : 'error'}`}>
            {status?.config ? 'Configured' : 'Not Configured'}
          </span>
        </div>

        <div className="flex-between mb-1">
          <span>Auto Field Mapping:</span>
          <span className="status-badge success">
            Enabled
          </span>
        </div>

        <div className="flex-between mb-1">
          <span>Integration Status:</span>
          <span className={`status-badge ${status?.config?.enabled ? 'success' : 'warning'}`}>
            {status?.config?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>

        {(status?.config?.ghlTags && status.config.ghlTags.length > 0) && (
          <div className="flex-between mb-2">
            <span>GHL Tags:</span>
            <span className="status-badge success">
              {status.config.ghlTags.join(', ')}
            </span>
          </div>
        )}
        {(status?.config?.ghlTag && !status.config.ghlTags) && (
          <div className="flex-between mb-2">
            <span>GHL Tag:</span>
            <span className="status-badge success">
              {status.config.ghlTag}
            </span>
          </div>
        )}
      </div>

      <div className="section">
        <h2 className="section-title">Sync Controls</h2>
        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1rem' }}>
          <div className="flex-between" style={{ padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div>
              <strong>Quote Syncing</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                {status?.config?.syncQuotes !== false ? 'Enabled - Quotes will create contacts in GHL' : 'Disabled'}
              </p>
            </div>
            <span className={`status-badge ${status?.config?.syncQuotes !== false ? 'success' : 'error'}`}>
              {status?.config?.syncQuotes !== false ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex-between" style={{ padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div>
              <strong>Customer Syncing</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                {status?.config?.syncCustomers ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <span className={`status-badge ${status?.config?.syncCustomers ? 'success' : 'error'}`}>
              {status?.config?.syncCustomers ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex-between" style={{ padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div>
              <strong>Create Opportunities</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                {status?.config?.createOpportunities !== false ? 'Enabled - Opportunities created with quotes' : 'Disabled'}
              </p>
            </div>
            <span className={`status-badge ${status?.config?.createOpportunities !== false ? 'success' : 'error'}`}>
              {status?.config?.createOpportunities !== false ? 'ON' : 'OFF'}
            </span>
          </div>
          <div className="flex-between" style={{ padding: '0.75rem', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
            <div>
              <strong>Auto-Create Fields</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#666' }}>
                {status?.config?.autoCreateFields !== false ? 'Enabled - Custom fields created automatically' : 'Disabled'}
              </p>
            </div>
            <span className={`status-badge ${status?.config?.autoCreateFields !== false ? 'success' : 'error'}`}>
              {status?.config?.autoCreateFields !== false ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="flex" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <Link href="/setup" className="btn btn-primary">
            Setup & Configuration
          </Link>
          <Link href="/settings" className="btn btn-secondary">
            Settings & Toggles
          </Link>
          <Link href="/customers" className="btn btn-secondary">
            Customers
          </Link>
          <Link href="/quotes" className="btn btn-secondary">
            Quotes
          </Link>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">How to Sync Quotes</h2>
        <p style={{ marginBottom: '0.5rem' }}>
          Since Maid Central doesn't support webhooks, you can sync quotes manually:
        </p>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            <strong>Option 1:</strong> Use the Quotes page to view and sync individual quotes
          </p>
          <p style={{ margin: '0 0 0.5rem 0' }}>
            <strong>Option 2:</strong> Use the API endpoint directly (POST or GET):
          </p>
          <code style={{ 
            display: 'block', 
            padding: '0.5rem', 
            backgroundColor: '#fff', 
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            wordBreak: 'break-all',
            marginTop: '0.5rem'
          }}>
            {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/quote?quoteId=YOUR_QUOTE_ID` : 'Loading...'}
          </code>
        </div>
        <div style={{ 
          padding: '0.75rem', 
          backgroundColor: '#fff3cd', 
          borderRadius: '4px',
          borderLeft: '4px solid #ffc107',
          fontSize: '0.9rem'
        }}>
          <strong>Note:</strong> Manual sync is currently the only option. We're working on adding automatic polling in a future update.
        </div>
      </div>
    </div>
  );
}

