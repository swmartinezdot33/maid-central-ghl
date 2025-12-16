import axios, { AxiosInstance } from 'axios';
import { getGHLPrivateToken, type GHLPrivateToken } from './kv';

const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';

// Create axios instance with timeout for serverless optimization
const createAxiosInstance = (): AxiosInstance => {
  return axios.create({
    baseURL: GHL_API_BASE_URL,
    timeout: 30000, // 30 second timeout for serverless functions
  });
};

interface GHLContact {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  [key: string]: any; // For custom fields
}

export class GHLAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = createAxiosInstance();
  }

  async getPrivateToken(): Promise<string> {
    const tokenData = await getGHLPrivateToken();
    if (!tokenData) {
      throw new Error('GHL private token not configured. Please add your private token in settings.');
    }
    if (!tokenData.privateToken || tokenData.privateToken.trim() === '') {
      throw new Error('GHL private token is empty. Please reconfigure your private token in settings.');
    }
    return tokenData.privateToken;
  }

  async getLocations(): Promise<any[]> {
    const token = await this.getPrivateToken();
    
    try {
      const response = await this.client.get('/locations/', {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
      });
      return response.data?.locations || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch locations: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getCustomFields(locationId: string): Promise<any[]> {
    const token = await this.getPrivateToken();
    
    try {
      const response = await this.client.get('/contacts/customFields/', {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params: {
          locationId,
        },
      });
      return response.data?.customFields || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch custom fields: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getStandardFields(): Promise<string[]> {
    // Standard GHL contact fields
    return [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address1',
      'city',
      'state',
      'postalCode',
      'country',
      'companyName',
      'website',
      'tags',
      'source',
    ];
  }

  async getAllFields(locationId: string): Promise<Array<{ name: string; label: string; type?: string }>> {
    const standardFields = await this.getStandardFields();
    const customFields = await this.getCustomFields(locationId);

    const standardFieldLabels: Record<string, string> = {
      firstName: 'First Name',
      lastName: 'Last Name',
      email: 'Email',
      phone: 'Phone',
      address1: 'Address',
      city: 'City',
      state: 'State',
      postalCode: 'Postal Code',
      country: 'Country',
      companyName: 'Company Name',
      website: 'Website',
      tags: 'Tags',
      source: 'Source',
    };

    const fields = standardFields.map((field) => ({
      name: field,
      label: standardFieldLabels[field] || field,
      type: 'standard',
    }));

    const customFieldsFormatted = customFields.map((field: any) => ({
      name: field.id || field.name,
      label: field.name || field.label,
      type: field.fieldType || 'custom',
    }));

    return [...fields, ...customFieldsFormatted];
  }

  async createContact(locationId: string, contactData: GHLContact): Promise<any> {
    const token = await this.getPrivateToken();
    
    try {
      const response = await this.client.post('/contacts/', contactData, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        params: {
          locationId,
        },
      });
      return response.data?.contact || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create contact: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }
}

export const ghlAPI = new GHLAPI();

