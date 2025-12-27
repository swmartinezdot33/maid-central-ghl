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

    // Method 1: Check URL query parameters (synchronous, fastest)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const pathname = window.location.pathname;
    
    let urlLocationId: string | null = null;
    
    // Try query params first
    urlLocationId = urlParams.get('locationId') || 
                   urlParams.get('location_id') || 
                   urlParams.get('location') ||
                   urlParams.get('companyId') ||
                   urlParams.get('company_id');
    
    // Try hash params
    if (!urlLocationId) {
      urlLocationId = hashParams.get('locationId') || 
                     hashParams.get('location_id') || 
                     hashParams.get('location');
    }
    
    // Method 2: Extract from current URL path (e.g., /location/{locationId}/...)
    if (!urlLocationId) {
      const locationMatch = pathname.match(/\/location\/([^/]+)/i);
      if (locationMatch && locationMatch[1]) {
        urlLocationId = locationMatch[1];
        console.log('[GHL Iframe] ✅ Found in URL path:', urlLocationId);
      }
    }
    
    // Method 3: Check document.referrer (MOST RELIABLE for custom menu items)
    // This is often the best method since GHL loads custom menu items in iframes
    if (!urlLocationId && document.referrer) {
      try {
        const referrerUrl = new URL(document.referrer);
        
        // Extract from referrer URL path (e.g., /v2/location/{locationId}/... or /location/{locationId}/...)
        const referrerPathMatch = referrerUrl.pathname.match(/\/location\/([^/]+)/i);
        if (referrerPathMatch && referrerPathMatch[1]) {
          urlLocationId = referrerPathMatch[1];
          console.log('[GHL Iframe] ✅ Found in document.referrer path:', urlLocationId);
          console.log('[GHL Iframe] Referrer URL:', document.referrer);
        }
        
        // Check referrer query params
        if (!urlLocationId) {
          const referrerParams = new URLSearchParams(referrerUrl.search);
          urlLocationId = referrerParams.get('locationId') || 
                         referrerParams.get('location_id') || 
                         referrerParams.get('location');
          if (urlLocationId) {
            console.log('[GHL Iframe] ✅ Found in document.referrer params:', urlLocationId);
          }
        }
      } catch (e) {
        console.log('[GHL Iframe] Error parsing referrer:', e instanceof Error ? e.message : String(e));
      }
    }
    
    // Method 4: Check window.name (sometimes used for iframe communication)
    if (!urlLocationId && window.name) {
      try {
        const nameData = JSON.parse(window.name);
        if (nameData.locationId || nameData.location_id || nameData.location) {
          urlLocationId = nameData.locationId || nameData.location_id || nameData.location;
          console.log('[GHL Iframe] ✅ Found in window.name:', urlLocationId);
        }
      } catch (e) {
        // window.name might be a plain string
        if (window.name.length > 10 && window.name.length < 50) {
          console.log('[GHL Iframe] ⚠️ window.name might be locationId:', window.name);
        }
      }
    }
    
    const urlUserId = 
      urlParams.get('userId') || 
      urlParams.get('user_id') ||
      hashParams.get('userId') ||
      hashParams.get('user_id');

    if (urlLocationId) {
      console.log('[GHL Iframe] Found locationId in URL:', urlLocationId);
      console.log('[GHL Iframe] Full URL:', window.location.href);
      console.log('[GHL Iframe] Pathname:', window.location.pathname);
      hasLocationIdRef.current = true;
      setGHLContext({
        locationId: urlLocationId,
        userId: urlUserId || undefined,
      });
      // Don't wait for postMessage if we already have locationId from URL
      // Still listen for postMessage to get additional user data
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

      // Log all message origins for debugging
      console.log('[GHL Iframe] Message received from origin:', event.origin);
      
      // Verify origin is from GHL domains (but be lenient for debugging)
      const allowedOrigins = [
        'https://app.gohighlevel.com',
        'https://app.leadconnectorhq.com',
        'https://my.ricochetbusinesssolutions.com', // User's GHL domain
        'https://localhost', // For development
      ];
      
      // Check if origin matches (but don't block - just warn)
      const isAllowedOrigin = allowedOrigins.some(origin => event.origin.startsWith(origin));
      if (!isAllowedOrigin && event.origin !== window.location.origin) {
        console.warn('[GHL Iframe] Message from potentially untrusted origin:', event.origin);
        console.warn('[GHL Iframe] Allowed origins:', allowedOrigins);
        // Don't return - still process the message for debugging
      }

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
          console.log('[GHL Iframe] Encrypted data type:', typeof data.payload);
          console.log('[GHL Iframe] Encrypted data length:', data.payload?.length || 'N/A');
          
          // Send encrypted data to our backend for decryption
          fetch('/api/ghl/iframe-context/decrypt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ encryptedData: data.payload }),
          })
            .then(async (response) => {
              if (response.ok) {
                const result = await response.json();
                console.log('[GHL Iframe] Decryption result:', result);
                
                if (result.success && result.data) {
                  const userData = result.data;
                  console.log('[GHL Iframe] Decrypted user data:', userData);
                  
                  // GHL user data structure: { activeLocation: '...', companyId: '...', userId: '...', ... }
                  // activeLocation is the locationId we need (this is the key difference!)
                  const locationId = 
                    userData.activeLocation ||  // GHL uses 'activeLocation' for the current location
                    userData.locationId || 
                    userData.location_id || 
                    userData.location?.id || 
                    userData.location?.locationId ||
                    (userData.context && userData.context.locationId);
                  
                  if (locationId) {
                    console.log('[GHL Iframe] ✅ Retrieved from decrypted user data:', locationId);
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
                    console.warn('[GHL Iframe] User data decrypted but no locationId found. User data keys:', Object.keys(userData));
                    console.warn('[GHL Iframe] Available fields:', {
                      activeLocation: userData.activeLocation,
                      locationId: userData.locationId,
                      companyId: userData.companyId,
                      userId: userData.userId
                    });
                  }
                } else {
                  console.warn('[GHL Iframe] Decryption result not successful:', result);
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
      // Note: CORS will block parent window access, so we skip this
      // Instead, rely on URL parsing and postMessage
      
      // Try document.referrer (the URL that loaded this iframe)
      try {
        if (document.referrer) {
          const referrerUrl = new URL(document.referrer);
          
          // Try query params
          let referrerLocationId = referrerUrl.searchParams.get('locationId') || 
                                   referrerUrl.searchParams.get('location_id');
          
          // Try path pattern /location/{locationId}/
          if (!referrerLocationId) {
            const locationMatch = referrerUrl.pathname.match(/\/location\/([a-zA-Z0-9]+)/i);
            if (locationMatch && locationMatch[1]) {
              referrerLocationId = locationMatch[1];
            }
          }
          
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
    // Use Promise-based approach like Culture Index (set up listener BEFORE sending)
    const requestGHLUserData = (): Promise<void> => {
      return new Promise((resolve) => {
        if (window.parent && window.parent !== window) {
          console.log('[GHL Iframe] Requesting user data from GHL parent...');
          console.log('[GHL Iframe] Current origin:', window.location.origin);
          console.log('[GHL Iframe] Parent window exists:', !!window.parent);
          
          // Set up message listener BEFORE sending (critical for timing)
          const messageHandler = (event: MessageEvent) => {
            // This will be handled by the main handleMessage function
            // We just need to ensure listener is set up before sending
          };
          
          // Add listener
          window.addEventListener('message', messageHandler);
          
          // Send request using official GHL format
          try {
            console.log('[GHL Iframe] Sending postMessage: { message: "REQUEST_USER_DATA" }');
            window.parent.postMessage({ message: 'REQUEST_USER_DATA' }, '*');
            
            // Resolve after a short delay to allow message to be sent
            setTimeout(() => {
              resolve();
            }, 100);
          } catch (e) {
            console.warn('[GHL Iframe] Failed to send postMessage:', e);
            resolve();
          }
        } else {
          console.warn('[GHL Iframe] Not in iframe or parent window not accessible');
          resolve();
        }
      });
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

    // Request user data multiple times with delays to ensure parent is ready
    // GHL might load the iframe before the parent is ready to receive messages
    requestGHLUserData(); // Try immediately
    
    const requestTimeout1 = setTimeout(requestGHLUserData, 100);
    const requestTimeout2 = setTimeout(requestGHLUserData, 500);
    const requestTimeout3 = setTimeout(requestGHLUserData, 1000);
    const requestTimeout4 = setTimeout(requestGHLUserData, 2000);

    // Set timeout to stop loading if no message received
    // But only if we haven't found locationId from URL
    const timeout = setTimeout(() => {
      if (!hasLocationIdRef.current && !urlLocationId && !sessionStorage.getItem('ghl_locationId')) {
        console.warn('[GHL Iframe] No locationId received after 5 seconds');
        console.warn('[GHL Iframe] Current URL:', window.location.href);
        console.warn('[GHL Iframe] Pathname:', window.location.pathname);
        console.warn('[GHL Iframe] Search:', window.location.search);
        console.warn('[GHL Iframe] Referrer:', document.referrer);
        setError('No GHL context received. Make sure the app is loaded in a GHL iframe.');
        setLoading(false);
      } else if (urlLocationId && !hasLocationIdRef.current) {
        // We have locationId from URL but haven't set it yet - set it now
        console.log('[GHL Iframe] Setting locationId from URL after timeout check');
        setGHLContext({
          locationId: urlLocationId,
          userId: urlUserId || undefined,
        });
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
      clearTimeout(requestTimeout1);
      clearTimeout(requestTimeout2);
      clearTimeout(requestTimeout3);
      clearTimeout(requestTimeout4);
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

