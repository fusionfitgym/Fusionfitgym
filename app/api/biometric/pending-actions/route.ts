import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
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

    const adminSupabase = createAdminClient();
    await adminSupabase.from('settings').upsert({
      key: 'biometric_last_poll_time',
      value: new Date().toISOString()
    }, { onConflict: 'key' });

    // 3. Retrieve the oldest pending biometric action from queue
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('biometric_actions')
      .select('id, member_id, biometric_id, action')
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

    // 4. Update the retrieved action status to 'sent'
    const { error: updateErr } = await adminSupabase
      .from('biometric_actions')
      .update({
        status: 'sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', data.id);

    if (updateErr) {
      console.error('Error marking biometric action as sent:', updateErr);
      // We still return the data as it was retrieved
    }

    // 5. Return matching camelCase format: { memberId, biometricId, action }
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
