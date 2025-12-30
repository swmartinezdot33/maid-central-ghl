'use client';

import { useEffect, useState } from 'react';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import Link from 'next/link';
import { LoadingSpinner } from './ui/LoadingSpinner';
import { Alert } from './ui/Alert';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

interface OAuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * OAuthGuard component that blocks rendering until OAuth is installed for the location
 * This ensures no data is displayed if OAuth has never been configured
 */
export function OAuthGuard({ children, fallback }: OAuthGuardProps) {
  const { ghlData, loading: iframeLoading } = useGHLIframe();
  const [oauthStatus, setOauthStatus] = useState<{ installed: boolean; isExpired?: boolean; tokenActuallyWorks?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!iframeLoading && ghlData?.locationId) {
      checkOAuthStatus();
    } else if (!iframeLoading && !ghlData?.locationId) {
      setLoading(false);
    }
  }, [iframeLoading, ghlData?.locationId]);

  const checkOAuthStatus = async () => {
    if (!ghlData?.locationId) {
      setLoading(false);
      return;
    }

    try {
      console.log('[OAuthGuard] Checking OAuth status for locationId:', ghlData.locationId);
      const response = await fetch(`/api/auth/oauth/status?locationId=${ghlData.locationId}`);
      const data = await response.json();
      console.log('[OAuthGuard] OAuth status response:', data);
      
      const isInstalled = data.installed === true;
      const isExpired = data.isExpired === true;
      const tokenActuallyWorks = data.tokenActuallyWorks === true;
      
      setOauthStatus({
        installed: isInstalled,
        isExpired: false,
        tokenActuallyWorks,
      });
    } catch (error) {
      console.error('[OAuthGuard] Error checking OAuth status:', error);
      setOauthStatus({ installed: false });
    } finally {
      setLoading(false);
    }
  };

  if (loading || iframeLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Card className="p-8 text-center">
          <LoadingSpinner size="lg" className="mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Loading...</h2>
          <p className="text-sm text-gray-500">Checking OAuth installation status...</p>
        </Card>
      </div>
    );
  }

  if (!ghlData?.locationId) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <Alert variant="error" title="Location Context Required">
              <p className="mb-4">
                This app must be loaded within a GoHighLevel iframe to access location-specific data.
              </p>
            </Alert>
          </Card>
        </div>
      )
    );
  }

  if (!oauthStatus?.installed) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <Alert variant="error" title="OAuth Installation Required">
              <p className="mb-4">
                This app requires OAuth installation before it can access location data. Please install the app via OAuth first.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Location ID: {ghlData.locationId}
              </p>
              <Link href="/setup">
                <Button variant="primary" className="w-full">
                  Go to Setup & Install OAuth
                </Button>
              </Link>
            </Alert>
          </Card>
        </div>
      )
    );
  }

  if (oauthStatus.isExpired) {
    return (
      fallback || (
        <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
          <Card className="max-w-md w-full">
            <Alert variant="warning" title="OAuth Token Expired">
              <p className="mb-4">
                Please reinstall the app via OAuth to refresh the token.
              </p>
              <Link href="/setup">
                <Button variant="primary" className="w-full">
                  Reinstall OAuth
                </Button>
              </Link>
            </Alert>
          </Card>
        </div>
      )
    );
  }

  return <>{children}</>;
}
