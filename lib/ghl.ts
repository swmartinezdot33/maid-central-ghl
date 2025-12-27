import axios, { AxiosInstance } from 'axios';
import { getGHLOAuthToken, type GHLOAuthToken } from './db';

// GHL API v2 base URL
const GHL_API_BASE_URL = 'https://services.leadconnectorhq.com';

// GHL API v2 endpoints - OAuth only (marketplace app)

// Create axios instance with timeout for serverless optimization
const createAxiosInstance = (): AxiosInstance => {
  const instance = axios.create({
    baseURL: GHL_API_BASE_URL,
    timeout: 30000, // 30 second timeout for serverless functions
  });
  
  // Add response interceptor to handle authorization errors
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status;
        const errorData = error.response?.data;
        
        // Handle 401/403 authorization errors
        if (status === 401 || status === 403) {
          const errorMessage = errorData?.message || errorData?.error || 'Invalid Authorization!';
          console.error('[GHL API] Authorization error:', {
            status,
            message: errorMessage,
            url: error.config?.url,
            locationId: error.config?.headers?.['x-ghl-location-id'],
          });
          
          // Create a more descriptive error
          const enhancedError = new Error(
            `Invalid Authorization! GHL API returned ${status}. ` +
            `The OAuth token may be expired, invalid, or not have the required permissions. ` +
            `Please reinstall the app via OAuth. Error: ${errorMessage}`
          );
          enhancedError.name = 'GHLAuthorizationError';
          return Promise.reject(enhancedError);
        }
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
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

  /**
   * Get OAuth access token for a location (preferred for marketplace apps)
   */
  async getOAuthToken(locationId?: string): Promise<string | null> {
    try {
      if (!locationId) {
        return null;
      }
      const oauthToken = await getGHLOAuthToken(locationId);
      if (!oauthToken?.accessToken) {
        return null;
      }
      
      // Check if token is expired and needs refresh
      if (oauthToken.expiresAt && Date.now() >= oauthToken.expiresAt) {
        if (oauthToken.refreshToken) {
          // TODO: Implement token refresh
          console.warn('[GHL API] OAuth token expired, refresh not yet implemented');
        }
        return null;
      }
      
      return oauthToken.accessToken;
    } catch (error) {
      console.error('[GHL API] Error getting OAuth token:', error);
      return null;
    }
  }

  /**
   * Get authentication token (OAuth only - marketplace app required)
   */
  async getAuthToken(locationId: string): Promise<string> {
    if (!locationId) {
      throw new Error('Location ID is required. Please install the app via OAuth for your location.');
    }
    
    const oauthToken = await this.getOAuthToken(locationId);
    if (!oauthToken) {
      // Check if token exists but is expired
      const storedToken = await getGHLOAuthToken(locationId);
      if (storedToken) {
        const isExpired = storedToken.expiresAt ? Date.now() >= storedToken.expiresAt : false;
        if (isExpired) {
          throw new Error(`GHL OAuth token for location ${locationId} has expired. Please reinstall the app via OAuth.`);
        }
        if (!storedToken.accessToken) {
          throw new Error(`GHL OAuth token for location ${locationId} is missing access token. Please reinstall the app via OAuth.`);
        }
      }
      throw new Error(`GHL OAuth not configured for location ${locationId}. Please install the app via OAuth in the setup page.`);
    }
    
    // Log token details for debugging (without exposing the full token)
    console.log('[GHL API] Using OAuth token for locationId:', locationId, 'Token length:', oauthToken.length);
    
    return oauthToken;
  }

  /**
   * @deprecated Use getAuthToken(locationId) instead
   */
  async getPrivateToken(): Promise<string> {
    throw new Error('Private tokens are no longer supported. Please use OAuth installation. Use getAuthToken(locationId) instead.');
  }

  async getLocations(locationId: string): Promise<any[]> {
    if (!locationId) {
      throw new Error('Location ID is required. OAuth installation required.');
    }
    
    const token = await this.getAuthToken(locationId);
    
    // Try to get the specific location
    try {
      const response = await this.client.get(`/locations/${locationId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
      });
      
      // Handle single location response
      if (response.data?.location) {
        return [response.data.location];
      }
      
      // Handle direct location data
      if (response.data?.id) {
        return [response.data];
      }
      
      return [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to fetch location: ${error.response?.data?.message || error.response?.statusText || error.message}`);
      }
      throw error;
    }
  }

  async getContactCustomFields(locationId: string): Promise<any[]> {
    const token = await this.getAuthToken(locationId);
    
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
    const token = await this.getAuthToken(locationId);
    
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
    const token = await this.getAuthToken(locationId);
    
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
    const token = await this.getAuthToken(locationId);
    
    try {
      const response = await this.client.post('/contacts', contactData, {
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
    const token = await this.getAuthToken(locationId);
    
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
    const token = await this.getAuthToken(locationId);
    
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
    const token = await this.getAuthToken(locationId);
    
    try {
      const response = await this.client.post('/opportunities', {
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
    const token = await this.getAuthToken(locationId);
    
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

  // ===== Calendar & Appointment API Methods =====
  // NOTE: These endpoints need to be verified with GoHighLevel API documentation

  async getCalendars(locationId: string): Promise<any[]> {
    const token = await this.getAuthToken(locationId);
    
    console.log(`[GHL API] Fetching calendars for location: ${locationId}`);
    
    // Try multiple endpoint patterns based on GHL API v2 documentation
    // DIAGNOSTIC RESULT: /calendars/ (with trailing slash) is the ONLY working endpoint
    const endpoints = [
      // Pattern 1: /calendars/ with locationId param (CONFIRMED WORKING)
      { url: '/calendars/', params: { locationId }, description: '/calendars/ with locationId param (CONFIRMED)' },
      // Pattern 2: /calendars with locationId param (Standard REST, but fails on GHL)
      { url: '/calendars', params: { locationId }, description: '/calendars with locationId param' },
      // Pattern 3: /locations/{locationId}/calendars (following pattern of /locations/{locationId}/customFields)
      { url: `/locations/${locationId}/calendars`, params: {}, description: '/locations/{locationId}/calendars' },
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`[GHL API] Trying endpoint: ${endpoint.description}`);
        const response = await this.client.get(endpoint.url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Version: '2021-07-28',
          },
          params: endpoint.params,
        });
        
        console.log('[GHL API] Calendars response:', {
          endpoint: endpoint.description,
          status: response.status,
          dataKeys: Object.keys(response.data || {}),
          hasCalendars: !!response.data?.calendars,
          hasData: !!response.data?.data,
          isArray: Array.isArray(response.data),
          dataLength: Array.isArray(response.data) ? response.data.length : 'not array',
          rawDataSample: JSON.stringify(response.data).substring(0, 200),
        });
        
        // Handle different response structures
        let calendars: any[] = [];
        if (Array.isArray(response.data)) {
          calendars = response.data;
        } else if (response.data?.calendars && Array.isArray(response.data.calendars)) {
          calendars = response.data.calendars;
        } else if (response.data?.data && Array.isArray(response.data.data)) {
          calendars = response.data.data;
        } else if (response.data?.calendar && Array.isArray(response.data.calendar)) {
          calendars = response.data.calendar;
        } else if (response.data?.calendars && typeof response.data.calendars === 'object') {
          // Sometimes calendars is an object with IDs as keys
          calendars = Object.values(response.data.calendars);
        }
        
        if (calendars.length > 0) {
          console.log(`[GHL API] Success! Found ${calendars.length} calendars using endpoint: ${endpoint.description}`);
          return calendars;
        } else {
          console.log(`[GHL API] Endpoint ${endpoint.description} returned empty array, trying next...`);
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          console.log(`[GHL API] Endpoint ${endpoint.description} failed:`, {
            status: error.response?.status,
            statusText: error.response?.statusText,
          });
          // Continue to next endpoint unless it's the last one
          if (endpoint === endpoints[endpoints.length - 1]) {
            // Last endpoint failed, throw error
            throw new Error(`All calendar endpoints failed. Last error: ${error.response?.status} ${error.response?.statusText}. Response: ${JSON.stringify(error.response?.data || {})}`);
          }
        } else {
          // Non-HTTP error, throw immediately
          throw error;
        }
      }
    }
    
    // If we get here, all endpoints returned empty arrays but no errors
    console.warn('[GHL API] All endpoints returned empty arrays - no calendars found');
    return [];
  }

  async getCalendar(calendarId: string, locationId: string): Promise<any> {
    const token = await this.getAuthToken(locationId);
    
    try {
      const response = await this.client.get(`/locations/${locationId}/calendars/${calendarId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
      });
      return response.data?.calendar || response.data?.data || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Failed to get calendar: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async getCalendarAppointments(calendarId: string, locationId: string, filters?: { startDate?: string; endDate?: string }): Promise<any[]> {
    const token = await this.getAuthToken(locationId);
    
    try {
      const params: any = { 
        locationId,
        calendarId, // Required for /calendars/events
        limit: 100 // Reasonable default
      };
      
      if (filters?.startDate) params.startTime = filters.startDate; // GHL uses startTime, not startDate
      if (filters?.endDate) params.endTime = filters.endDate;     // GHL uses endTime, not endDate

      console.log(`[GHL API] Fetching appointments for calendar ${calendarId} in location ${locationId}`);

      // Use the /calendars/events endpoint which is the standard for listing appointments in v2
      const response = await this.client.get('/calendars/events', {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params,
      });
      
      return response.data?.events || response.data?.appointments || response.data?.data || [];
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('[GHL API] Error fetching appointments:', error.response?.data);
        throw new Error(`Failed to get calendar appointments: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  async createCalendarAppointment(calendarId: string, locationId: string, appointmentData: any): Promise<any> {
    const token = await this.getAuthToken(locationId);
    
    try {
      // Try /calendars/events endpoint (confirmed to exist per API docs)
      const requestBody = {
        ...appointmentData,
        locationId,
        calendarId,
      };
      
      const response = await this.client.post('/calendars/events', requestBody, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
      });
      return response.data?.appointment || response.data?.event || response.data?.data || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Try fallback endpoint
        try {
          const response = await this.client.post(`/locations/${locationId}/calendars/${calendarId}/appointments`, appointmentData, {
            headers: {
              Authorization: `Bearer ${token}`,
              Version: '2021-07-28',
              'Content-Type': 'application/json',
            },
          });
          return response.data?.appointment || response.data?.data || response.data;
        } catch (fallbackError) {
          throw new Error(`Failed to create calendar appointment: ${(error as any).response?.data?.message || (fallbackError as any).response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }

  async updateCalendarAppointment(calendarId: string, appointmentId: string, locationId: string, appointmentData: any): Promise<any> {
    const token = await this.getAuthToken(locationId);
    
    try {
      // Try /calendars/events/{booking_id} endpoint (confirmed per API docs)
      const response = await this.client.put(`/calendars/events/${appointmentId}`, {
        ...appointmentData,
        locationId,
        calendarId,
      }, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
          'Content-Type': 'application/json',
        },
      });
      return response.data?.appointment || response.data?.event || response.data?.data || response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Try fallback endpoint
        try {
          const response = await this.client.put(`/locations/${locationId}/calendars/${calendarId}/appointments/${appointmentId}`, appointmentData, {
            headers: {
              Authorization: `Bearer ${token}`,
              Version: '2021-07-28',
              'Content-Type': 'application/json',
            },
          });
          return response.data?.appointment || response.data?.data || response.data;
        } catch (fallbackError) {
          throw new Error(`Failed to update calendar appointment: ${(error as any).response?.data?.message || (fallbackError as any).response?.data?.message || error.message}`);
        }
      }
      throw error;
    }
  }

  async deleteCalendarAppointment(calendarId: string, appointmentId: string, locationId: string): Promise<void> {
    const token = await this.getAuthToken(locationId);
    
    try {
      // Try /calendars/events/{booking_id} endpoint
      await this.client.delete(`/calendars/events/${appointmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Version: '2021-07-28',
        },
        params: {
          locationId,
          calendarId,
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Try fallback endpoint
        try {
          await this.client.delete(`/locations/${locationId}/calendars/${calendarId}/appointments/${appointmentId}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Version: '2021-07-28',
            },
          });
        } catch (fallbackError) {
          throw new Error(`Failed to delete calendar appointment: ${(error as any).response?.data?.message || (fallbackError as any).response?.data?.message || error.message}`);
        }
      } else {
        throw error;
      }
    }
  }
}

export const ghlAPI = new GHLAPI();

