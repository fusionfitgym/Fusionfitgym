import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { autoUpdateExpiredMembers } from '@/lib/actions/members';

export async function GET(request: NextRequest) {
  try {
    // 1. API Key Protection (aligned with biometric attendance sync endpoint)
    const apiKey = request.headers.get('x-api-key');
    const configuredKey = process.env.BIOMETRIC_API_KEY;
    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Run auto-expiry check first to catch recent expiries and generate pending actions
    try {
      await autoUpdateExpiredMembers();
    } catch (err) {
      console.error('Error in pending-actions autoUpdateExpiredMembers:', err);
    }

    // 3. Retrieve the oldest pending biometric action from queue
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('biometric_actions')
      .select('member_id, biometric_id, action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching pending biometric actions:', error);
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({});
    }

    // 4. Return matching camelCase format: { memberId, biometricId, action }
    return NextResponse.json({
      memberId: data.member_id,
      biometricId: data.biometric_id,
      action: data.action
    });
  } catch (err: any) {
    console.error('Unhandled GET pending-actions error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
