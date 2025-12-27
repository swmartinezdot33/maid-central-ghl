'use client';

/**
 * GHL Iframe Context Hook
 * Listens for postMessage from GHL parent window to get location ID and user data
 */

import { useEffect, useState, createContext, useContext, useRef } from 'react';
import type { GHLIframeData } from './ghl-iframe-types';

export type { GHLIframeData };

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
  const hasLocationIdRef = useRef(false);

  useEffect(() => {
    // Check if we're in an iframe
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    // Helper function to extract and set GHL data
    const setGHLContext = (context: GHLIframeData) => {
      if (context.locationId) {
        hasLocationIdRef.current = true;
        setGhlData(context);
        setError(null);
        setLoading(false);

        // Store in sessionStorage for persistence
        sessionStorage.setItem('ghl_locationId', context.locationId);
        sessionStorage.setItem('ghl_iframeData', JSON.stringify(context));
        if (context.userId) {
          sessionStorage.setItem('ghl_userId', context.userId);
        }

        // Send to backend to store/update location-specific config
        fetch('/api/ghl/iframe-context', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(context),
        }).catch((err) => {
          console.error('Failed to store iframe context:', err);
        });
      }
    };

    // First, check URL parameters (GHL often passes locationId in iframe src)
    // Check query params, hash, and path
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const pathParts = window.location.pathname.split('/');
    
    const urlLocationId = 
      urlParams.get('locationId') || 
      urlParams.get('location_id') ||
      hashParams.get('locationId') ||
      hashParams.get('location_id') ||
      pathParts.find(part => part.length > 10 && /^[a-zA-Z0-9]+$/.test(part)); // GHL locationIds are usually long alphanumeric strings
    
    const urlUserId = 
      urlParams.get('userId') || 
      urlParams.get('user_id') ||
      hashParams.get('userId') ||
      hashParams.get('user_id');

    if (urlLocationId) {
      console.log('[GHL Iframe] Found locationId in URL:', urlLocationId);
      setGHLContext({
        locationId: urlLocationId,
        userId: urlUserId || undefined,
      });
    }

    // Check sessionStorage for cached data
    const cachedData = sessionStorage.getItem('ghl_iframeData');
    if (cachedData && !urlLocationId) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.locationId) {
          console.log('[GHL Iframe] Found cached locationId:', parsed.locationId);
          hasLocationIdRef.current = true;
          setGhlData(parsed);
          setLoading(false);
        }
      } catch (err) {
        console.error('Error parsing cached iframe data:', err);
      }
    }

    if (!isInIframe) {
      // Not in iframe - we've already checked URL params and sessionStorage
      if (!urlLocationId && !cachedData) {
        setLoading(false);
      }
      return;
    }

    // Listen for postMessage from GHL parent window
    const handleMessage = (event: MessageEvent) => {
      // Log all messages for debugging
      console.log('[GHL Iframe] Received message:', {
        origin: event.origin,
        data: event.data,
      });

      // Verify origin is from GHL domains
      const allowedOrigins = [
        'https://app.gohighlevel.com',
        'https://app.leadconnectorhq.com',
        'https://my.ricochetbusinesssolutions.com', // User's GHL domain
        'https://localhost', // For development
      ];
      
      // In production, you should verify origin:
      // if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
      //   console.warn('[GHL Iframe] Message from untrusted origin:', event.origin);
      //   return;
      // }

      try {
        let data = event.data;
        
        // Handle string data
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch {
            return; // Not JSON, skip
          }
        }

        // Handle GHL's official REQUEST_USER_DATA_RESPONSE
        if (data.message === "REQUEST_USER_DATA_RESPONSE" && data.payload) {
          console.log('[GHL Iframe] Received encrypted user data from GHL');
          
          // Send encrypted data to our backend for decryption
          fetch('/api/ghl/iframe-context/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData: data.payload }),
          })
            .then(async (response) => {
              if (response.ok) {
                const userData = await response.json();
                console.log('[GHL Iframe] Decrypted user data:', userData);
                
                // Extract locationId and other data from decrypted response
                const locationId = 
                  userData.locationId || 
                  userData.location_id || 
                  userData.location?.id || 
                  userData.location?.locationId;
                
                if (locationId) {
                  setGHLContext({
                    locationId,
                    userId: userData.userId || userData.user_id || userData.user?.id,
                    companyId: userData.companyId || userData.company_id,
                    locationName: userData.locationName || userData.location_name || userData.location?.name,
                    userName: userData.userName || userData.user_name || userData.user?.name,
                    userEmail: userData.userEmail || userData.user_email || userData.user?.email,
                    ...userData,
                  });
                } else {
                  console.warn('[GHL Iframe] No locationId in decrypted user data');
                }
              } else {
                const errorData = await response.json().catch(() => ({}));
                console.error('[GHL Iframe] Failed to decrypt user data:', errorData);
                // Fallback: try to extract locationId from encrypted payload if it's visible
                if (typeof data.payload === 'object' && data.payload.locationId) {
                  console.log('[GHL Iframe] Using locationId from payload directly');
                  setGHLContext({
                    locationId: data.payload.locationId,
                    ...data.payload,
                  });
                }
              }
            })
            .catch((err) => {
              console.error('[GHL Iframe] Error decrypting user data:', err);
              // Fallback: try to extract locationId from payload if it's visible
              if (typeof data.payload === 'object' && data.payload.locationId) {
                console.log('[GHL Iframe] Using locationId from payload directly (decrypt failed)');
                setGHLContext({
                  locationId: data.payload.locationId,
                  ...data.payload,
                });
              }
            });
          return;
        }

        // Handle other message formats (fallback)
        const locationId = 
          data.locationId || 
          data.location_id || 
          data.location?.id || 
          data.location?.locationId ||
          data.context?.locationId ||
          data.context?.location_id ||
          data.payload?.locationId;

        const userId = 
          data.userId || 
          data.user_id || 
          data.user?.id || 
          data.user?.userId ||
          data.context?.userId ||
          data.context?.user_id ||
          data.payload?.userId;

        const companyId = 
          data.companyId || 
          data.company_id || 
          data.company?.id ||
          data.context?.companyId ||
          data.payload?.companyId;

        const locationName = 
          data.locationName || 
          data.location_name || 
          data.location?.name ||
          data.context?.locationName ||
          data.payload?.locationName;

        const userName = 
          data.userName || 
          data.user_name || 
          data.user?.name ||
          data.context?.userName ||
          data.payload?.userName;

        const userEmail = 
          data.userEmail || 
          data.user_email || 
          data.user?.email ||
          data.context?.userEmail ||
          data.payload?.userEmail;

        if (locationId) {
          console.log('[GHL Iframe] Extracted locationId from message:', locationId);
          const ghlContext: GHLIframeData = {
            locationId,
            userId,
            companyId,
            locationName,
            userName,
            userEmail,
            ...data, // Include any other data
          };
          setGHLContext(ghlContext);
        }
      } catch (err) {
        console.error('[GHL Iframe] Error parsing message:', err, event.data);
      }
    };

    // Try to get locationId from various sources
    const tryGetFromParent = () => {
      try {
        if (window.parent && window.parent !== window) {
          // Try to access parent window properties (may be blocked by CORS)
          const parentUrl = window.parent.location?.href;
          if (parentUrl) {
            const parentParams = new URL(parentUrl);
            const parentLocationId = parentParams.searchParams.get('locationId') || 
                                   parentParams.searchParams.get('location_id');
            if (parentLocationId) {
              console.log('[GHL Iframe] Found locationId from parent URL:', parentLocationId);
              return parentLocationId;
            }
          }
        }
      } catch (e) {
        // CORS will block this, that's expected
        console.log('[GHL Iframe] Cannot access parent window (CORS):', e instanceof Error ? e.message : String(e));
      }
      
      // Try document.referrer (the URL that loaded this iframe)
      try {
        if (document.referrer) {
          const referrerUrl = new URL(document.referrer);
          const referrerLocationId = referrerUrl.searchParams.get('locationId') || 
                                    referrerUrl.searchParams.get('location_id') ||
                                    referrerUrl.pathname.match(/\/location\/([a-zA-Z0-9]+)/)?.[1];
          if (referrerLocationId) {
            console.log('[GHL Iframe] Found locationId from referrer:', referrerLocationId);
            return referrerLocationId;
          }
        }
      } catch (e) {
        console.log('[GHL Iframe] Error parsing referrer:', e instanceof Error ? e.message : String(e));
      }
      
      return null;
    };

    // Request user data from GHL parent using the official GHL protocol
    const requestGHLUserData = () => {
      if (window.parent && window.parent !== window) {
        console.log('[GHL Iframe] Requesting user data from GHL parent...');
        // Use GHL's official postMessage protocol
        window.parent.postMessage({ message: "REQUEST_USER_DATA" }, "*");
      }
    };

    // Listen for messages
    window.addEventListener('message', handleMessage);

    // Try to get from parent window first (before requesting)
    const parentLocationId = tryGetFromParent();
    if (parentLocationId && !urlLocationId) {
      setGHLContext({
        locationId: parentLocationId,
      });
    }

    // Request user data after a short delay to ensure parent is ready
    const requestTimeout = setTimeout(requestGHLUserData, 100);
    
    // Also try immediately (GHL might be ready)
    requestGHLUserData();

    // Set timeout to stop loading if no message received
    const timeout = setTimeout(() => {
      if (!hasLocationIdRef.current && !urlLocationId && !sessionStorage.getItem('ghl_locationId')) {
        console.warn('[GHL Iframe] No locationId received after 5 seconds');
        setError('No GHL context received. Make sure the app is loaded in a GHL iframe.');
        setLoading(false);
      }
    }, 5000);

    // Expose a global function for debugging/manual setting
    if (typeof window !== 'undefined') {
      (window as any).__ghlSetLocationId = (locationId: string, userId?: string) => {
        console.log('[GHL Iframe] Manually setting locationId:', locationId);
        setGHLContext({
          locationId,
          userId,
        });
      };
    }

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeout);
      clearTimeout(requestTimeout);
      if (typeof window !== 'undefined') {
        delete (window as any).__ghlSetLocationId;
      }
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

