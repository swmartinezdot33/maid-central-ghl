/**
 * Quote Mapper
 * Transforms quote data from Maid Central to GoHighLevel format using user-defined field mappings
 */

import { getFieldMappings, type FieldMapping } from './db';

/**
 * Map Maid Central quote/lead data to GoHighLevel contact format using field mappings
 */
export async function mapQuoteToGHL(
  mcQuote: any,
  mappings: FieldMapping[]
): Promise<Record<string, any>> {
  const ghlData: Record<string, any> = {};
  const processedMcFields = new Set<string>();

  // Apply user-defined mappings
  for (const mapping of mappings) {
    if (!mapping.maidCentralField || !mapping.ghlField) {
      continue;
    }

    // Try to find the value in the Maid Central quote data
    // Check multiple possible field name variations
    const mcFieldVariations = [
      mapping.maidCentralField,
      mapping.maidCentralField.toLowerCase(),
      mapping.maidCentralField.toUpperCase(),
      camelToSnake(mapping.maidCentralField),
      snakeToCamel(mapping.maidCentralField),
    ];

    let value: any = undefined;
    let matchedField: string | null = null;

    for (const fieldName of mcFieldVariations) {
      if (mcQuote[fieldName] !== undefined && mcQuote[fieldName] !== null) {
        value = mcQuote[fieldName];
        matchedField = fieldName;
        break;
      }
    }

    // Also check nested fields (e.g., Quote.QuoteNumber, Lead.LeadId)
    if (value === undefined) {
      // Check common nested structures
      const nestedPaths = [
        `Quote.${mapping.maidCentralField}`,
        `Quote.${mapping.maidCentralField.toLowerCase()}`,
        `Lead.${mapping.maidCentralField}`,
        `Lead.${mapping.maidCentralField.toLowerCase()}`,
      ];

      for (const path of nestedPaths) {
        const pathParts = path.split('.');
        let nestedValue = mcQuote;
        for (const part of pathParts) {
          if (nestedValue && typeof nestedValue === 'object' && part in nestedValue) {
            nestedValue = nestedValue[part];
          } else {
            nestedValue = undefined;
            break;
          }
        }
        if (nestedValue !== undefined && nestedValue !== null) {
          value = nestedValue;
          matchedField = path;
          break;
        }
      }
    }

    // If we found a value, map it to the GHL field
    if (value !== undefined && value !== null) {
      // Handle special cases for name fields
      if (mapping.ghlField === 'firstName' && typeof value === 'string') {
        const nameParts = value.trim().split(/\s+/);
        if (nameParts.length > 0) {
          ghlData.firstName = nameParts[0];
          if (nameParts.length > 1) {
            ghlData.lastName = nameParts.slice(1).join(' ');
          }
        }
      } else if (mapping.ghlField === 'lastName' && typeof value === 'string') {
        // If lastName is already set from firstName mapping, don't overwrite
        if (!ghlData.lastName) {
          ghlData.lastName = value;
        }
      } else {
        ghlData[mapping.ghlField] = value;
      }

      if (matchedField) {
        processedMcFields.add(matchedField);
      }
    }
  }

  // Apply standard mappings for common fields if not already mapped
  const standardMappings: Record<string, string[]> = {
    firstName: ['FirstName', 'first_name', 'firstName', 'firstname'],
    lastName: ['LastName', 'last_name', 'lastName', 'lastname'],
    email: ['Email', 'email', 'EmailAddress', 'email_address'],
    phone: ['Phone', 'phone', 'PhoneNumber', 'phone_number', 'Mobile', 'mobile'],
    address1: ['Address', 'address', 'HomeAddress1', 'home_address1', 'BillingAddress1', 'billing_address1'],
    city: ['City', 'city', 'HomeCity', 'home_city', 'BillingCity', 'billing_city'],
    state: ['State', 'state', 'Region', 'region', 'HomeRegion', 'home_region', 'BillingRegion', 'billing_region'],
    postalCode: ['PostalCode', 'postal_code', 'ZipCode', 'zip_code', 'HomePostalCode', 'home_postal_code', 'BillingPostalCode', 'billing_postal_code'],
  };

  for (const [ghlField, mcFieldVariations] of Object.entries(standardMappings)) {
    // Skip if already mapped
    if (ghlData[ghlField] !== undefined) {
      continue;
    }

    // Try to find value in quote data
    for (const mcField of mcFieldVariations) {
      if (mcQuote[mcField] !== undefined && mcQuote[mcField] !== null && !processedMcFields.has(mcField)) {
        if (ghlField === 'firstName' && typeof mcQuote[mcField] === 'string') {
          const nameParts = mcQuote[mcField].trim().split(/\s+/);
          if (nameParts.length > 0) {
            ghlData.firstName = nameParts[0];
            if (nameParts.length > 1 && !ghlData.lastName) {
              ghlData.lastName = nameParts.slice(1).join(' ');
            }
          }
        } else {
          ghlData[ghlField] = mcQuote[mcField];
        }
        processedMcFields.add(mcField);
        break;
      }
    }
  }

  // Remove undefined/null fields
  Object.keys(ghlData).forEach(key => {
    if (ghlData[key] === undefined || ghlData[key] === null) {
      delete ghlData[key];
    }
  });

  return ghlData;
}

/**
 * Get all available fields from a Maid Central quote/lead for mapping
 */
export function extractQuoteFields(mcQuote: any): string[] {
  const fields = new Set<string>();

  function extractFields(obj: any, prefix: string = '') {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      // For arrays, extract fields from first item if it's an object
      if (obj.length > 0 && typeof obj[0] === 'object') {
        extractFields(obj[0], prefix);
      }
      return;
    }

    if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        // Skip internal/metadata fields
        if (key.startsWith('_') || key === 'metadata' || key === 'Metadata') {
          continue;
        }

        fields.add(fullKey);
        fields.add(key); // Also add without prefix

        // Recursively extract nested fields (limit depth to avoid too many fields)
        if (typeof value === 'object' && value !== null && !Array.isArray(value) && prefix.split('.').length < 2) {
          extractFields(value, fullKey);
        }
      }
    }
  }

  extractFields(mcQuote);
  return Array.from(fields).sort();
}

// Helper functions
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

