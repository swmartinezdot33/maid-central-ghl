import axios, { AxiosError } from 'axios';
import { getMaidCentralCredentials, type MaidCentralCredentials } from './kv';

const MAID_CENTRAL_API_BASE_URL = process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export class MaidCentralServicesAPI {
  private async authenticate(): Promise<string> {
    const creds = await getMaidCentralCredentials();
    if (!creds || !creds.username || !creds.password) {
      throw new Error('Maid Central credentials not configured');
    }

    if (creds.accessToken && creds.tokenExpiresAt && creds.tokenExpiresAt > Date.now()) {
      return creds.accessToken;
    }

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

      return response.data.access_token;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Maid Central authentication failed: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  private async getAuthHeader(): Promise<string> {
    const token = await this.authenticate();
    return `Bearer ${token}`;
  }

  async getServices(params?: { limit?: number; offset?: number; category?: string }): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/services`, {
        headers: {
          Authorization: token,
        },
        params,
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/services`, {
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

  async getService(serviceId: string | number): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, {
        headers: {
          Authorization: token,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  async createService(serviceData: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.post(`${MAID_CENTRAL_API_BASE_URL}/services`, serviceData, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.post(`${MAID_CENTRAL_API_BASE_URL}/services`, serviceData, {
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

  async updateService(serviceId: string | number, serviceData: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.put(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, serviceData, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.put(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, serviceData, {
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

  async deleteService(serviceId: string | number): Promise<void> {
    const token = await this.getAuthHeader();
    
    try {
      await axios.delete(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, {
        headers: {
          Authorization: token,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        await axios.delete(`${MAID_CENTRAL_API_BASE_URL}/services/${serviceId}`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return;
      }
      throw error;
    }
  }
}

export const maidCentralServicesAPI = new MaidCentralServicesAPI();

