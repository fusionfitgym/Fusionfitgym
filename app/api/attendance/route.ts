import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMembershipExpiry } from '@/lib/utils';
import { revalidatePath } from 'next/cache';

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
    const { device_user_id, member_id, timestamp, event_type } = body;

    const rawBiometricUserId = member_id ?? device_user_id;

    if (!rawBiometricUserId) {
      return NextResponse.json(
        { error: 'Missing member_id or device_user_id in request payload' },
        { status: 400 }
      );
    }

    const biometricUserIdRaw = String(rawBiometricUserId).trim();
    
    // Ignore OPLOG records (Requirement 2)
    if (/oplog/i.test(biometricUserIdRaw)) {
      return NextResponse.json({ error: 'OPLOG events ignored' }, { status: 400 });
    }

    // Match using numeric IDs only (Requirement 1 & 5)
    // Extract PIN if matching "PIN=..."
    let cleanId = '';
    const pinMatch = biometricUserIdRaw.match(/PIN\s*[=-]?\s*(\d+)/i);
    if (pinMatch) {
      cleanId = pinMatch[1];
    } else {
      cleanId = biometricUserIdRaw.replace(/[^0-9]/g, '');
    }

    if (!cleanId || !/^\d+$/.test(cleanId)) {
      return NextResponse.json({ error: 'Numeric biometric ID required' }, { status: 400 });
    }

    const biometricUserId = cleanId;
    const punchType = event_type === 'checkout' ? 'checkout' : 'checkin';
    const punchTime = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();

    const supabase = await createClient();

    // 3. Match member by biometric_user_id
    const { data: member, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, package_start_date, package_end_date, status')
      .eq('biometric_user_id', biometricUserId)
      .maybeSingle();

    if (fetchError) {
      console.error('Database error fetching member:', fetchError);
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
    }

    if (!member) {
      // Log lookup diagnostics failure
      await supabase.from('biometric_sync_logs').insert({
        biometric_user_id: biometricUserId,
        status: 'Failed',
        message: `No member mapped to Biometric User ID '${biometricUserId}'`
      });

      return NextResponse.json(
        { error: `No member mapped to Biometric User ID '${biometricUserId}'` },
        { status: 404 }
      );
    }

    // Log lookup diagnostics success
    await supabase.from('biometric_sync_logs').insert({
      biometric_user_id: biometricUserId,
      status: 'Success',
      message: `Biometric User ID ${biometricUserId} matched to ${member.full_name}`
    });

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
        biometric_user_id: biometricUserId,
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

    revalidatePath('/');
    revalidatePath('/attendance');

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
