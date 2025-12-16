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
  fieldMappings: FieldMapping[];
  enabled: boolean;
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
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

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
  } else {
    await sql`
      INSERT INTO ghl_private_token (private_token, location_id)
      VALUES (${tokenData.privateToken}, ${tokenData.locationId})
    `;
  }
}

export async function getGHLPrivateToken(): Promise<GHLPrivateToken | null> {
  await initDatabase();
  const sql = getSql();
  
  const result = await sql`
    SELECT private_token, location_id
    FROM ghl_private_token
    LIMIT 1
  `;

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  return {
    privateToken: row.private_token as string,
    locationId: row.location_id as string,
  };
}

// Integration Config
export async function storeIntegrationConfig(config: IntegrationConfig): Promise<void> {
  await initDatabase();
  const sql = getSql();
  
  // First, ensure config row exists
  const configExists = await sql`
    SELECT id FROM integration_config LIMIT 1
  `;
  
  if (configExists.length === 0) {
    await sql`
      INSERT INTO integration_config (ghl_location_id, enabled)
      VALUES (${config.ghlLocationId || null}, ${config.enabled})
    `;
  } else {
    await sql`
      UPDATE integration_config
      SET 
        ghl_location_id = ${config.ghlLocationId || null},
        enabled = ${config.enabled},
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
    SELECT ghl_location_id, enabled
    FROM integration_config
    LIMIT 1
  `;

  if (result.length === 0) {
    return { fieldMappings: [], enabled: false };
  }

  const row = result[0];
  const fieldMappings = await getFieldMappings();

  return {
    ghlLocationId: row.ghl_location_id as string | undefined,
    enabled: row.enabled as boolean,
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
