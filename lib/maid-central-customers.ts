import axios, { AxiosError } from 'axios';
import { getMaidCentralCredentials, type MaidCentralCredentials } from './kv';

const MAID_CENTRAL_API_BASE_URL = process.env.MAID_CENTRAL_API_BASE_URL || 'https://api.maidcentral.com';

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type: string;
}

export class MaidCentralCustomersAPI {
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

  async getCustomers(params?: { limit?: number; offset?: number; search?: string; query?: string }): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      // Try different parameter names that Maid Central API might use
      const apiParams: any = {};
      if (params?.limit) apiParams.limit = params.limit;
      if (params?.offset) apiParams.offset = params.offset;
      
      // Try multiple search parameter variations
      if (params?.search) {
        apiParams.search = params.search;
        apiParams.query = params.search;
        apiParams.q = params.search;
      }
      if (params?.query) {
        apiParams.query = params.query;
        apiParams.search = params.query;
        apiParams.q = params.query;
      }
      
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/customers`, {
        headers: {
          Authorization: token,
        },
        params: apiParams,
      });
      
      // Check if response is HTML (404 page)
      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        console.error('[Maid Central API] Customers endpoint returned HTML (404). API endpoint may not exist.');
        return [];
      }
      
      // If response has data array, filter client-side if API doesn't support search
      let customers = response.data?.data || response.data?.customers || response.data || [];
      
      // If API doesn't support search, filter client-side
      if (params?.search && Array.isArray(customers)) {
        const searchLower = params.search.toLowerCase();
        customers = customers.filter((customer: any) => {
          const name = (customer.name || customer.customerName || '').toLowerCase();
          const email = (customer.email || customer.customerEmail || '').toLowerCase();
          const phone = (customer.phone || customer.customerPhone || '').toLowerCase();
          const id = String(customer.id || '').toLowerCase();
          
          return name.includes(searchLower) || 
                 email.includes(searchLower) || 
                 phone.includes(searchLower) ||
                 id.includes(searchLower);
        });
      }
      
      return Array.isArray(customers) ? customers : { data: customers, customers };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          // Retry with new token
          const newToken = await this.authenticate();
          const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/customers`, {
            headers: {
              Authorization: `Bearer ${newToken}`,
            },
          params,
        });
        
        // Apply client-side filtering if needed
        let customers = response.data?.data || response.data?.customers || response.data || [];
        if (params?.search && Array.isArray(customers)) {
          const searchLower = params.search.toLowerCase();
          customers = customers.filter((customer: any) => {
            const name = (customer.name || customer.customerName || '').toLowerCase();
            const email = (customer.email || customer.customerEmail || '').toLowerCase();
            const phone = (customer.phone || customer.customerPhone || '').toLowerCase();
            const id = String(customer.id || '').toLowerCase();
            
            return name.includes(searchLower) || 
                   email.includes(searchLower) || 
                   phone.includes(searchLower) ||
                   id.includes(searchLower);
          });
        }
        
        // Check if response is HTML (404 page)
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('text/html')) {
          console.error('[Maid Central API] Customers endpoint returned HTML (404). API endpoint may not exist.');
          return [];
        }
        
        return Array.isArray(customers) ? customers : { data: customers, customers };
        }
        
        // Handle 404 or HTML responses (Maid Central returns HTML 404 pages)
        const contentType = error.response?.headers['content-type'] || '';
        if (error.response?.status === 404 || contentType.includes('text/html')) {
          console.error('[Maid Central API] Customers endpoint not found (404). The /customers endpoint may not exist in Maid Central API.');
          console.error('[Maid Central API] Please check the Maid Central API documentation for the correct endpoint.');
          return []; // Return empty array instead of throwing
        }
        
        console.error('[Maid Central API] Error fetching customers:', error.response?.status, error.response?.statusText);
        throw new Error(`Failed to fetch customers: ${error.response?.status} - ${error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  async getCustomer(customerId: string | number): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, {
        headers: {
          Authorization: token,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.get(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return response.data;
      }
      throw error;
    }
  }

  async createCustomer(customerData: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.post(`${MAID_CENTRAL_API_BASE_URL}/customers`, customerData, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.post(`${MAID_CENTRAL_API_BASE_URL}/customers`, customerData, {
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

  async updateCustomer(customerId: string | number, customerData: any): Promise<any> {
    const token = await this.getAuthHeader();
    
    try {
      const response = await axios.put(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, customerData, {
        headers: {
          Authorization: token,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        const response = await axios.put(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, customerData, {
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

  async deleteCustomer(customerId: string | number): Promise<void> {
    const token = await this.getAuthHeader();
    
    try {
      await axios.delete(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, {
        headers: {
          Authorization: token,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        const newToken = await this.authenticate();
        await axios.delete(`${MAID_CENTRAL_API_BASE_URL}/customers/${customerId}`, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });
        return;
      }
      throw error;
    }
  }

  async searchCustomers(query: string): Promise<any> {
    return this.getCustomers({ search: query });
  }
}

export const maidCentralCustomersAPI = new MaidCentralCustomersAPI();

