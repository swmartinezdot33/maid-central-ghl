'use client';

import { useEffect, useState } from 'react';
import { useGHLIframe } from '@/lib/ghl-iframe-context';
import Link from 'next/link';

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
      
      // Check if OAuth is installed - use installed field from API (which checks for accessToken)
      // The API returns installed: true if there's a valid accessToken
      const isInstalled = data.installed === true;
      const isExpired = data.isExpired === true;
      const tokenActuallyWorks = data.tokenActuallyWorks === true;
      
      console.log('[OAuthGuard] OAuth status check:', { 
        isInstalled, 
        isExpired,
        tokenActuallyWorks,
        apiInstalled: data.installed,
        apiHasToken: data.hasToken,
        apiIsExpired: data.isExpired,
        apiTokenActuallyWorks: data.tokenActuallyWorks,
        locationId: data.locationId,
        fullResponse: data
      });
      
      setOauthStatus({
        installed: isInstalled,
        // If token exists in DB, it's never expired - just show the app
        isExpired: false, // Always false - if token exists, show the app
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
      <div className="container">
        <div className="header">
          <h1>Loading...</h1>
          <p>Checking OAuth installation status...</p>
        </div>
      </div>
    );
  }

  if (!ghlData?.locationId) {
    return (
      fallback || (
        <div className="container">
          <div className="header">
            <h1>Location Context Required</h1>
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <strong>Unable to load location information</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                This app must be loaded within a GoHighLevel iframe to access location-specific data.
              </p>
            </div>
          </div>
        </div>
      )
    );
  }

  if (!oauthStatus?.installed) {
    return (
      fallback || (
        <div className="container">
          <div className="header">
            <h1>OAuth Installation Required</h1>
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              <strong>OAuth not installed for this location</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                This app requires OAuth installation before it can access location data. Please install the app via OAuth first.
              </p>
              <p style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#666' }}>
                Location ID: {ghlData.locationId}
              </p>
              <div style={{ marginTop: '1rem' }}>
                <Link href="/setup" className="btn btn-primary">
                  Go to Setup & Install OAuth
                </Link>
              </div>
            </div>
          </div>
        </div>
      )
    );
  }

  // Only show expired message if:
  // - Token test failed (tokenActuallyWorks === false), OR
  // - Token test wasn't run and timestamp says expired
  // If tokenActuallyWorks is true, the token is valid regardless of timestamp
  if (oauthStatus.isExpired) {
    return (
      fallback || (
        <div className="container">
          <div className="header">
            <h1>OAuth Token Expired</h1>
            <div className="alert alert-warning" style={{ marginTop: '1rem' }}>
              <strong>OAuth token has expired</strong>
              <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                Please reinstall the app via OAuth to refresh the token.
              </p>
              <div style={{ marginTop: '1rem' }}>
                <Link href="/setup" className="btn btn-primary">
                  Reinstall OAuth
                </Link>
              </div>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}

