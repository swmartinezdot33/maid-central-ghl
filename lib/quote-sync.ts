import { maidCentralAPI } from './maid-central';
import { ghlAPI } from './ghl';
import { IntegrationConfig } from './db';
import { markQuoteAsSynced, isQuoteSynced } from './db';

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
      leadData = await maidCentralAPI.getLead(quoteId);
      console.log(`[Quote Sync] Fetched lead data for ${quoteId}:`, !!leadData);
    } catch (leadError) {
      console.log(`[Quote Sync] Could not fetch lead ${quoteId}, will use minimal data:`, leadError);
      // Continue with minimal data if lead fetch fails
    }

    // Extract quote data from lead or use minimal data
    const quote: Record<string, any> = leadData ? {
      id: quoteId,
      ...leadData,
      // Extract quote-specific fields if they exist in lead data
      quoteNumber: leadData.QuoteNumber || leadData.quoteNumber,
      totalAmount: leadData.QuoteTotal || leadData.quoteTotal || leadData.TotalAmount,
      customerName: leadData.FirstName && leadData.LastName 
        ? `${leadData.FirstName} ${leadData.LastName}` 
        : leadData.CustomerName || leadData.customerName,
      customerEmail: leadData.Email || leadData.email,
      customerPhone: leadData.Phone || leadData.phone,
      ...leadData,
    } : { id: quoteId };

    // Automatically map fields
    const prefix = config.customFieldPrefix || 'maidcentral_quote_';
    let contactData = ghlAPI.autoMapFields(quote, prefix);

    // Ensure custom fields exist in CRM if auto-create is enabled
    if (config.autoCreateFields) {
      const customFieldNames = Object.keys(contactData).filter(key => key.startsWith(prefix));
      await ghlAPI.ensureCustomFields(config.ghlLocationId, customFieldNames, prefix);
    }

    // Create contact in CRM
    const contactResult = await ghlAPI.createContact(config.ghlLocationId, contactData);
    const contactId = contactResult.id || contactResult.contactId || contactResult._id;

    if (!contactId) {
      throw new Error('Failed to get contact ID from CRM response');
    }

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
        const opportunityData: Record<string, any> = {
          title: quote.quoteNumber || quote.QuoteNumber || quote.id || `Quote ${quoteId}`,
          status: 'new',
          source: 'MaidCentral',
          monetaryValue: quote.totalAmount || quote.TotalAmount || quote.amount || quote.price,
        };

        const opportunityResult = await ghlAPI.createOpportunity(config.ghlLocationId, contactId, opportunityData);
        opportunityId = opportunityResult.id || opportunityResult.opportunityId || opportunityResult._id;
      } catch (oppError) {
        console.error(`[Quote Sync] Failed to create opportunity:`, oppError);
      }
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

