'use client';

import { useGHLIframe } from '@/lib/ghl-iframe-context';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-sm text-gray-500">Waiting for location context from CRM...</p>
        </Card>
      </div>
    );
  }

  if (error || !ghlData?.locationId) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <Alert variant="error" title="Location Context Required">
              <p className="mb-4">
                {error || 'This app must be loaded within a CRM iframe to access location-specific data.'}
              </p>
              <p className="text-sm text-gray-600">
                Please ensure you are accessing this app through the CRM marketplace app installation.
              </p>
            </Alert>
          </Card>
        </div>
      )
    );
  }

  return <>{children}</>;
}
