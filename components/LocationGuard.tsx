'use client';

import { useGHLIframe } from '@/lib/ghl-iframe-context';

interface LocationGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * LocationGuard component that blocks rendering until locationId is available
 * This ensures all data is location-specific and prevents loading data without context
 */
export function LocationGuard({ children, fallback }: LocationGuardProps) {
  const { ghlData, loading, error } = useGHLIframe();

  if (loading) {
    return (
      <div className="container">
        <div className="header">
          <h1>Loading...</h1>
          <p>Waiting for location context from GoHighLevel...</p>
        </div>
      </div>
    );
  }

  if (error || !ghlData?.locationId) {
    return (
      fallback || (
        <div className="container">
          <div className="header">
            <h1>Location Context Required</h1>
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <strong>Unable to load location information</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                {error || 'This app must be loaded within a GoHighLevel iframe to access location-specific data.'}
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                Please ensure you are accessing this app through the GoHighLevel marketplace app installation.
              </p>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

