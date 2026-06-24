import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMembershipExpiry } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    // 1. API Key Protection (Optional but highly recommended for production security)
    const apiKey = request.headers.get('x-api-key');
    const configuredKey = process.env.BIOMETRIC_API_KEY;
    if (configuredKey && apiKey !== configuredKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse payload
    const body = await request.json();
    const { device_user_id, timestamp, event_type } = body;

    if (!device_user_id) {
      return NextResponse.json(
        { error: 'Missing device_user_id in request payload' },
        { status: 400 }
      );
    }

    const punchType = event_type === 'checkout' ? 'checkout' : 'checkin';
    const punchTime = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const supabase = await createClient();

    // 3. Match member by device_user_id
    const { data: member, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, package_start_date, package_end_date, status')
      .eq('device_user_id', String(device_user_id))
      .maybeSingle();

    if (fetchError) {
      console.error('Database error fetching member:', fetchError);
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
    }

    if (!member) {
      return NextResponse.json(
        { error: `No member mapped to device_user_id '${device_user_id}'` },
        { status: 404 }
      );
    }

    // 4. Determine membership status based on expiration
    const expiry = new Date(member.package_end_date);
    const now = new Date();
    const isExpired = expiry < now;
    
    // Status resolution logic
    let resolvedStatus = member.status;
    if (member.status === 'Active' && isExpired) {
      resolvedStatus = 'Expired';
    } else if (member.status === 'Expired' && !isExpired) {
      resolvedStatus = 'Active';
    }

    // 5. Create attendance log
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert({
        member_id: member.id,
        member_name: member.full_name,
        device_user_id: String(device_user_id),
        punch_time: punchTime,
        punch_type: punchType,
      });

    if (logError) {
      console.error('Database error creating attendance log:', logError);
      return NextResponse.json({ error: 'Failed to create attendance log' }, { status: 500 });
    }

    // 6. Update member record checkin fields & status
    const updatePayload: Record<string, any> = {
      membership_status: resolvedStatus,
      status: resolvedStatus,
    };

    if (punchType === 'checkin') {
      updatePayload.last_checkin = punchTime;
    }

    const { error: updateError } = await supabase
      .from('members')
      .update(updatePayload)
      .eq('id', member.id);

    if (updateError) {
      console.error('Database error updating member checkin stats:', updateError);
      // Don't fail the request since attendance log is already recorded
    }

    return NextResponse.json({
      success: true,
      member: {
        id: member.id,
        full_name: member.full_name,
        status: resolvedStatus,
        expiry: expiry.toISOString().split('T')[0],
      },
      log: {
        punch_time: punchTime,
        punch_type: punchType,
      }
    });

  } catch (error) {
    console.error('Unexpected checkin processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
