import { NextResponse } from 'next/server';
import { executeAutoRetryQueueAction } from '@/lib/actions/sms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await executeAutoRetryQueueAction();
    return NextResponse.json({
      success: result.success,
      retriedCount: result.retriedCount,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[SMS Auto-Retry API Route Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Internal server error during SMS auto-retry',
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  return GET();
}
