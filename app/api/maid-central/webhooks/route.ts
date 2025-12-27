import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { storeWebhookConfig, getWebhookConfigs, deleteWebhookConfig, type WebhookConfig } from '@/lib/maid-central-webhooks';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventType = searchParams.get('eventType') || undefined;
    
    const configs = await getWebhookConfigs(eventType);
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('Error fetching webhook configs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch webhook configs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config: WebhookConfig = {
      eventType: body.eventType,
      webhookUrl: body.webhookUrl,
      enabled: body.enabled !== undefined ? body.enabled : true,
      secretToken: body.secretToken,
      headers: body.headers,
    };
    
    const saved = await storeWebhookConfig(config);
    return NextResponse.json(saved, { status: 201 });
  } catch (error) {
    console.error('Error creating webhook config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create webhook config' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json(
        { error: 'Webhook config ID is required' },
        { status: 400 }
      );
    }
    
    await deleteWebhookConfig(parseInt(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting webhook config:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete webhook config' },
      { status: 500 }
    );
  }
}









