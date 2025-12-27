import { neon } from '@neondatabase/serverless';

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return neon(process.env.DATABASE_URL);
}

export interface WebhookConfig {
  id?: number;
  eventType: string;
  webhookUrl: string;
  enabled: boolean;
  secretToken?: string;
  headers?: Record<string, string>;
}

export interface WebhookEvent {
  id?: number;
  eventType: string;
  entityId: string;
  payload: any;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  deliveryAttempts: number;
  lastAttemptAt?: Date;
  errorMessage?: string;
}

export async function storeWebhookConfig(config: WebhookConfig): Promise<WebhookConfig> {
  const sql = getSql();
  
  if (config.id) {
    await sql`
      UPDATE webhook_configs
      SET 
        event_type = ${config.eventType},
        webhook_url = ${config.webhookUrl},
        enabled = ${config.enabled},
        secret_token = ${config.secretToken || null},
        headers = ${config.headers ? JSON.stringify(config.headers) : null},
        updated_at = NOW()
      WHERE id = ${config.id}
    `;
    return config;
  } else {
    const result = await sql`
      INSERT INTO webhook_configs (event_type, webhook_url, enabled, secret_token, headers)
      VALUES (${config.eventType}, ${config.webhookUrl}, ${config.enabled}, ${config.secretToken || null}, ${config.headers ? JSON.stringify(config.headers) : null})
      RETURNING id
    `;
    return { ...config, id: result[0].id };
  }
}

export async function getWebhookConfigs(eventType?: string): Promise<WebhookConfig[]> {
  const sql = getSql();
  
  let result;
  if (eventType) {
    result = await sql`
      SELECT id, event_type, webhook_url, enabled, secret_token, headers
      FROM webhook_configs
      WHERE event_type = ${eventType} AND enabled = true
    `;
  } else {
    result = await sql`
      SELECT id, event_type, webhook_url, enabled, secret_token, headers
      FROM webhook_configs
      WHERE enabled = true
    `;
  }

  return result.map((row: any) => ({
    id: row.id,
    eventType: row.event_type,
    webhookUrl: row.webhook_url,
    enabled: row.enabled,
    secretToken: row.secret_token || undefined,
    headers: row.headers ? JSON.parse(row.headers) : undefined,
  }));
}

export async function deleteWebhookConfig(id: number): Promise<void> {
  const sql = getSql();
  await sql`DELETE FROM webhook_configs WHERE id = ${id}`;
}

export async function storeWebhookEvent(event: WebhookEvent): Promise<WebhookEvent> {
  const sql = getSql();
  
  const result = await sql`
    INSERT INTO webhook_events (event_type, entity_id, payload, delivery_status, delivery_attempts, last_attempt_at, error_message)
    VALUES (${event.eventType}, ${event.entityId}, ${JSON.stringify(event.payload)}, ${event.deliveryStatus}, ${event.deliveryAttempts}, ${event.lastAttemptAt || null}, ${event.errorMessage || null})
    RETURNING id
  `;
  
  return { ...event, id: result[0].id };
}

export async function getWebhookEvents(params?: { limit?: number; status?: string }): Promise<WebhookEvent[]> {
  const sql = getSql();
  
  let query = sql`
    SELECT id, event_type, entity_id, payload, delivery_status, delivery_attempts, last_attempt_at, error_message, created_at
    FROM webhook_events
  `;
  
  if (params?.status) {
    query = sql`
      SELECT id, event_type, entity_id, payload, delivery_status, delivery_attempts, last_attempt_at, error_message, created_at
      FROM webhook_events
      WHERE delivery_status = ${params.status}
      ORDER BY created_at DESC
      LIMIT ${params.limit || 100}
    `;
  } else {
    query = sql`
      SELECT id, event_type, entity_id, payload, delivery_status, delivery_attempts, last_attempt_at, error_message, created_at
      FROM webhook_events
      ORDER BY created_at DESC
      LIMIT ${params?.limit || 100}
    `;
  }
  
  const result = await query;
  
  return result.map((row: any) => ({
    id: row.id,
    eventType: row.event_type,
    entityId: row.entity_id,
    payload: row.payload,
    deliveryStatus: row.delivery_status,
    deliveryAttempts: row.delivery_attempts,
    lastAttemptAt: row.last_attempt_at ? new Date(row.last_attempt_at) : undefined,
    errorMessage: row.error_message || undefined,
  }));
}

export async function updateWebhookEventStatus(
  id: number,
  status: 'pending' | 'delivered' | 'failed',
  errorMessage?: string
): Promise<void> {
  const sql = getSql();
  
  await sql`
    UPDATE webhook_events
    SET 
      delivery_status = ${status},
      delivery_attempts = delivery_attempts + 1,
      last_attempt_at = NOW(),
      error_message = ${errorMessage || null}
    WHERE id = ${id}
  `;
}









