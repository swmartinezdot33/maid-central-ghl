'use client';

/**
 * GHL Iframe Context Hook
 * Listens for postMessage from GHL parent window to get location ID and user data
 */

import { useEffect, useState, createContext, useContext } from 'react';

export interface GHLIframeData {
  locationId?: string;
  userId?: string;
  companyId?: string;
  locationName?: string;
  userName?: string;
  userEmail?: string;
  [key: string]: any;
}

interface GHLIframeContextType {
  ghlData: GHLIframeData | null;
  loading: boolean;
  error: string | null;
}

const GHLIframeContext = createContext<GHLIframeContextType>({
  ghlData: null,
  loading: true,
  error: null,
});

export function useGHLIframe() {
  return useContext(GHLIframeContext);
}

export function GHLIframeProvider({ children }: { children: React.ReactNode }) {
  const [ghlData, setGhlData] = useState<GHLIframeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in an iframe
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    if (!isInIframe) {
      // Not in iframe - try to get from URL params or sessionStorage
      const urlParams = new URLSearchParams(window.location.search);
      const locationId = urlParams.get('locationId') || sessionStorage.getItem('ghl_locationId');
      const userId = urlParams.get('userId') || sessionStorage.getItem('ghl_userId');

      if (locationId) {
        setGhlData({ locationId, userId: userId || undefined });
        sessionStorage.setItem('ghl_locationId', locationId);
        if (userId) sessionStorage.setItem('ghl_userId', userId);
      }
      setLoading(false);
      return;
    }

    // Listen for postMessage from GHL parent window
    const handleMessage = (event: MessageEvent) => {
      // Verify origin is from GHL (adjust domain as needed)
      // For now, we'll accept from any origin in development, but should restrict in production
      // if (event.origin !== 'https://app.gohighlevel.com') return;

      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;

        // GHL typically sends data in various formats
        // Common patterns:
        // 1. { type: 'ghl:iframe:ready', locationId: '...', userId: '...' }
        // 2. { locationId: '...', userId: '...' }
        // 3. Direct locationId/userId in data

        if (data.type === 'ghl:iframe:ready' || data.locationId || data.location_id) {
          const locationId = data.locationId || data.location_id;
          const userId = data.userId || data.user_id;
          const companyId = data.companyId || data.company_id;
          const locationName = data.locationName || data.location_name;
          const userName = data.userName || data.user_name;
          const userEmail = data.userEmail || data.user_email;

          const ghlContext: GHLIframeData = {
            locationId,
            userId,
            companyId,
            locationName,
            userName,
            userEmail,
            ...data, // Include any other data
          };

          setGhlData(ghlContext);
          setError(null);

          // Store in sessionStorage for persistence
          if (locationId) {
            sessionStorage.setItem('ghl_locationId', locationId);
            sessionStorage.setItem('ghl_iframeData', JSON.stringify(ghlContext));
          }
          if (userId) {
            sessionStorage.setItem('ghl_userId', userId);
          }

          // Send to backend to store/update location-specific config
          if (locationId) {
            fetch('/api/ghl/iframe-context', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(ghlContext),
            }).catch((err) => {
              console.error('Failed to store iframe context:', err);
            });
          }
        }
      } catch (err) {
        console.error('Error parsing GHL iframe message:', err);
      }
    };

    // Request initial data from parent (GHL standard)
    const requestInitialData = () => {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ type: 'ghl:iframe:ready' }, '*');
      }
    };

    // Listen for messages
    window.addEventListener('message', handleMessage);

    // Request initial data
    requestInitialData();

    // Also check sessionStorage for cached data
    const cachedData = sessionStorage.getItem('ghl_iframeData');
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.locationId) {
          setGhlData(parsed);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error parsing cached iframe data:', err);
      }
    }

    // Set timeout to stop loading if no message received
    const timeout = setTimeout(() => {
      if (!ghlData) {
        setError('No GHL context received. Make sure the app is loaded in a GHL iframe.');
        setLoading(false);
      }
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  // Update loading state when data is received
  useEffect(() => {
    if (ghlData?.locationId) {
      setLoading(false);
    }
  }, [ghlData]);

  return (
    <GHLIframeContext.Provider value={{ ghlData, loading, error }}>
      {children}
    </GHLIframeContext.Provider>
  );
}

