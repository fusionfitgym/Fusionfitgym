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
    const { device_user_id, member_id, timestamp, event_type, machine_type } = body;

    const rawBiometricUserId = member_id ?? device_user_id;
    const machineType = machine_type || body.machine || body.device_type;

    if (!rawBiometricUserId) {
      return NextResponse.json(
        { error: 'Missing member_id or device_user_id in request payload' },
        { status: 400 }
      );
    }

    if (!machineType || (machineType !== 'Gents' && machineType !== 'Ladies')) {
      return NextResponse.json({ error: 'Missing or invalid machine_type (Gents or Ladies) in payload' }, { status: 400 });
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

    // 3. Match member by machine_type + biometric_user_id
    const { data: member, error: fetchError } = await supabase
      .from('members')
      .select('id, full_name, package_start_date, package_end_date, status, duration')
      .eq('biometric_user_id', biometricUserId)
      .eq('machine_type', machineType)
      .maybeSingle();

    if (fetchError) {
      console.error('Database error fetching member:', fetchError);
      return NextResponse.json({ error: 'Database lookup failed' }, { status: 500 });
    }

    if (!member) {
      // Step 2: Search the Staff table using the split Gents/Ladies Biometric ID
      const targetCol = machineType === 'Gents' ? 'biometric_gents_id' : 'biometric_ladies_id';
      const { data: staffMember, error: staffError } = await supabase
        .from('staff')
        .select('id, full_name, role, shift, status')
        .eq(targetCol, biometricUserId)
        .eq('status', 'Active')
        .maybeSingle();

      if (staffError) {
        console.error('Database error fetching staff:', staffError);
        return NextResponse.json({ error: 'Database lookup failed for staff' }, { status: 500 });
      }

      if (!staffMember) {
        // Log lookup diagnostics failure for both member and staff
        await supabase.from('biometric_sync_logs').insert({
          biometric_user_id: biometricUserId,
          machine_type: machineType,
          status: 'Failed',
          message: `No user mapped to Biometric User ID '${biometricUserId}' on ${machineType} Machine`
        });

        return NextResponse.json(
          { error: `No member or staff mapped to Biometric User ID '${biometricUserId}'` },
          { status: 404 }
        );
      }

      // Step 3: If found in Staff, save/update Staff Attendance
      // Compute IST local date
      const punchTimeObj = new Date(punchTime);
      const istPunch = new Date(punchTimeObj.getTime() + (5.5 * 60 * 60 * 1000));
      const yyyy = istPunch.getUTCFullYear();
      const mm = String(istPunch.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(istPunch.getUTCDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      // Check if attendance record exists for this staff and date
      const { data: existing, error: existingError } = await supabase
        .from('staff_attendance')
        .select('*')
        .eq('staff_id', staffMember.id)
        .eq('date', dateStr)
        .maybeSingle();

      if (existingError) {
        console.error('Database error checking existing staff attendance:', existingError);
        return NextResponse.json({ error: 'Database checking failed' }, { status: 500 });
      }

      if (!existing) {
        // First punch of the day: check-in
        let status = 'Present';
        let lateArrivalMinutes = 0;

        // Shift grace calculations (grace limit 15 min)
        let shiftStartHour = 9;
        let shiftStartMinute = 0;

        if (staffMember.shift === 'Morning') {
          shiftStartHour = 6;
        } else if (staffMember.shift === 'Evening') {
          shiftStartHour = 16;
        } else if (staffMember.shift === 'Night') {
          shiftStartHour = 22;
        }

        const punchHour = istPunch.getUTCHours();
        const punchMinute = istPunch.getUTCMinutes();
        const punchTotalMinutes = punchHour * 60 + punchMinute;
        const shiftTotalMinutes = shiftStartHour * 60 + shiftStartMinute;

        if (punchTotalMinutes > shiftTotalMinutes + 15) {
          status = 'Late';
          lateArrivalMinutes = punchTotalMinutes - shiftTotalMinutes;
        }

        const { error: insertErr } = await supabase
          .from('staff_attendance')
          .insert({
            staff_id: staffMember.id,
            date: dateStr,
            check_in: punchTime,
            status,
            late_arrival_minutes: lateArrivalMinutes,
            shift: staffMember.shift || 'Default',
          });

        if (insertErr) {
          console.error('Database error creating staff attendance:', insertErr);
          return NextResponse.json({ error: 'Failed to create staff attendance' }, { status: 500 });
        }
      } else {
        // Subsequent punch of the day: check-out
        const checkInTime = new Date(existing.check_in);
        const checkOutTime = new Date(punchTime);
        const diffMs = checkOutTime.getTime() - checkInTime.getTime();
        const workingHours = Math.max(0, parseFloat((diffMs / (1000 * 60 * 60)).toFixed(2)));
        const overtimeHours = workingHours > 8 ? parseFloat((workingHours - 8).toFixed(2)) : 0;

        let status = existing.status;
        if (workingHours < 4) {
          status = 'Half Day';
        } else if (existing.status === 'Half Day' && workingHours >= 4) {
          status = existing.late_arrival_minutes > 15 ? 'Late' : 'Present';
        }

        const { error: updateErr } = await supabase
          .from('staff_attendance')
          .update({
            check_out: punchTime,
            working_hours: workingHours,
            overtime_hours: overtimeHours,
            status,
          })
          .eq('id', existing.id);

        if (updateErr) {
          console.error('Database error updating staff attendance:', updateErr);
          return NextResponse.json({ error: 'Failed to update staff attendance' }, { status: 500 });
        }
      }

      // Log lookup diagnostics success for staff
      await supabase.from('biometric_sync_logs').insert({
        biometric_user_id: biometricUserId,
        machine_type: machineType,
        status: 'Success',
        message: `Biometric User ID ${biometricUserId} matched to Staff: ${staffMember.full_name} (${staffMember.role})`
      });

      revalidatePath('/');
      revalidatePath('/staff/attendance');

      return NextResponse.json({
        success: true,
        staff: {
          id: staffMember.id,
          full_name: staffMember.full_name,
          role: staffMember.role,
        },
        log: {
          punch_time: punchTime,
          punch_type: punchType,
        }
      });
    }

    // Log lookup diagnostics success for members
    await supabase.from('biometric_sync_logs').insert({
      biometric_user_id: biometricUserId,
      machine_type: machineType,
      status: 'Success',
      message: `Biometric User ID ${biometricUserId} matched to Member: ${member.full_name} on ${machineType} Machine`
    });

    // 4. Determine membership status based on expiration (Bypassed for Daily Pass)
    let resolvedStatus = member.status;
    let expiryStr = 'N/A';

    if (member.duration === 'Daily Pass') {
      if (resolvedStatus === 'Expired') {
        resolvedStatus = 'Active';
      }
    } else if (member.package_end_date) {
      const expiry = new Date(member.package_end_date);
      const now = new Date();
      const isExpired = expiry < now;
      
      if (member.status === 'Active' && isExpired) {
        resolvedStatus = 'Expired';
      } else if (member.status === 'Expired' && !isExpired) {
        resolvedStatus = 'Active';
      }
      expiryStr = expiry.toISOString().split('T')[0];
    }

    // 5. Create attendance log
    const { error: logError } = await supabase
      .from('attendance_logs')
      .insert({
        member_id: member.id,
        member_name: member.full_name,
        biometric_user_id: biometricUserId,
        machine_type: machineType,
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
        expiry: expiryStr,
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
