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
    try {
      const tokenData = await getGHLPrivateToken();
      if (!tokenData) {
        throw new Error('GHL private token not configured. Please add your private token in settings.');
      }
      if (!tokenData.privateToken || tokenData.privateToken.trim() === '') {
        throw new Error('GHL private token is empty. Please reconfigure your private token in settings.');
      }
      return tokenData.privateToken;
    } catch (error) {
      console.error('[GHL API] Error getting private token:', error);
      throw error;
    }
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

  async getContactCustomFields(locationId: string): Promise<any[]> {
    const token = await this.getPrivateToken();
    
    try {
      console.log(`[GHL API] Fetching contact custom fields for location: ${locationId}`);
      const response = await this.client.get(`/locations/${locationId}/customFields`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params: {
          fieldType: 'contact',
        },
      });
      
      // Handle different response structures - return ALL fields including empty ones
      const customFields = response.data?.customFields || 
                          response.data?.data?.customFields ||
                          (Array.isArray(response.data) ? response.data : []) ||
                          (Array.isArray(response.data?.data) ? response.data.data : []) ||
                          [];
      
      console.log(`[GHL API] Found ${customFields.length} contact custom fields`);
      return customFields;
    } catch (error) {
      console.error('[GHL API] Error fetching contact custom fields:', error);
      // Return empty array on error
      return [];
    }
  }

  async getOpportunityCustomFields(locationId: string): Promise<any[]> {
    const token = await this.getPrivateToken();
    
    try {
      console.log(`[GHL API] Fetching opportunity custom fields for location: ${locationId}`);
      const response = await this.client.get(`/locations/${locationId}/customFields`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params: {
          fieldType: 'opportunity',
        },
      });
      
      const customFields = response.data?.customFields || 
                          response.data?.data?.customFields ||
                          (Array.isArray(response.data) ? response.data : []) ||
                          (Array.isArray(response.data?.data) ? response.data.data : []) ||
                          [];
      
      console.log(`[GHL API] Found ${customFields.length} opportunity custom fields`);
      return customFields;
    } catch (error) {
      console.error('[GHL API] Error fetching opportunity custom fields:', error);
      // Return empty array on error
      return [];
    }
  }

  async getObjectCustomFields(locationId: string): Promise<any[]> {
    const token = await this.getPrivateToken();
    
    try {
      console.log(`[GHL API] Fetching object custom fields for location: ${locationId}`);
      // Try different endpoints for object custom fields
      let response;
      try {
        response = await this.client.get(`/locations/${locationId}/customFields`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: '2021-07-28',
          },
          params: {
            fieldType: 'object',
          },
        });
      } catch (error) {
        // Try alternative endpoint structure
        console.log('[GHL API] Trying alternative object fields endpoint...');
        response = await this.client.get(`/locations/${locationId}/customFields/object`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: '2021-07-28',
          },
        });
      }
      
      const customFields = response.data?.customFields || 
                          response.data?.data?.customFields ||
                          response.data?.objectCustomFields ||
                          (Array.isArray(response.data) ? response.data : []) ||
                          (Array.isArray(response.data?.data) ? response.data.data : []) ||
                          [];
      
      console.log(`[GHL API] Found ${customFields.length} object custom fields`);
      return customFields;
    } catch (error) {
      console.error('[GHL API] Error fetching object custom fields:', error);
      // Return empty array on error
      return [];
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

  async getAllFields(locationId: string): Promise<Array<{ name: string; label: string; type?: string; category?: string }>> {
    const standardFields = await this.getStandardFields();
    
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
      category: 'contact',
    }));

    console.log(`[GHL API] getAllFields called for location: ${locationId}`);
    
    // Fetch all custom field types in parallel
    const [contactCustomFields, opportunityCustomFields, objectCustomFields] = await Promise.all([
      this.getContactCustomFields(locationId),
      this.getOpportunityCustomFields(locationId),
      this.getObjectCustomFields(locationId),
    ]);

    // Format contact custom fields - include ALL fields, don't filter
    const contactCustomFieldsFormatted = contactCustomFields.map((field: any) => {
      const fieldId = field.id || field.fieldId || field._id || field.customFieldId || field.key;
      const fieldName = field.name || field.label || field.fieldName || field.title;
      const fieldType = field.fieldType || field.type || field.dataType || field.field_type || 'custom';
      
      return {
        name: fieldId || field.key || fieldName || `contact_custom_${contactCustomFields.indexOf(field)}`,
        label: fieldName || field.label || fieldId || 'Custom Field',
        type: fieldType,
        category: 'contact',
      };
    });

    // Format opportunity custom fields - include ALL fields, don't filter
    const opportunityCustomFieldsFormatted = opportunityCustomFields.map((field: any) => {
      const fieldId = field.id || field.fieldId || field._id || field.customFieldId || field.key;
      const fieldName = field.name || field.label || field.fieldName || field.title;
      const fieldType = field.fieldType || field.type || field.dataType || field.field_type || 'custom';
      
      return {
        name: fieldId || field.key || fieldName || `opportunity_custom_${opportunityCustomFields.indexOf(field)}`,
        label: fieldName || field.label || fieldId || 'Custom Field',
        type: fieldType,
        category: 'opportunity',
      };
    });

    // Format object custom fields - include ALL fields, don't filter
    const objectCustomFieldsFormatted = objectCustomFields.map((field: any) => {
      const fieldId = field.id || field.fieldId || field._id || field.customFieldId || field.key;
      const fieldName = field.name || field.label || field.fieldName || field.title;
      const fieldType = field.fieldType || field.type || field.dataType || field.field_type || 'custom';
      
      return {
        name: fieldId || field.key || fieldName || `object_custom_${objectCustomFields.indexOf(field)}`,
        label: fieldName || field.label || fieldId || 'Custom Field',
        type: fieldType,
        category: 'object',
      };
    });

    const allFields = [
      ...fields,
      ...contactCustomFieldsFormatted,
      ...opportunityCustomFieldsFormatted,
      ...objectCustomFieldsFormatted,
    ];

    console.log(`[GHL API] Total fields: ${fields.length} standard + ${contactCustomFields.length} contact custom + ${opportunityCustomFields.length} opportunity custom + ${objectCustomFields.length} object custom = ${allFields.length}`);

    return allFields;
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

  async getContact(locationId: string, contactId: string): Promise<any> {
    const token = await this.getPrivateToken();
    
    try {
      const response = await this.client.get(`/contacts/${contactId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params: {
          locationId,
        },
      });
      return response.data?.contact || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get contact: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async addTagToContact(locationId: string, contactId: string, tag: string): Promise<any> {
    // Support both single tag and array for backward compatibility
    return this.addTagsToContact(locationId, contactId, Array.isArray(tag) ? tag : [tag]);
  }

  async addTagsToContact(locationId: string, contactId: string, tags: string[]): Promise<any> {
    const token = await this.getPrivateToken();
    
    try {
      // First get the contact to see existing tags
      const contact = await this.getContact(locationId, contactId);
      const existingTags = contact.tags || [];
      
      // Add new tags if they don't already exist
      const tagsToAdd = tags.filter(tag => tag && tag.trim() && !existingTags.includes(tag.trim()));
      if (tagsToAdd.length === 0) {
        console.log(`[GHL API] All tags already exist on contact ${contactId}`);
        return contact;
      }
      
      const updatedTags = [...existingTags, ...tagsToAdd.map(t => t.trim())];
      
      const response = await this.client.put(`/contacts/${contactId}`, {
        tags: updatedTags,
      }, {
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
        throw new Error(`Failed to add tags to contact: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async createOpportunity(locationId: string, contactId: string, opportunityData: any): Promise<any> {
    const token = await this.getPrivateToken();
    
    try {
      const response = await this.client.post('/opportunities/', {
        contactId,
        ...opportunityData,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
        params: {
          locationId,
        },
      });
      return response.data?.opportunity || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to create opportunity: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  // Standard field mappings for automatic mapping
  private getStandardFieldMappings(): Record<string, string> {
    return {
      // Contact name fields
      firstName: 'firstName',
      firstname: 'firstName',
      first_name: 'firstName',
      lastName: 'lastName',
      lastname: 'lastName',
      last_name: 'lastName',
      name: 'firstName', // Will split if needed
      customerName: 'firstName', // Will split if needed
      
      // Contact info
      email: 'email',
      customerEmail: 'email',
      phone: 'phone',
      customerPhone: 'phone',
      telephone: 'phone',
      mobile: 'phone',
      
      // Address fields
      address: 'address1',
      address1: 'address1',
      street: 'address1',
      streetAddress: 'address1',
      city: 'city',
      state: 'state',
      zipCode: 'postalCode',
      zip: 'postalCode',
      postalCode: 'postalCode',
      postcode: 'postalCode',
      country: 'country',
      
      // Company
      companyName: 'companyName',
      company: 'companyName',
      
      // Source
      source: 'source',
    };
  }

  // Automatically map Maid Central fields to GHL fields
  autoMapFields(maidCentralData: any, customFieldPrefix: string = 'maidcentral_quote_'): Record<string, any> {
    const ghlData: Record<string, any> = {};
    const standardMappings = this.getStandardFieldMappings();
    const processedFields = new Set<string>();

    // First, map standard fields
    for (const [mcKey, ghlKey] of Object.entries(standardMappings)) {
      const keys = [mcKey, mcKey.toLowerCase(), this.camelToSnake(mcKey), this.snakeToCamel(mcKey)];
      
      for (const key of keys) {
        if (maidCentralData[key] !== undefined && maidCentralData[key] !== null && !processedFields.has(key)) {
          if (ghlKey === 'firstName' && maidCentralData[key]) {
            // Handle name splitting
            const nameParts = String(maidCentralData[key]).trim().split(/\s+/);
            if (nameParts.length > 0) {
              ghlData.firstName = nameParts[0];
              if (nameParts.length > 1) {
                ghlData.lastName = nameParts.slice(1).join(' ');
              }
            }
          } else {
            ghlData[ghlKey] = maidCentralData[key];
          }
          processedFields.add(key);
          break;
        }
      }
    }

    // Then, create custom fields for remaining fields
    for (const [key, value] of Object.entries(maidCentralData)) {
      if (value !== undefined && value !== null && !processedFields.has(key) && !key.startsWith('_')) {
        const customFieldName = `${customFieldPrefix}${this.normalizeFieldName(key)}`;
        ghlData[customFieldName] = value;
      }
    }

    return ghlData;
  }

  // Normalize field names for custom fields
  private normalizeFieldName(name: string): string {
    return name
      .replace(/[^a-zA-Z0-9]/g, '_')
      .replace(/_+/g, '_')
      .toLowerCase()
      .replace(/^_+|_+$/g, '');
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  // Create a custom field in GHL if it doesn't exist
  async ensureCustomField(locationId: string, fieldName: string, fieldLabel: string, fieldType: string = 'TEXT'): Promise<void> {
    const token = await this.getPrivateToken();
    
    try {
      // First, check if field already exists
      const existingFields = await this.getContactCustomFields(locationId);
      const fieldExists = existingFields.some((field: any) => 
        field.name === fieldName || field.key === fieldName || field.id === fieldName
      );

      if (fieldExists) {
        console.log(`[GHL] Custom field ${fieldName} already exists`);
        return;
      }

      // Create the custom field
      const response = await this.client.post(`/locations/${locationId}/customFields`, {
        name: fieldLabel,
        dataType: fieldType,
        fieldType: 'contact',
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
      });

      console.log(`[GHL] Created custom field: ${fieldName} (${fieldLabel})`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Field might already exist with a different structure, that's okay
        console.log(`[GHL] Could not create custom field ${fieldName}, may already exist:`, error.response?.data?.message || error.message);
      }
    }
  }

  // Ensure all custom fields exist in GHL
  async ensureCustomFields(locationId: string, fields: string[], customFieldPrefix: string): Promise<void> {
    for (const field of fields) {
      if (field.startsWith(customFieldPrefix)) {
        const fieldName = field.replace(customFieldPrefix, '');
        const fieldLabel = this.formatFieldLabel(fieldName);
        await this.ensureCustomField(locationId, field, fieldLabel);
      }
    }
  }

  private formatFieldLabel(fieldName: string): string {
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}

export const ghlAPI = new GHLAPI();

