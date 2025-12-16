import axios, { AxiosInstance, AxiosError } from 'axios';
import { getMaidCentralCredentials, storeMaidCentralCredentials, type MaidCentralCredentials } from './kv';

const MAID_CENTRAL_API_BASE_URL = process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com';

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

  constructor() {
    this.client = createAxiosInstance();
  }

  async authenticate(): Promise<string> {
    const creds = await getMaidCentralCredentials();
    if (!creds || !creds.username || !creds.password) {
      throw new Error('Maid Central credentials not configured');
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

      await storeMaidCentralCredentials(updatedCreds);
      this.credentials = updatedCreds;

      return tokenData.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Maid Central authentication failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async refreshToken(): Promise<string> {
    const creds = await getMaidCentralCredentials();
    if (!creds || !creds.refreshToken) {
      // Fallback to password grant
      return this.authenticate();
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

      await storeMaidCentralCredentials(updatedCreds);
      return tokenData.access_token;
    } catch (error) {
      // If refresh fails, try password grant
      return this.authenticate();
    }
  }

  private async getAuthHeader(): Promise<string> {
    const token = await this.authenticate();
    return `Bearer ${token}`;
  }

  async getQuote(quoteId: string | number): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/quotes/${quoteId}`, {
        headers: {
          Authorization: token,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        // Token expired, refresh and retry
        const newToken = await this.refreshToken();
        const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/quotes/${quoteId}`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  async getQuotes(params?: { limit?: number; offset?: number; status?: string }): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/quotes`, {
        headers: {
          Authorization: token,
        },
        params,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.refreshToken();
        const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/quotes`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
          params,
        });
        return response.data;
      }
      throw error;
    }
  }

  // Get available fields from a quote for mapping
  async getQuoteFields(): Promise<string[]> {
    // Fetch a sample quote to determine available fields
    try {
      const quotes = await this.getQuotes({ limit: 1 });
      if (quotes?.data?.length > 0) {
        return Object.keys(quotes.data[0]);
      }
      // Return common fields if no quotes exist
      return [
        'id',
        'quoteNumber',
        'customerName',
        'customerEmail',
        'customerPhone',
        'address',
        'city',
        'state',
        'zipCode',
        'serviceType',
        'totalAmount',
        'status',
        'createdAt',
        'updatedAt',
      ];
    } catch (error) {
      // Return default fields if API call fails
      return [
        'id',
        'quoteNumber',
        'customerName',
        'customerEmail',
        'customerPhone',
        'address',
        'city',
        'state',
        'zipCode',
        'serviceType',
        'totalAmount',
        'status',
        'createdAt',
        'updatedAt',
      ];
    }
  }
}

export const maidCentralAPI = new MaidCentralAPI();

