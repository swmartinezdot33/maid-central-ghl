// Re-export from db.ts for backward compatibility
// All storage now uses PostgreSQL instead of Vercel KV
export {
  type MaidCentralCredentials,
  type GHLPrivateToken,
  type FieldMapping,
  type IntegrationConfig,
  storeMaidCentralCredentials,
  getMaidCentralCredentials,
  storeGHLPrivateToken,
  getGHLPrivateToken,
  storeIntegrationConfig,
  getIntegrationConfig,
  storeFieldMappings,
  getFieldMappings,
} from './db';
