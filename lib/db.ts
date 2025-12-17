import { neon } from '@neondatabase/serverless';

// Lazy-load the SQL client to avoid build-time errors
function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export interface MaidCentralCredentials {
  username: string;
  password: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
}

export interface GHLPrivateToken {
  privateToken: string;
  locationId: string;
}

export interface FieldMapping {
  maidCentralField: string;
  ghlField: string;
  maidCentralLabel?: string;
  ghlLabel?: string;
}

export interface IntegrationConfig {
  ghlLocationId?: string;
  fieldMappings: FieldMapping[]; // Keep for backward compatibility, but will use auto-mapping
  enabled: boolean;
  ghlTag?: string; // DEPRECATED: Use ghlTags instead. Kept for backward compatibility
  ghlTags?: string[]; // Tags to add to contacts when syncing quotes (multiple tags supported)
  syncQuotes: boolean; // Toggle for syncing quotes
  syncCustomers: boolean; // Toggle for syncing customers
  createOpportunities: boolean; // Toggle for creating opportunities when quotes are synced
  autoCreateFields: boolean; // Automatically create custom fields in GHL
  customFieldPrefix: string; // Prefix for custom fields (default: "maidcentral_quote_")
}

// Initialize database tables
export async function initDatabase(): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS maid_central_credentials (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at BIGINT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS ghl_private_token (
        id SERIAL PRIMARY KEY,
        private_token TEXT NOT NULL,
        location_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS integration_config (
        id SERIAL PRIMARY KEY,
        ghl_location_id TEXT,
        enabled BOOLEAN DEFAULT false,
        ghl_tag TEXT,
        sync_quotes BOOLEAN DEFAULT true,
        sync_customers BOOLEAN DEFAULT false,
        create_opportunities BOOLEAN DEFAULT true,
        auto_create_fields BOOLEAN DEFAULT true,
        custom_field_prefix TEXT DEFAULT 'maidcentral_quote_',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;
    
    // Add new columns if they don't exist (for existing databases)
    try {
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS ghl_tag TEXT`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS sync_quotes BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS sync_customers BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS create_opportunities BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS auto_create_fields BOOLEAN DEFAULT true`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS custom_field_prefix TEXT DEFAULT 'maidcentral_quote_'`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS ghl_tags TEXT`; // JSON array of tags
    } catch (error) {
      // Columns might already exist, ignore error
      console.log('Columns already exist or error adding them:', error);
    }

    await sql`
      CREATE TABLE IF NOT EXISTS field_mappings (
        id SERIAL PRIMARY KEY,
        maid_central_field TEXT NOT NULL,
        ghl_field TEXT NOT NULL,
        maid_central_label TEXT,
        ghl_label TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maid_central_customers (
        id SERIAL PRIMARY KEY,
        maid_central_id TEXT UNIQUE NOT NULL,
        ghl_contact_id TEXT,
        sync_status TEXT,
        last_synced_at TIMESTAMP,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS maid_central_services (
        id SERIAL PRIMARY KEY,
        maid_central_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price DECIMAL,
        duration INTEGER,
        ghl_product_id TEXT,
        data JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_configs (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        enabled BOOLEAN DEFAULT true,
        secret_token TEXT,
        headers JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id SERIAL PRIMARY KEY,
        event_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload JSONB,
        delivery_status TEXT,
        delivery_attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Ensure we have a single integration config row
    const configExists = await sql`
      SELECT id FROM integration_config LIMIT 1
    `;
    
    if (configExists.length === 0) {
      await sql`
        INSERT INTO integration_config (enabled) VALUES (false)
      `;
    }
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Maid Central Credentials
export async function storeMaidCentralCredentials(credentials: MaidCentralCredentials): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  const existing = await sql`
    SELECT id FROM maid_central_credentials LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE maid_central_credentials
      SET 
        username = ${credentials.username},
        password = ${credentials.password},
        access_token = ${credentials.accessToken || null},
        refresh_token = ${credentials.refreshToken || null},
        token_expires_at = ${credentials.tokenExpiresAt || null},
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO maid_central_credentials (username, password, access_token, refresh_token, token_expires_at)
      VALUES (${credentials.username}, ${credentials.password}, ${credentials.accessToken || null}, ${credentials.refreshToken || null}, ${credentials.tokenExpiresAt || null})
    `;
  }
}

export async function getMaidCentralCredentials(): Promise<MaidCentralCredentials | null> {
  await initDatabase();
  const sql = getSql();
  
  const result = await sql`
    SELECT username, password, access_token, refresh_token, token_expires_at
    FROM maid_central_credentials
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    username: row.username as string,
    password: row.password as string,
    accessToken: row.access_token as string | undefined,
    refreshToken: row.refresh_token as string | undefined,
    tokenExpiresAt: row.token_expires_at as number | undefined,
  };
}

// GHL Private Token
export async function storeGHLPrivateToken(tokenData: GHLPrivateToken): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  console.log('[DB] storeGHLPrivateToken called:', { 
    hasToken: !!tokenData.privateToken,
    tokenLength: tokenData.privateToken?.length || 0,
    locationId: tokenData.locationId 
  });
  
  const existing = await sql`
    SELECT id FROM ghl_private_token LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE ghl_private_token
      SET 
        private_token = ${tokenData.privateToken},
        location_id = ${tokenData.locationId},
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
    console.log('[DB] Updated existing GHL token record');
  } else {
    await sql`
      INSERT INTO ghl_private_token (private_token, location_id)
      VALUES (${tokenData.privateToken}, ${tokenData.locationId})
    `;
    console.log('[DB] Inserted new GHL token record');
  }
  
  // Verify it was saved
  const verify = await sql`
    SELECT private_token, location_id FROM ghl_private_token LIMIT 1
  `;
  console.log('[DB] Verification after save:', {
    rowCount: verify.length,
    hasToken: verify.length > 0 ? !!verify[0].private_token : false,
    tokenLength: verify.length > 0 && verify[0].private_token ? String(verify[0].private_token).length : 0
  });
}

export async function getGHLPrivateToken(): Promise<GHLPrivateToken | null> {
  await initDatabase();
  const sql = getSql();
  
  try {
    const result = await sql`
      SELECT private_token, location_id
      FROM ghl_private_token
      LIMIT 1
    `;

    console.log('[DB] getGHLPrivateToken result:', { 
      rowCount: result.length,
      hasData: result.length > 0,
      firstRow: result.length > 0 ? {
        hasToken: !!result[0].private_token,
        tokenLength: result[0].private_token ? String(result[0].private_token).length : 0,
        locationId: result[0].location_id
      } : null
    });

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    const privateToken = row.private_token as string | null;
    const locationId = row.location_id as string | null;
    
    // Check if token is actually present
    if (!privateToken || privateToken.trim() === '') {
      console.warn('[DB] GHL private token exists in database but is empty or null');
      return null;
    }
    
    return {
      privateToken,
      locationId: locationId || '',
    };
  } catch (error) {
    console.error('[DB] Error fetching GHL private token:', error);
    throw error;
  }
}

// Integration Config
export async function storeIntegrationConfig(config: IntegrationConfig): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  // First, ensure config row exists
  const configExists = await sql`
    SELECT id FROM integration_config LIMIT 1
  `;
  
  // Handle tags: convert array to JSON string, or use single tag for backward compatibility
  const ghlTagsJson = config.ghlTags ? JSON.stringify(config.ghlTags) : null;
  const ghlTagSingle = config.ghlTag || (config.ghlTags && config.ghlTags.length > 0 ? config.ghlTags[0] : null);

  if (configExists.length === 0) {
    await sql`
      INSERT INTO integration_config (ghl_location_id, enabled, ghl_tag, ghl_tags, sync_quotes, sync_customers, create_opportunities, auto_create_fields, custom_field_prefix)
      VALUES (
        ${config.ghlLocationId || null}, 
        ${config.enabled}, 
        ${ghlTagSingle || null},
        ${ghlTagsJson || null},
        ${config.syncQuotes !== undefined ? config.syncQuotes : true},
        ${config.syncCustomers !== undefined ? config.syncCustomers : false},
        ${config.createOpportunities !== undefined ? config.createOpportunities : true},
        ${config.autoCreateFields !== undefined ? config.autoCreateFields : true},
        ${config.customFieldPrefix || 'maidcentral_quote_'}
      )
    `;
  } else {
    await sql`
      UPDATE integration_config
      SET 
        ghl_location_id = ${config.ghlLocationId || null},
        enabled = ${config.enabled},
        ghl_tag = ${ghlTagSingle || null},
        ghl_tags = ${ghlTagsJson || null},
        sync_quotes = ${config.syncQuotes !== undefined ? config.syncQuotes : true},
        sync_customers = ${config.syncCustomers !== undefined ? config.syncCustomers : false},
        create_opportunities = ${config.createOpportunities !== undefined ? config.createOpportunities : true},
        auto_create_fields = ${config.autoCreateFields !== undefined ? config.autoCreateFields : true},
        custom_field_prefix = ${config.customFieldPrefix || 'maidcentral_quote_'},
        updated_at = NOW()
      WHERE id = ${configExists[0].id}
    `;
  }

  // Store field mappings
  await storeFieldMappings(config.fieldMappings);
}

export async function getIntegrationConfig(): Promise<IntegrationConfig | null> {
  await initDatabase();
  const sql = getSql();
  
  const result = await sql`
    SELECT ghl_location_id, enabled, ghl_tag, ghl_tags, sync_quotes, sync_customers, create_opportunities, auto_create_fields, custom_field_prefix
    FROM integration_config
    LIMIT 1
  `;

    if (result.length === 0) {
      return { 
        fieldMappings: [], 
        enabled: false,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
      };
    }

    const row = result[0];
    const fieldMappings = await getFieldMappings();

    // Handle missing columns gracefully for backward compatibility
    const syncQuotes = row.sync_quotes !== undefined && row.sync_quotes !== null ? row.sync_quotes as boolean : true;
    const syncCustomers = row.sync_customers !== undefined && row.sync_customers !== null ? row.sync_customers as boolean : false;
    const createOpportunities = (row.create_opportunities !== undefined && row.create_opportunities !== null) ? row.create_opportunities as boolean : true;
    const autoCreateFields = row.auto_create_fields !== undefined && row.auto_create_fields !== null ? row.auto_create_fields as boolean : true;
    const customFieldPrefix = (row.custom_field_prefix as string | undefined) || 'maidcentral_quote_';

    // Handle tags: support both old single tag (ghl_tag) and new multiple tags (ghl_tags as JSON)
    let ghlTags: string[] | undefined;
    if (row.ghl_tags) {
      try {
        ghlTags = JSON.parse(row.ghl_tags as string);
      } catch {
        // If JSON parsing fails, treat as single tag
        ghlTags = [row.ghl_tags as string];
      }
    } else if (row.ghl_tag) {
      // Backward compatibility: convert single tag to array
      ghlTags = [row.ghl_tag as string];
    }

    return {
      ghlLocationId: row.ghl_location_id as string | undefined,
      enabled: row.enabled as boolean,
      ghlTag: row.ghl_tag as string | undefined, // Keep for backward compatibility
      ghlTags, // New multiple tags array
      syncQuotes,
      syncCustomers,
      createOpportunities,
      autoCreateFields,
      customFieldPrefix,
      fieldMappings,
    };
}

// Field Mappings
export async function storeFieldMappings(mappings: FieldMapping[]): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  // Clear existing mappings
  await sql`DELETE FROM field_mappings`;

  // Insert new mappings
  if (mappings.length > 0) {
    for (const mapping of mappings) {
      await sql`
        INSERT INTO field_mappings (maid_central_field, ghl_field, maid_central_label, ghl_label)
        VALUES (${mapping.maidCentralField}, ${mapping.ghlField}, ${mapping.maidCentralLabel || null}, ${mapping.ghlLabel || null})
      `;
    }
  }
}

export async function getFieldMappings(): Promise<FieldMapping[]> {
  await initDatabase();
  const sql = getSql();
  
  const result = await sql`
    SELECT maid_central_field, ghl_field, maid_central_label, ghl_label
    FROM field_mappings
    ORDER BY id
  `;

  return result.map((row) => ({
    maidCentralField: row.maid_central_field as string,
    ghlField: row.ghl_field as string,
    maidCentralLabel: row.maid_central_label as string | undefined,
    ghlLabel: row.ghl_label as string | undefined,
  }));
}
