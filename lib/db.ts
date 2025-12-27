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

export interface GHLOAuthToken {
  locationId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  tokenType?: string;
  scope?: string;
  userId?: string;
  companyId?: string;
  installedAt: Date;
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
  // Appointment sync configuration
  syncAppointments?: boolean; // Toggle for syncing appointments
  ghlCalendarId?: string; // GHL calendar ID to sync with
  appointmentSyncInterval?: number; // Polling interval in minutes (default: 15)
  appointmentConflictResolution?: 'maid_central_wins' | 'ghl_wins' | 'timestamp'; // Conflict resolution strategy
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
    
    // Add unique constraint on ghl_location_id if it doesn't exist (for multi-tenant support)
    // This allows NULL for backward compatibility but ensures uniqueness when location_id is set
    try {
      // PostgreSQL doesn't support IF NOT EXISTS for constraints, so we check first
      const constraintExists = await sql`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'integration_config' 
        AND constraint_name = 'integration_config_location_unique'
      `;
      
      if (constraintExists.length === 0) {
        await sql`
          CREATE UNIQUE INDEX integration_config_location_unique 
          ON integration_config (ghl_location_id) 
          WHERE ghl_location_id IS NOT NULL
        `;
      }
    } catch (error) {
      // Constraint might already exist or index creation failed, ignore error
      console.log('Unique constraint/index might already exist:', error);
    }
    
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

    await sql`
      CREATE TABLE IF NOT EXISTS appointment_syncs (
        id SERIAL PRIMARY KEY,
        maid_central_appointment_id VARCHAR(255),
        ghl_appointment_id VARCHAR(255),
        ghl_calendar_id VARCHAR(255),
        maid_central_last_modified TIMESTAMP,
        ghl_last_modified TIMESTAMP,
        sync_direction VARCHAR(50),
        conflict_resolution VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(maid_central_appointment_id, ghl_appointment_id)
      )
    `;

