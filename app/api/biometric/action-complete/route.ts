import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Protection
    const apiKey = request.headers.get('x-api-key');
    const configuredKey = process.env.BIOMETRIC_API_KEY;
    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse request body
    const body = await request.json();
    const { memberId, biometricId, action } = body;

    if (!memberId || !action) {
      return NextResponse.json({ error: 'Missing memberId or action in request payload' }, { status: 400 });
    }

    const supabase = await createClient();

    // 3. Mark the action as completed in the queue
    let query = supabase
      .from('biometric_actions')
      .update({
        status: 'completed',
        notes: 'Processed by Sync Agent',
        updated_at: new Date().toISOString()
      })
      .eq('member_id', memberId)
      .eq('action', action)
      .in('status', ['pending', 'sent']);

    if (biometricId) {
      query = query.eq('biometric_id', biometricId);
    }

    const { error } = await query;

    if (error) {
      console.error('Error updating biometric action status:', error);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Unhandled POST action-complete error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
