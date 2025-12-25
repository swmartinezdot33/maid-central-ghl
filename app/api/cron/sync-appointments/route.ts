import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { pollAllAppointments } from '@/lib/appointment-poller';
import { getIntegrationConfig } from '@/lib/db';

/**
 * POST /api/cron/sync-appointments
 * Cron endpoint for polling appointments from both systems
 * Can be triggered by Vercel Cron or external scheduler
 */
export async function POST(request: NextRequest) {
  try {
    // Optional: Verify cron secret if configured
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const config = await getIntegrationConfig();
    
    if (!config?.syncAppointments) {
      return NextResponse.json({
        success: true,
        message: 'Appointment syncing is disabled',
        skipped: true,
      });
    }

    const result = await pollAllAppointments();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      result,
    });
  } catch (error) {
    console.error('Error in appointment sync cron job:', error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run sync cron',
      },
      { status: 500 }
    );
  }
}

// Also support GET for manual testing
export async function GET(request: NextRequest) {
  return POST(request);
}








