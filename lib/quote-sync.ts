import { maidCentralAPI } from './maid-central';
import { ghlAPI } from './ghl';
import { IntegrationConfig, getFieldMappings } from './db';
import { markQuoteAsSynced, isQuoteSynced } from './db';
import { mapQuoteToGHL } from './quote-mapper';

/**
 * Sync a quote from MaidCentral to CRM
 * This function handles the full sync process including fetching lead data,
 * mapping fields, creating contacts, and tracking synced quotes.
 */
export async function syncQuote(
  locationId: string,
  quoteId: string | number,
  config: IntegrationConfig
): Promise<{ success: boolean; contactId?: string; opportunityId?: string; error?: string }> {
  try {
    // Check if quote is already synced
    const alreadySynced = await isQuoteSynced(locationId, quoteId);
    if (alreadySynced) {
      console.log(`[Quote Sync] Quote ${quoteId} already synced, skipping`);
      return { success: true, contactId: undefined, opportunityId: undefined };
    }

    if (!config.ghlLocationId) {
      throw new Error('CRM Location ID not configured');
    }

    // Try to get lead data from MaidCentral (leads contain quote information)
    // If quoteId is actually a leadId, we can fetch the full lead data
    let leadData: any = null;
    try {
      // Try to fetch as lead (quoteId might be a leadId)
      // Pass locationId to ensure we use the correct credentials
      leadData = await maidCentralAPI.getLead(quoteId, locationId);
      console.log(`[Quote Sync] Fetched lead data for ${quoteId}:`, !!leadData);
      
      // Log what data we received for debugging
      if (leadData) {
        console.log(`[Quote Sync] Lead data keys:`, Object.keys(leadData).slice(0, 20));
        console.log(`[Quote Sync] Quote-specific fields found:`, {
          QuoteNumber: leadData.QuoteNumber || leadData.quoteNumber,
          QuoteTotal: leadData.QuoteTotal || leadData.quoteTotal,
          QuoteId: leadData.QuoteId || leadData.quoteId,
          TotalAmount: leadData.TotalAmount || leadData.totalAmount,
        });
      }
    } catch (leadError) {
      console.error(`[Quote Sync] Could not fetch lead ${quoteId}:`, leadError);
      const errorMsg = leadError instanceof Error ? leadError.message : String(leadError);
      throw new Error(`Failed to fetch quote data from Maid Central: ${errorMsg}`);
    }

    if (!leadData) {
      throw new Error(`No data returned from Maid Central for quote/lead ${quoteId}`);
    }

    // Extract quote data from lead - include ALL fields from leadData
    // This ensures we capture all quote values that can be mapped
    const quote: Record<string, any> = {
      id: quoteId,
      // Include all raw lead data first
      ...leadData,
      
      // Extract and normalize quote-specific fields
      // Quote identifiers
      quoteNumber: leadData.QuoteNumber || leadData.quoteNumber || leadData.QuoteId || leadData.quoteId,
      quoteId: leadData.QuoteId || leadData.quoteId || leadData.QuoteNumber || leadData.quoteNumber,
      leadId: leadData.LeadId || leadData.leadId || quoteId,
      
      // Quote amounts and pricing
      totalAmount: leadData.QuoteTotal || leadData.quoteTotal || leadData.TotalAmount || leadData.totalAmount || leadData.Amount || leadData.amount,
      quoteTotal: leadData.QuoteTotal || leadData.quoteTotal,
      amount: leadData.QuoteTotal || leadData.quoteTotal || leadData.TotalAmount || leadData.totalAmount,
      price: leadData.QuoteTotal || leadData.quoteTotal || leadData.TotalAmount || leadData.totalAmount,
      
      // Customer information
      customerName: leadData.FirstName && leadData.LastName 
        ? `${leadData.FirstName} ${leadData.LastName}` 
        : leadData.CustomerName || leadData.customerName || leadData.Name || leadData.name,
      firstName: leadData.FirstName || leadData.firstName,
      lastName: leadData.LastName || leadData.lastName,
      customerEmail: leadData.Email || leadData.email || leadData.EmailAddress || leadData.emailAddress,
      customerPhone: leadData.Phone || leadData.phone || leadData.PhoneNumber || leadData.phoneNumber || leadData.Mobile || leadData.mobile,
      
      // Quote status
      status: leadData.StatusName || leadData.statusName || leadData.Status || leadData.status,
      statusName: leadData.StatusName || leadData.statusName,
      statusId: leadData.StatusId || leadData.statusId,
      
      // Address information
      address: leadData.HomeAddress1 || leadData.homeAddress1 || leadData.Address || leadData.address,
      address1: leadData.HomeAddress1 || leadData.homeAddress1 || leadData.BillingAddress1 || leadData.billingAddress1,
      address2: leadData.HomeAddress2 || leadData.homeAddress2 || leadData.BillingAddress2 || leadData.billingAddress2,
      city: leadData.HomeCity || leadData.homeCity || leadData.BillingCity || leadData.billingCity || leadData.City || leadData.city,
      state: leadData.HomeRegion || leadData.homeRegion || leadData.BillingRegion || leadData.billingRegion || leadData.State || leadData.state,
      postalCode: leadData.HomePostalCode || leadData.homePostalCode || leadData.BillingPostalCode || leadData.billingPostalCode || leadData.PostalCode || leadData.postalCode,
      
      // Dates
      createdAt: leadData.CreatedDate || leadData.createdDate || leadData.CreatedAt || leadData.createdAt,
      updatedAt: leadData.UpdatedDate || leadData.updatedDate || leadData.UpdatedAt || leadData.updatedAt,
      quoteDate: leadData.QuoteDate || leadData.quoteDate || leadData.CreatedDate || leadData.createdDate,
      
      // Quote URL
      quoteUrl: leadData.MaidServiceQuoteUrl || leadData.maidServiceQuoteUrl || leadData.QuoteUrl || leadData.quoteUrl,
    };
    
    console.log(`[Quote Sync] Extracted quote data:`, {
      id: quote.id,
      quoteNumber: quote.quoteNumber,
      totalAmount: quote.totalAmount,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      status: quote.status,
    });

    // Get field mappings from database
    const fieldMappings = await getFieldMappings();
    
    // Map quote data to GHL format using user-defined mappings
    let contactData: Record<string, any> = {};
    
    if (fieldMappings.length > 0) {
      // Use user-defined mappings
      console.log(`[Quote Sync] Using ${fieldMappings.length} field mappings`);
      contactData = await mapQuoteToGHL(quote, fieldMappings);
      console.log(`[Quote Sync] Mapped contact data fields:`, Object.keys(contactData).slice(0, 20));
    } else {
      // Fallback to auto-mapping if no mappings are configured
      console.log(`[Quote Sync] No field mappings found, using auto-mapping`);
      const prefix = config.customFieldPrefix || 'maidcentral_quote_';
      contactData = ghlAPI.autoMapFields(quote, prefix);
      console.log(`[Quote Sync] Auto-mapped contact data fields:`, Object.keys(contactData).slice(0, 20));
      
      // Ensure custom fields exist in CRM if auto-create is enabled
      if (config.autoCreateFields) {
        const customFieldNames = Object.keys(contactData).filter(key => key.startsWith(prefix));
        if (customFieldNames.length > 0) {
          console.log(`[Quote Sync] Ensuring ${customFieldNames.length} custom fields exist in CRM`);
          await ghlAPI.ensureCustomFields(config.ghlLocationId, customFieldNames, prefix);
        }
      }
    }
    
    // Ensure we have at least some contact data
    if (Object.keys(contactData).length === 0) {
      console.warn(`[Quote Sync] Warning: No contact data mapped. Using minimal contact data.`);
      // At minimum, try to create contact with email or phone
      if (quote.customerEmail) {
        contactData.email = quote.customerEmail;
      }
      if (quote.customerPhone) {
        contactData.phone = quote.customerPhone;
      }
      if (quote.firstName) {
        contactData.firstName = quote.firstName;
      }
      if (quote.lastName) {
        contactData.lastName = quote.lastName;
      }
    }

    // Create contact in CRM
    console.log(`[Quote Sync] Creating contact in CRM with data:`, {
      hasEmail: !!contactData.email,
      hasPhone: !!contactData.phone,
      hasFirstName: !!contactData.firstName,
      hasLastName: !!contactData.lastName,
      totalFields: Object.keys(contactData).length,
    });
    
    const contactResult = await ghlAPI.createContact(config.ghlLocationId, contactData);
    const contactId = contactResult.id || contactResult.contactId || contactResult._id;

    if (!contactId) {
      console.error(`[Quote Sync] Failed to get contact ID. Response:`, contactResult);
      throw new Error('Failed to get contact ID from CRM response');
    }
    
    console.log(`[Quote Sync] Contact created successfully: ${contactId}`);

    // Add tags to contact if configured
    const tagsToAdd: string[] = [];
    if (config.ghlTags && config.ghlTags.length > 0) {
      tagsToAdd.push(...config.ghlTags.filter(t => t && t.trim()));
    } else if (config.ghlTag) {
      tagsToAdd.push(config.ghlTag);
    }
    
    if (tagsToAdd.length > 0) {
      try {
        await ghlAPI.addTagsToContact(config.ghlLocationId, contactId, tagsToAdd);
      } catch (tagError) {
        console.error(`[Quote Sync] Failed to add tags to contact:`, tagError);
      }
    }

    // Create opportunity/deal in CRM if enabled
    let opportunityId = null;
    if (config.createOpportunities !== false) {
      try {
        const opportunityTitle = quote.quoteNumber || quote.QuoteNumber || `Quote ${quoteId}`;
        const opportunityAmount = quote.totalAmount || quote.QuoteTotal || quote.TotalAmount || quote.amount || quote.price || 0;
        
        const opportunityData: Record<string, any> = {
          title: opportunityTitle,
          status: 'new',
          source: 'MaidCentral',
          monetaryValue: typeof opportunityAmount === 'number' ? opportunityAmount : parseFloat(opportunityAmount) || 0,
        };

        console.log(`[Quote Sync] Creating opportunity:`, opportunityData);
        const opportunityResult = await ghlAPI.createOpportunity(config.ghlLocationId, contactId, opportunityData);
        opportunityId = opportunityResult.id || opportunityResult.opportunityId || opportunityResult._id;
        
        if (opportunityId) {
          console.log(`[Quote Sync] Opportunity created successfully: ${opportunityId}`);
        } else {
          console.warn(`[Quote Sync] Opportunity creation response:`, opportunityResult);
        }
      } catch (oppError) {
        console.error(`[Quote Sync] Failed to create opportunity:`, oppError);
        // Don't fail the entire sync if opportunity creation fails
      }
    } else {
      console.log(`[Quote Sync] Opportunity creation is disabled`);
    }

    // Mark quote as synced
    await markQuoteAsSynced(locationId, quoteId, leadData?.LeadId || leadData?.leadId, contactId, opportunityId || undefined);

    return {
      success: true,
      contactId,
      opportunityId: opportunityId || undefined,
    };
  } catch (error) {
    console.error(`[Quote Sync] Error syncing quote ${quoteId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

