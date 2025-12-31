import axios, { AxiosInstance, AxiosError } from 'axios';
import { getMaidCentralCredentials, storeMaidCentralCredentials, type MaidCentralCredentials } from './kv';

const MAID_CENTRAL_API_BASE_URL = 'https://api.maidcentral.com';

// Create axios instance with timeout and retry configuration
const createAxiosInstance = (): AxiosInstance => {
  return axios.create({
    baseURL: MAID_CENTRAL_API_BASE_URL,
    timeout: 30000, // 30 second timeout for serverless functions
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export class MaidCentralAPI {
  private client: AxiosInstance;
  private credentials: MaidCentralCredentials | null = null;
  private locationId?: string;

  constructor(locationId?: string) {
    this.client = createAxiosInstance();
    this.locationId = locationId;
  }

  async authenticate(locationId?: string): Promise<string> {
    const locId = locationId || this.locationId;
    const creds = await getMaidCentralCredentials(locId);
    if (!creds || !creds.username || !creds.password) {
      throw new Error('Maid Central credentials not configured' + (locId ? ` for location ${locId}` : ''));
    }

    // Check if we have a valid token
    if (creds.accessToken && creds.tokenExpiresAt && creds.tokenExpiresAt > Date.now()) {
      return creds.accessToken;
    }

    // Get new token
    const params = new URLSearchParams({
      username: creds.username,
      password: creds.password,
      grant_type: 'password',
    });

    try {
      const response = await axios.post<TokenResponse>(
        `${MAID_CENTRAL_API_BASE_URL}/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData = response.data;
      const expiresAt = tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : Date.now() + 3600 * 1000; // Default to 1 hour

      const updatedCreds: MaidCentralCredentials = {
        ...creds,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
      };

      await storeMaidCentralCredentials(updatedCreds, locId);
      this.credentials = updatedCreds;

      return tokenData.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Maid Central authentication failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async refreshToken(locationId?: string): Promise<string> {
    const locId = locationId || this.locationId;
    const creds = await getMaidCentralCredentials(locId);
    if (!creds || !creds.refreshToken) {
      // Fallback to password grant
      return this.authenticate(locId);
    }

    const params = new URLSearchParams({
      username: creds.username,
      password: creds.password,
      grant_type: 'refresh_token',
      refresh_token: creds.refreshToken,
    });

    try {
      const response = await axios.post<TokenResponse>(
        `${MAID_CENTRAL_API_BASE_URL}/token`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      const tokenData = response.data;
      const expiresAt = tokenData.expires_in
        ? Date.now() + tokenData.expires_in * 1000
        : Date.now() + 3600 * 1000;

      const updatedCreds: MaidCentralCredentials = {
        ...creds,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || creds.refreshToken,
        tokenExpiresAt: expiresAt,
      };

      await storeMaidCentralCredentials(updatedCreds, locId);
      return tokenData.access_token;
    } catch (error) {
      // If refresh fails, try password grant
      return this.authenticate(locId);
    }
  }

  private async getAuthHeader(locationId?: string): Promise<string> {
    const token = await this.authenticate(locationId);
    return `Bearer ${token}`;
  }

  // ===== MaidCentral Lead / Quote / Booking (new Lead API) =====
  // NOTE: These use the documented /api/Lead/... endpoints

  // Create or update a Lead (Step 1)
  async createLead(leadPayload: any, locationId?: string): Promise<any> {
    const token = await this.getAuthHeader(locationId);
    
    const url = `${MAID_CENTRAL_API_BASE_URL}/api/Lead/CreateOrUpdate`;
    try {
      const response = await axios.post(url, leadPayload, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken(locationId);
        const response = await axios.post(url, leadPayload, {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  // Get a Lead (includes quote and booking information)
  // Reference: https://support.maidcentral.com/apidocs/gets-a-lead-3
  async getLead(leadId: string | number, locationId?: string): Promise<any> {
    const token = await this.getAuthHeader(locationId);
    const url = `${MAID_CENTRAL_API_BASE_URL}/api/Lead/Lead?leadId=${leadId}`;
    
    try {
      const response = await axios.get(url, {
        headers: {
          Authorization: token,
        },
      });
      return response.data?.Result || response.data?.data || response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken();
        const response = await axios.get(url, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return response.data?.Result || response.data?.data || response.data;
      }
      console.error('[Maid Central API] Error fetching lead:', error);
      throw error;
    }
  }

  // Create or update a Quote for a Lead (Step 2)
  async createOrUpdateQuote(quotePayload: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    const url = `${MAID_CENTRAL_API_BASE_URL}/api/Lead/CreateOrUpdateQuote`;
    try {
      const response = await axios.post(url, quotePayload, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken();
        const response = await axios.post(url, quotePayload, {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  // Calculate price without creating a Lead (can be used in Step 1/2 for real-time pricing)
  async calculatePrice(pricePayload: any): Promise<any> {
    const token = await this.getAuthHeader();
    const url = `${MAID_CENTRAL_API_BASE_URL}/api/Lead/CalculatePrice`;

    try {
      const response = await axios.post(url, pricePayload, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken();
        const response = await axios.post(url, pricePayload, {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  // Booking creation for online booking widget (Step 3)
  async createBooking(bookingPayload: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    const url = `${MAID_CENTRAL_API_BASE_URL}/api/Lead/BookQuote`;
    try {
      const response = await axios.post(url, bookingPayload, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken();
        const response = await axios.post(url, bookingPayload, {
          headers: {
            Authorization: `Bearer ${newToken}`,
            'Content-Type': 'application/json',
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  // Get available fields from a quote for mapping
  async getQuoteFields(): Promise<string[]> {
    // For the new MaidCentral Lead API, we don't yet have a simple "list quotes" endpoint.
    // Instead of trying to infer fields dynamically, return a sensible default set that
    // covers common quote properties. This keeps the field mapping UI working without
    // depending on a deprecated /quotes endpoint.
    return [
      // Lead/Quote Identifiers
      'LeadId',
      'QuoteId',
      'CustomerInformationId',
      'HomeInformationId',
      
      // Customer Information
      'FirstName',
      'LastName',
      'Email',
      'Phone',
      'Mobile',
      'PostalCode',
      
      // Quote Status
      'StatusId',
      'StatusName',
      'QuoteNumber',
      'QuoteTotal',
      'TotalAmount',
      'Amount',
      'Price',
      
      // Quote URL
      'MaidServiceQuoteUrl',
      'QuoteUrl',
      
      // Home Address
      'HomeAddress1',
      'HomeAddress2',
      'HomeCity',
      'HomeRegion',
      'HomeState',
      'HomePostalCode',
      'HomeZipCode',
      'HomeCountry',
      
      // Billing Address
      'BillingAddress1',
      'BillingAddress2',
      'BillingCity',
      'BillingRegion',
      'BillingState',
      'BillingPostalCode',
      'BillingZipCode',
      'BillingCountry',
      
      // Service Information
      'ScopeGroupId',
      'ScopeGroupName',
      'ServiceType',
      'ServiceName',
      'ScopesOfWork',
      
      // Dates
      'CreatedDate',
      'CreatedAt',
      'UpdatedDate',
      'UpdatedAt',
      'QuoteDate',
      'ScheduledDate',
      
      // Additional Fields
      'Notes',
      'Description',
      'Questions',
      'UTMSource',
      'UTMMedium',
      'UTMCampaign',
      'UTMTerm',
      'UTMContent',
    ];
  }

  // ===== Appointment/Booking API Methods =====
  // NOTE: Based on Maid Central API workflow, bookings are created via POST /api/Lead/BookQuote
  // Booked quotes become appointments. We can retrieve them via:
  // 1. Lead endpoint (GET /api/Lead/Lead?leadId={id}) - gets lead with quote/booking info
  // 2. Separate Bookings endpoint (if available)
  // References:
  // - https://support.maidcentral.com/apidocs/online-booking-to-api-workflow
  // - https://support.maidcentral.com/apidocs/one-page-maidcentral-api-workflow

  async getAppointments(filters?: { startDate?: string; endDate?: string; status?: string; leadId?: string | number }, locationId?: string): Promise<any[]> {
    const token = await this.getAuthHeader(locationId);
    
    // Try multiple endpoint patterns since exact endpoint structure needs verification
    const endpoints = [
      `/api/Bookings`, // If separate Bookings endpoint exists
      `/api/Lead/Bookings`, // If bookings are under Lead namespace
      `/api/Appointments`, // Alternative naming
    ];

    const params: any = {};
    if (filters?.startDate) params.startDate = filters.startDate;
    if (filters?.endDate) params.endDate = filters.endDate;
    if (filters?.status) params.status = filters.status;
    if (filters?.leadId) params.leadId = filters.leadId;

    let lastError: any = null;
    
    for (const endpoint of endpoints) {
      try {
        const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
        const response = await axios.get(url, {
          headers: {
            Authorization: token,
          },
          params,
        });
        const data = response.data?.Result || response.data?.data || response.data;
        if (Array.isArray(data)) {
          return data;
        }
        // If not array, continue to next endpoint
      } catch (error) {
        if (axios.isAxiosError(error)) {
          // If 404, try next endpoint. If 401, refresh token and retry
          if (error.response?.status === 401) {
            try {
              const newToken = await this.refreshToken();
              const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
              const response = await axios.get(url, {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                },
                params,
              });
              const data = response.data?.Result || response.data?.data || response.data;
              if (Array.isArray(data)) {
                return data;
              }
            } catch (retryError) {
              lastError = retryError;
              continue;
            }
          } else if (error.response?.status === 404) {
            // Endpoint doesn't exist, try next one
            lastError = error;
            continue;
          } else {
            lastError = error;
          }
        } else {
          lastError = error;
        }
      }
    }

    // If all endpoints failed, log and return empty array (graceful degradation)
    console.warn('[Maid Central API] Could not find valid appointments endpoint. Tried:', endpoints);
    console.warn('[Maid Central API] Last error:', lastError);
    return [];
  }

  async getAppointment(appointmentId: string | number, locationId?: string): Promise<any> {
    const token = await this.getAuthHeader(locationId);
    
    // Try multiple endpoint patterns
    const endpoints = [
      `/api/Bookings/${appointmentId}`,
      `/api/Lead/Bookings/${appointmentId}`,
      `/api/Appointments/${appointmentId}`,
    ];

    let lastError: any = null;
    
    for (const endpoint of endpoints) {
      try {
        const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
        const response = await axios.get(url, {
          headers: {
            Authorization: token,
          },
        });
        return response.data?.Result || response.data?.data || response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            try {
              const newToken = await this.refreshToken();
              const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
              const response = await axios.get(url, {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                },
              });
              return response.data?.Result || response.data?.data || response.data;
            } catch (retryError) {
              lastError = retryError;
              continue;
            }
          } else if (error.response?.status === 404) {
            // Endpoint doesn't exist, try next one
            lastError = error;
            continue;
          } else {
            lastError = error;
          }
        } else {
          lastError = error;
        }
      }
    }

    // If all endpoints failed, throw the last error
    console.error('[Maid Central API] Could not find valid appointment endpoint for ID:', appointmentId);
    throw lastError || new Error('Failed to fetch appointment from any known endpoint');
  }

  async updateAppointment(appointmentId: string | number, appointmentData: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    // Try multiple endpoint patterns
    const endpoints = [
      `/api/Bookings/${appointmentId}`,
      `/api/Lead/Bookings/${appointmentId}`,
      `/api/Appointments/${appointmentId}`,
    ];

    let lastError: any = null;
    
    for (const endpoint of endpoints) {
      try {
        const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
        const response = await axios.put(url, appointmentData, {
          headers: {
            Authorization: token,
            'Content-Type': 'application/json',
          },
        });
        return response.data?.Result || response.data?.data || response.data;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          if (error.response?.status === 401) {
            try {
              const newToken = await this.refreshToken();
              const url = `${MAID_CENTRAL_API_BASE_URL}${endpoint}`;
              const response = await axios.put(url, appointmentData, {
                headers: {
                  Authorization: `Bearer ${newToken}`,
                  'Content-Type': 'application/json',
                },
              });
              return response.data?.Result || response.data?.data || response.data;
            } catch (retryError) {
              lastError = retryError;
              continue;
            }
          } else if (error.response?.status === 404) {
            // Endpoint doesn't exist, try next one
            lastError = error;
            continue;
          } else {
            lastError = error;
          }
        } else {
          lastError = error;
        }
      }
    }

    // If all endpoints failed, throw the last error
    console.error('[Maid Central API] Could not find valid appointment update endpoint for ID:', appointmentId);
    throw lastError || new Error('Failed to update appointment - endpoint not found');
  }
}

export const maidCentralAPI = new MaidCentralAPI();