    // Add appointment sync columns to integration_config if they don't exist
    try {
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS sync_appointments BOOLEAN DEFAULT false`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS ghl_calendar_id TEXT`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS appointment_sync_interval INTEGER DEFAULT 15`;
      await sql`ALTER TABLE integration_config ADD COLUMN IF NOT EXISTS appointment_conflict_resolution VARCHAR(50) DEFAULT 'timestamp'`;
    } catch (error) {
      // Columns might already exist, ignore error
      console.log('Appointment sync columns already exist or error adding them:', error);
    }

    // OAuth tokens table for marketplace app installations
    await sql`
      CREATE TABLE IF NOT EXISTS ghl_oauth_tokens (
        id SERIAL PRIMARY KEY,
        location_id TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at BIGINT,
        token_type TEXT DEFAULT 'Bearer',
        scope TEXT,
        user_id TEXT,
        company_id TEXT,
        installed_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Note: We no longer create a default config row since location_id is now required
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

// GHL OAuth Tokens (for marketplace app) - OAuth only, no private tokens
export async function storeGHLOAuthToken(token: GHLOAuthToken): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  const existing = await sql`
    SELECT id FROM ghl_oauth_tokens WHERE location_id = ${token.locationId} LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE ghl_oauth_tokens
      SET 
        access_token = ${token.accessToken},
        refresh_token = ${token.refreshToken || null},
        expires_at = ${token.expiresAt || null},
        token_type = ${token.tokenType || 'Bearer'},
        scope = ${token.scope || null},
        user_id = ${token.userId || null},
        company_id = ${token.companyId || null},
        updated_at = NOW()
      WHERE location_id = ${token.locationId}
    `;
  } else {
    await sql`
      INSERT INTO ghl_oauth_tokens (
        location_id, access_token, refresh_token, expires_at, 
        token_type, scope, user_id, company_id, installed_at
      )
      VALUES (
        ${token.locationId},
        ${token.accessToken},
        ${token.refreshToken || null},
        ${token.expiresAt || null},
        ${token.tokenType || 'Bearer'},
        ${token.scope || null},
        ${token.userId || null},
        ${token.companyId || null},
        ${token.installedAt}
      )
    `;
  }
}

export async function getGHLOAuthToken(locationId: string): Promise<GHLOAuthToken | null> {
  await initDatabase();
  const sql = getSql();
  
  const result = await sql`
    SELECT 
      location_id, access_token, refresh_token, expires_at,
      token_type, scope, user_id, company_id, installed_at
    FROM ghl_oauth_tokens
    WHERE location_id = ${locationId}
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    locationId: row.location_id as string,
    accessToken: row.access_token as string,
    refreshToken: row.refresh_token as string | undefined,
    expiresAt: row.expires_at as number | undefined,
    tokenType: row.token_type as string | undefined,
    scope: row.scope as string | undefined,
    userId: row.user_id as string | undefined,
    companyId: row.company_id as string | undefined,
    installedAt: new Date(row.installed_at as string),
  };
}

export async function deleteGHLOAuthToken(locationId: string): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  await sql`
    DELETE FROM ghl_oauth_tokens WHERE location_id = ${locationId}
  `;
}

// Integration Config
export async function storeIntegrationConfig(config: IntegrationConfig, locationId?: string): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  // Use provided locationId or from config
  const targetLocationId = locationId || config.ghlLocationId;
  
  if (!targetLocationId) {
    throw new Error('Location ID is required to store integration config');
  }
  
  // Check if config exists for this location
  const configExists = await sql`
    SELECT id FROM integration_config WHERE ghl_location_id = ${targetLocationId} LIMIT 1
  `;
  
  // Handle tags: convert array to JSON string, or use single tag for backward compatibility
  const ghlTagsJson = config.ghlTags ? JSON.stringify(config.ghlTags) : null;
  const ghlTagSingle = config.ghlTag || (config.ghlTags && config.ghlTags.length > 0 ? config.ghlTags[0] : null);

  if (configExists.length === 0) {
    await sql`
      INSERT INTO integration_config (ghl_location_id, enabled, ghl_tag, ghl_tags, sync_quotes, sync_customers, create_opportunities, auto_create_fields, custom_field_prefix, sync_appointments, ghl_calendar_id, appointment_sync_interval, appointment_conflict_resolution)
      VALUES (
        ${targetLocationId}, 
        ${config.enabled}, 
        ${ghlTagSingle || null},
        ${ghlTagsJson || null},
        ${config.syncQuotes !== undefined ? config.syncQuotes : true},
        ${config.syncCustomers !== undefined ? config.syncCustomers : false},
        ${config.createOpportunities !== undefined ? config.createOpportunities : true},
        ${config.autoCreateFields !== undefined ? config.autoCreateFields : true},
        ${config.customFieldPrefix || 'maidcentral_quote_'},
        ${config.syncAppointments !== undefined ? config.syncAppointments : false},
        ${config.ghlCalendarId || null},
        ${config.appointmentSyncInterval !== undefined ? config.appointmentSyncInterval : 15},
        ${config.appointmentConflictResolution || 'timestamp'}
      )
    `;
  } else {
    await sql`
      UPDATE integration_config
      SET 
        enabled = ${config.enabled},
        ghl_tag = ${ghlTagSingle || null},
        ghl_tags = ${ghlTagsJson || null},
        sync_quotes = ${config.syncQuotes !== undefined ? config.syncQuotes : true},
        sync_customers = ${config.syncCustomers !== undefined ? config.syncCustomers : false},
        create_opportunities = ${config.createOpportunities !== undefined ? config.createOpportunities : true},
        auto_create_fields = ${config.autoCreateFields !== undefined ? config.autoCreateFields : true},
        custom_field_prefix = ${config.customFieldPrefix || 'maidcentral_quote_'},
        sync_appointments = ${config.syncAppointments !== undefined ? config.syncAppointments : false},
        ghl_calendar_id = ${config.ghlCalendarId || null},
        appointment_sync_interval = ${config.appointmentSyncInterval !== undefined ? config.appointmentSyncInterval : 15},
        appointment_conflict_resolution = ${config.appointmentConflictResolution || 'timestamp'},
        updated_at = NOW()
      WHERE ghl_location_id = ${targetLocationId}
    `;
  }

  // Store field mappings
  await storeFieldMappings(config.fieldMappings);
}

export async function getIntegrationConfig(locationId?: string): Promise<IntegrationConfig | null> {
  await initDatabase();
  const sql = getSql();
  
  let result;
  if (locationId) {
    result = await sql`
      SELECT ghl_location_id, enabled, ghl_tag, ghl_tags, sync_quotes, sync_customers, create_opportunities, auto_create_fields, custom_field_prefix, sync_appointments, ghl_calendar_id, appointment_sync_interval, appointment_conflict_resolution
      FROM integration_config
      WHERE ghl_location_id = ${locationId}
      LIMIT 1
    `;
  } else {
    // Fallback: get first config (for backward compatibility)
    result = await sql`
      SELECT ghl_location_id, enabled, ghl_tag, ghl_tags, sync_quotes, sync_customers, create_opportunities, auto_create_fields, custom_field_prefix, sync_appointments, ghl_calendar_id, appointment_sync_interval, appointment_conflict_resolution
      FROM integration_config
      LIMIT 1
    `;
  }

    if (result.length === 0) {
      return { 
        fieldMappings: [], 
        enabled: false,
        syncQuotes: true,
        syncCustomers: false,
        createOpportunities: true,
        autoCreateFields: true,
        customFieldPrefix: 'maidcentral_quote_',
        syncAppointments: false,
        appointmentSyncInterval: 15,
        appointmentConflictResolution: 'timestamp',
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
    const syncAppointments = row.sync_appointments !== undefined && row.sync_appointments !== null ? row.sync_appointments as boolean : false;
    const ghlCalendarId = row.ghl_calendar_id as string | undefined;
    const appointmentSyncInterval = row.appointment_sync_interval !== undefined && row.appointment_sync_interval !== null ? row.appointment_sync_interval as number : 15;
    const appointmentConflictResolution = (row.appointment_conflict_resolution as 'maid_central_wins' | 'ghl_wins' | 'timestamp' | undefined) || 'timestamp';

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
      syncAppointments,
      ghlCalendarId,
      appointmentSyncInterval,
      appointmentConflictResolution,
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

// Appointment Sync Tracking
export interface AppointmentSync {
  id?: number;
  maidCentralAppointmentId?: string;
  ghlAppointmentId?: string;
  ghlCalendarId?: string;
  maidCentralLastModified?: Date;
  ghlLastModified?: Date;
  syncDirection?: 'mc_to_ghl' | 'ghl_to_mc' | 'bidirectional';
  conflictResolution?: 'maid_central_wins' | 'ghl_wins' | 'timestamp';
  createdAt?: Date;
  updatedAt?: Date;
}

export async function storeAppointmentSync(sync: AppointmentSync): Promise<void> {
  await initDatabase();
  const sql = getSql();

  // Check if sync record exists
  const existing = await sql`
    SELECT id FROM appointment_syncs
    WHERE (maid_central_appointment_id = ${sync.maidCentralAppointmentId || null} AND maid_central_appointment_id IS NOT NULL)
       OR (ghl_appointment_id = ${sync.ghlAppointmentId || null} AND ghl_appointment_id IS NOT NULL)
    LIMIT 1
  `;

  if (existing.length > 0) {
    await sql`
      UPDATE appointment_syncs
      SET
        maid_central_appointment_id = ${sync.maidCentralAppointmentId || null},
        ghl_appointment_id = ${sync.ghlAppointmentId || null},
        ghl_calendar_id = ${sync.ghlCalendarId || null},
        maid_central_last_modified = ${sync.maidCentralLastModified || null},
        ghl_last_modified = ${sync.ghlLastModified || null},
        sync_direction = ${sync.syncDirection || null},
        conflict_resolution = ${sync.conflictResolution || null},
        updated_at = NOW()
      WHERE id = ${existing[0].id}
    `;
  } else {
    await sql`
      INSERT INTO appointment_syncs (
        maid_central_appointment_id, ghl_appointment_id, ghl_calendar_id,
        maid_central_last_modified, ghl_last_modified, sync_direction, conflict_resolution
      )
      VALUES (
        ${sync.maidCentralAppointmentId || null},
        ${sync.ghlAppointmentId || null},
        ${sync.ghlCalendarId || null},
        ${sync.maidCentralLastModified || null},
        ${sync.ghlLastModified || null},
        ${sync.syncDirection || null},
        ${sync.conflictResolution || null}
      )
    `;
  }
}

export async function getAppointmentSync(mcId?: string, ghlId?: string): Promise<AppointmentSync | null> {
  await initDatabase();
  const sql = getSql();

  let result;
  if (mcId) {
    result = await sql`
      SELECT * FROM appointment_syncs
      WHERE maid_central_appointment_id = ${mcId}
      LIMIT 1
    `;
  } else if (ghlId) {
    result = await sql`
      SELECT * FROM appointment_syncs
      WHERE ghl_appointment_id = ${ghlId}
      LIMIT 1
    `;
  } else {
    return null;
  }

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    id: row.id as number,
    maidCentralAppointmentId: row.maid_central_appointment_id as string | undefined,
    ghlAppointmentId: row.ghl_appointment_id as string | undefined,
    ghlCalendarId: row.ghl_calendar_id as string | undefined,
    maidCentralLastModified: row.maid_central_last_modified ? new Date(row.maid_central_last_modified as Date) : undefined,
    ghlLastModified: row.ghl_last_modified ? new Date(row.ghl_last_modified as Date) : undefined,
    syncDirection: row.sync_direction as 'mc_to_ghl' | 'ghl_to_mc' | 'bidirectional' | undefined,
    conflictResolution: row.conflict_resolution as 'maid_central_wins' | 'ghl_wins' | 'timestamp' | undefined,
    createdAt: row.created_at ? new Date(row.created_at as Date) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as Date) : undefined,
  };
}

export async function updateSyncTimestamps(
  mcId: string | undefined,
  ghlId: string | undefined,
  mcTimestamp: Date | undefined,
  ghlTimestamp: Date | undefined
): Promise<void> {
  await initDatabase();
  const sql = getSql();

  const sync = await getAppointmentSync(mcId, ghlId);
  if (sync) {
    await storeAppointmentSync({
      ...sync,
      maidCentralLastModified: mcTimestamp,
      ghlLastModified: ghlTimestamp,
    });
  }
}

export async function getAllAppointmentSyncs(): Promise<AppointmentSync[]> {
  await initDatabase();
  const sql = getSql();

  const result = await sql`
    SELECT * FROM appointment_syncs
    ORDER BY updated_at DESC
  `;

  return result.map((row) => ({
    id: row.id as number,
    maidCentralAppointmentId: row.maid_central_appointment_id as string | undefined,
    ghlAppointmentId: row.ghl_appointment_id as string | undefined,
    ghlCalendarId: row.ghl_calendar_id as string | undefined,
    maidCentralLastModified: row.maid_central_last_modified ? new Date(row.maid_central_last_modified as Date) : undefined,
    ghlLastModified: row.ghl_last_modified ? new Date(row.ghl_last_modified as Date) : undefined,
    syncDirection: row.sync_direction as 'mc_to_ghl' | 'ghl_to_mc' | 'bidirectional' | undefined,
    conflictResolution: row.conflict_resolution as 'maid_central_wins' | 'ghl_wins' | 'timestamp' | undefined,
    createdAt: row.created_at ? new Date(row.created_at as Date) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as Date) : undefined,
  }));
}
