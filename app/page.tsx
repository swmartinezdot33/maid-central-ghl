'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface ConfigStatus {
  config: {
    enabled: boolean;
    fieldMappings: any[];
    ghlLocationId?: string;
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
      const response = await fetch('/api/config');
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
    } catch (error) {
      console.error('Error fetching status:', error);
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

      {(status as any)?.dbError && (
        <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
          <strong>Database Not Configured</strong>
          <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
            Please set up your PostgreSQL database. Add <code>DATABASE_URL</code> to your environment variables.
            See the README for setup instructions.
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
          <span>Field Mappings:</span>
          <span className={`status-badge ${status?.config?.fieldMappings?.length ? 'success' : 'warning'}`}>
            {status?.config?.fieldMappings?.length || 0} mappings configured
          </span>
        </div>

        <div className="flex-between mb-2">
          <span>Integration Status:</span>
          <span className={`status-badge ${status?.config?.enabled ? 'success' : 'warning'}`}>
            {status?.config?.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="flex" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <Link href="/setup" className="btn btn-primary">
            Setup & Configuration
          </Link>
          <Link href="/mapping" className="btn btn-secondary">
            Field Mapping
          </Link>
        </div>
      </div>

      <div className="section">
        <h2 className="section-title">Webhook URL</h2>
        <p style={{ marginBottom: '0.5rem' }}>
          Configure this webhook URL in Maid Central to trigger syncs when new quotes are created:
        </p>
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#f5f5f5', 
          borderRadius: '4px',
          fontFamily: 'monospace',
          fontSize: '0.9rem',
          wordBreak: 'break-all'
        }}>
          {typeof window !== 'undefined' ? `${window.location.origin}/api/webhook/quote` : 'Loading...'}
        </div>
      </div>
    </div>
  );
}

