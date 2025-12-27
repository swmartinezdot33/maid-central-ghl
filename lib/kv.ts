// Re-export from db.ts for backward compatibility
// All storage now uses PostgreSQL instead of Vercel KV
// OAuth only - private tokens removed
export {
  type MaidCentralCredentials,
  type FieldMapping,
  type IntegrationConfig,
  storeMaidCentralCredentials,
  getMaidCentralCredentials,
  storeIntegrationConfig,
  getIntegrationConfig,
  storeFieldMappings,
  getFieldMappings,
} from './db';
