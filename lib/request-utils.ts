import { NextRequest } from 'next/server';

/**
 * Extract location ID from request (query param, header, or body)
 * This ensures consistent location ID extraction across all API routes
 */
export function getLocationIdFromRequest(request: NextRequest): string | undefined {
  // Try query param first
  const queryLocationId = request.nextUrl.searchParams.get('locationId');
  if (queryLocationId) return queryLocationId;

  // Try header
  const headerLocationId = request.headers.get('x-ghl-location-id');
  if (headerLocationId) return headerLocationId;

  return undefined;
}

/**
 * Extract location ID from request body (for POST/PATCH requests)
 */
export async function getLocationIdFromBody(request: NextRequest): Promise<string | undefined> {
  try {
    const body = await request.json().catch(() => ({}));
    return body.locationId || body.ghlLocationId || body.location_id;
  } catch {
    return undefined;
  }
}

/**
 * Get location ID from request (tries query, header, then body)
 */
export async function getLocationId(request: NextRequest): Promise<string | undefined> {
  // Try query/header first (synchronous)
  const locationId = getLocationIdFromRequest(request);
  if (locationId) return locationId;

  // Try body (async)
  return await getLocationIdFromBody(request);
}

