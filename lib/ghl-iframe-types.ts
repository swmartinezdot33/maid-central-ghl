/**
 * GHL Iframe Types
 * Shared types for GHL iframe context (can be imported by both client and server code)
 */

export interface GHLIframeData {
  locationId?: string;
  userId?: string;
  companyId?: string;
  locationName?: string;
  userName?: string;
  userEmail?: string;
  [key: string]: any;
}




