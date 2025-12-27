'use client';

/**
 * API Client Helper
 * Automatically includes locationId from GHL iframe context in all API requests
 */

import { useGHLIframe } from './ghl-iframe-context';

export function useAPI() {
  const { ghlData } = useGHLIframe();
  const locationId = ghlData?.locationId;

  const fetchWithLocation = async (url: string, options: RequestInit = {}) => {
    const urlObj = new URL(url, typeof window !== 'undefined' ? window.location.origin : '');
    
    // Add locationId to query params if not already present
    if (locationId && !urlObj.searchParams.has('locationId')) {
      urlObj.searchParams.set('locationId', locationId);
    }

    // Add locationId to headers if not already present
    const headers = new Headers(options.headers);
    if (locationId && !headers.has('x-ghl-location-id')) {
      headers.set('x-ghl-location-id', locationId);
    }

    return fetch(urlObj.toString(), {
      ...options,
      headers,
    });
  };

  return {
    fetch: fetchWithLocation,
    locationId,
  };
}


