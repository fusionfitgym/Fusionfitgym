"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AttendanceLog, Member, BiometricSyncLog } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

// Helper: Get start of today in IST (UTC+5:30)
function getStartOfTodayIST(): Date {
  const now = new Date();
  // Calculate IST offset: UTC + 5:30
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffsetMs);
  // Get date parts in IST
  const year = istNow.getUTCFullYear();
  const month = istNow.getUTCMonth();
  const day = istNow.getUTCDate();
  // Midnight IST in UTC = midnight IST - 5:30 = previous day 18:30 UTC
  return new Date(Date.UTC(year, month, day) - istOffsetMs);
}

// Helper: Extract numeric digits from biometric ID string, matching ONLY numeric biometric IDs
function cleanBiometricId(id: string | null | undefined): string {
  if (!id) return '';
  const trimmed = id.trim();

  // Ignore any log containing "OPLOG" (Requirement 2)
  if (/oplog/i.test(trimmed)) {
    return '';
  }

  // Handle forms like "USER PIN=106" or "FP PIN-203" or "USER PIN 203"
  const pinMatch = trimmed.match(/PIN\s*[=-]?\s*(\d+)/i);
  if (pinMatch) {
    return pinMatch[1];
  }

  // Extract all numeric digits
  const clean = trimmed.replace(/[^0-9]/g, '');

  // Ensure it matches only numeric biometric IDs (Requirement 1)
  if (/^\d+$/.test(clean)) {
    return clean;
  }

  return '';
}

// Helper: Resolve timestamp, falling back to created_at if punch_time is invalid/prior to 2024
function getBestTimestamp(log: any): string {
  const pt = log.punch_time ? new Date(log.punch_time) : null;
  if (!pt || isNaN(pt.getTime()) || pt.getFullYear() < 2024) {
    return log.created_at;
  }
  return log.punch_time;
}

// Helper: Enrich raw logs with member data and alternate punch types dynamically
export async function enrichLogs(rawLogs: any[]): Promise<AttendanceLog[]> {
  const supabase = await createClient();

  // Fetch all members with biometric user IDs for matching
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, phone, email, membership_plan, join_date, status, profile_photo, biometric_user_id, machine_type');

  if (membersError) {
    console.error('Error fetching members for matching:', membersError);
    return [];
  }

  // Create lookup map (key: `${machine}_${cleanId}`, value: member object)
  const membersMap = new Map<string, any>();
  members.forEach((member: any) => {
    if (member.biometric_user_id && member.machine_type) {
      const cleanId = cleanBiometricId(member.biometric_user_id);
      if (cleanId) {
        const key = `${member.machine_type}_${cleanId}`;
        membersMap.set(key, member);
      }
    }
  });

  // Filter out OPLOG records (Requirement 5)
  const nonOplogRawLogs = rawLogs.filter(log => {
    const rawId = log.member_id || '';
    return !rawId.toLowerCase().startsWith('oplog');
  });

  // Sort raw logs chronologically (ascending) to accurately alternate check-in/check-out
  const sortedRaw = [...nonOplogRawLogs].sort((a, b) =>
    new Date(a.created_at || a.punch_time).getTime() - new Date(b.created_at || b.punch_time).getTime()
  );

  const punchCounts: Record<string, number> = {};

  const enrichedSorted = sortedRaw.map((log) => {
    const rawBiometricId = log.member_id || '';
    const cleanId = cleanBiometricId(rawBiometricId);

    // Determine machine for this raw log
    const logMachine = log.machine_type || log.device_id || 'Gents';
    const machineKey = String(logMachine).startsWith('Ladies') || String(logMachine).toLowerCase().includes('ladies') ? 'Ladies' : 'Gents';

    // Match member using composite key
    const member = cleanId ? (membersMap.get(`${machineKey}_${cleanId}`) || null) : null;

    // Alternate punch types per member per calendar day
    const timestamp = getBestTimestamp(log);
    const dateStr = new Date(timestamp).toDateString();
    const punchKey = `${cleanId || rawBiometricId}_${dateStr}`;
    const punchIndex = punchCounts[punchKey] || 0;
    punchCounts[punchKey] = punchIndex + 1;
    const punch_type = punchIndex % 2 === 0 ? 'checkin' : 'checkout';

    return {
      id: log.id,
      member_id: member ? member.id : rawBiometricId,
      member_name: member ? member.full_name : `Unknown Member (${rawBiometricId})`,
      biometric_user_id: cleanId || rawBiometricId,
      machine_type: machineKey,
      device_id: log.device_id,
      punch_time: timestamp,
      punch_type,
      created_at: log.created_at,
      sync_status: log.sync_status,
      member: member ? {
        id: member.id,
        full_name: member.full_name,
        phone: member.phone,
        email: member.email,
        membership_plan: member.membership_plan,
        join_date: member.join_date,
        status: member.status,
        profile_photo: member.profile_photo,
        biometric_user_id: member.biometric_user_id
      } : undefined
    };
  });

  // Sort back to descending (newest first) for UI presentation
  const finalLogs = enrichedSorted.sort((a, b) =>
    new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime()
  );

  // DEBUG LOGGING (Requirement 7 & 9)
  finalLogs.forEach((log) => {
    console.log(`[ATTENDANCE MATCHING DEBUG]
      attendance user id: ${log.biometric_user_id}
      matched member id: ${log.member ? log.member.id : 'NONE'}
      matched member name: ${log.member ? log.member.full_name : 'NONE'}`
    );
  });

  const matchCount = finalLogs.filter(l => l.member).length;
  const unmatchedIds = Array.from(new Set(
    finalLogs.filter(l => !l.member).map(l => l.biometric_user_id)
  ));

  console.log(`[DEBUG Attendance Enrich]
    Total raw records fetched: ${rawLogs.length}
    Filtered OPLOG records: ${rawLogs.length - nonOplogRawLogs.length}
    Successfully matched members: ${matchCount}
    Unmatched records: ${nonOplogRawLogs.length - matchCount}
    Unmatched Biometric IDs:`, unmatchedIds
  );

  return finalLogs as AttendanceLog[];
}

// Fetch all attendance logs for the current calendar day (using created_at)
export async function getTodayAttendanceLogs(machine?: 'Gents' | 'Ladies' | 'All'): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const startOfDay = getStartOfTodayIST();

  let query = supabase
    .from('attendance_logs')
    .select('*')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

  if (machine && machine !== 'All') {
    query = query.eq('machine_type', machine);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error in getTodayAttendanceLogs:', error);
    throw error;
  }

  return enrichLogs(data || []);
}

// Fetch general attendance history with filters
export async function getAttendanceHistory(filters?: {
  member_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  let query = supabase.from('attendance_logs').select('*');

  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  if (filters?.member_id) {
    // If the filter is passing member_id as a UUID, find that member first
    const { data: member } = await supabase
      .from('members')
      .select('biometric_user_id')
      .eq('id', filters.member_id)
      .single();

    if (member?.biometric_user_id) {
      query = query.or(`member_id.eq.${member.biometric_user_id},member_id.ilike.%PIN=${member.biometric_user_id}`);
    } else {
      return [];
    }
  }

  // Enforce query limit of last 15 days
  let queryStartDate = fifteenDaysAgo;
  if (filters?.startDate) {
    const requestedStart = new Date(filters.startDate);
    if (requestedStart > fifteenDaysAgo) {
      queryStartDate = requestedStart;
    }
  }
  query = query.gte('created_at', queryStartDate.toISOString());

  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    query = query.lte('created_at', end.toISOString());
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('Error in getAttendanceHistory:', error);
    throw error;
  }

  return enrichLogs(data || []);
}

// Calculate current metrics, including check-ins, check-outs, and live occupancy
export async function getAttendanceAnalytics() {
  const supabase = await createClient();
  const startOfDay = getStartOfTodayIST();

  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  // Fetch today's logs and past 15 days logs
  const [
    { data: todayRawLogs, error: todayError },
    { data: trendRawLogs, error: trendError }
  ] = await Promise.all([
    supabase
      .from('attendance_logs')
      .select('*')
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: true }),
    supabase
      .from('attendance_logs')
      .select('*')
      .gte('created_at', fifteenDaysAgo.toISOString())
  ]);

  if (todayError) {
    console.error('Error fetching today logs for analytics:', todayError);
    return { checkins: 0, checkouts: 0, occupancy: 0, dailyTrend: [], hourlyDistribution: [] };
  }

  // Enrich logs to match members and calculate punch types
  const enrichedTodayLogs = await enrichLogs(todayRawLogs || []);
  const enrichedTrendLogs = await enrichLogs(trendRawLogs || []);

  // Filter to ONLY matched records for stats calculation (Requirement 8)
  const todayLogs = enrichedTodayLogs.filter(log => log.member);
  const trendLogs = enrichedTrendLogs.filter(log => log.member);

  let checkins = 0;
  let checkouts = 0;
  todayLogs.forEach((log: any) => {
    if (log?.punch_type === 'checkin') checkins++;
    else if (log?.punch_type === 'checkout') checkouts++;
  });

  // Calculate live occupancy based on inside members
  const activeMembers = new Set<string>();
  todayLogs.forEach((log: any) => {
    if (log?.member_id) {
      if (log.punch_type === 'checkin') {
        activeMembers.add(log.member_id);
      } else if (log.punch_type === 'checkout') {
        activeMembers.delete(log.member_id);
      }
    }
  });
  const occupancy = activeMembers.size;

  // Daily trend calculations (last 15 days)
  const dailyCounts: Record<string, number> = {};
  for (let i = 14; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dailyCounts[dateStr] = 0;
  }

  trendLogs.forEach((log: any) => {
    const dateStr = new Date(log.punch_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (dailyCounts[dateStr] !== undefined) {
      dailyCounts[dateStr]++;
    }
  });

  const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

  // Hourly distribution for today
  const hourlyCounts: Record<number, number> = {};
  for (let i = 5; i <= 23; i++) {
    hourlyCounts[i] = 0;
  }

  todayLogs.forEach((log: any) => {
    if (log?.punch_type === 'checkin' && log?.punch_time) {
      const pDate = new Date(log.punch_time);
      if (!isNaN(pDate.getTime())) {
        // Convert to IST hours for trend grouping
        const istHours = (pDate.getUTCHours() + 5 + Math.floor((pDate.getUTCMinutes() + 30) / 60)) % 24;
        if (hourlyCounts[istHours] !== undefined) {
          hourlyCounts[istHours]++;
        }
      }
    }
  });

  const hourlyDistribution = Object.entries(hourlyCounts).map(([hour, count]) => {
    const displayHour = Number(hour) > 12
      ? `${Number(hour) - 12} PM`
      : Number(hour) === 12 ? '12 PM' : `${hour} AM`;
    return { hour: displayHour, count };
  });

  return {
    checkins,
    checkouts,
    occupancy,
    dailyTrend,
    hourlyDistribution,
  };
}

export async function deleteAttendanceLog(id: string): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
  const supabase = await createClient();

  const { data: log } = await supabase
    .from('attendance_logs')
    .select('punch_time, member_id')
    .eq('id', id)
    .single();

  const { error } = await supabase
    .from('attendance_logs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error in deleteAttendanceLog:', error);
    throw error;
  }

  const punchTimeStr = log?.punch_time ? new Date(log.punch_time).toLocaleTimeString() : '';
  await logAudit(
    `Deleted attendance check-in for member ID: ${log?.member_id || id} ${punchTimeStr ? `at ${punchTimeStr}` : ''}`,
    'Attendance',
    user.id
  );
  revalidatePath('/');
  revalidatePath('/attendance');
}

// Fetch the 10 most recent logs of today, batch-enriching member data
export async function getTodayMonitorLogs() {
  const supabase = await createClient();
  const startOfDay = getStartOfTodayIST();

  const { data: logs, error: logsError } = await supabase
    .from('attendance_logs')
    .select('*')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false })
    .limit(10);

  if (logsError) {
    console.error('Error in getTodayMonitorLogs:', logsError);
    throw logsError;
  }

  return enrichLogs(logs || []);
}

export async function getSyncLogs(): Promise<BiometricSyncLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('biometric_sync_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    console.error('Error fetching biometric sync logs:', error);
    throw error;
  }
  return data as BiometricSyncLog[];
}

export async function cleanupOldAttendanceLogs(): Promise<{ success: boolean; deletedCount: number; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
    fifteenDaysAgo.setHours(0, 0, 0, 0);

    // Get count of logs to delete
    const { data: logsToDelete, error: countError } = await supabase
      .from('attendance_logs')
      .select('id')
      .lt('punch_time', fifteenDaysAgo.toISOString());

    if (countError) {
      console.error('Error fetching logs to delete:', countError);
      return { success: false, deletedCount: 0, error: countError.message };
    }

    const count = logsToDelete?.length || 0;

    // Delete logs
    const { error: deleteError } = await supabase
      .from('attendance_logs')
      .delete()
      .lt('punch_time', fifteenDaysAgo.toISOString());

    if (deleteError) {
      console.error('Error performing manual logs cleanup:', deleteError);
      return { success: false, deletedCount: 0, error: deleteError.message };
    }

    await logAudit(
      `Manually deleted ${count} old attendance logs (older than 15 days)`,
      'Attendance',
      user.id
    );

    revalidatePath('/');
    revalidatePath('/reports');
    revalidatePath('/attendance');

    return { success: true, deletedCount: count };
  } catch (err: any) {
    console.error('Manual attendance log cleanup failed:', err);
    return { success: false, deletedCount: 0, error: err.message || 'Unknown error' };
  }
}

// ── Staff Attendance server actions ─────────────────────────────

function getISTDateString(dateInput: string | Date): string {
  const date = new Date(dateInput);
  const istDate = new Date(date.getTime() + (5.5 * 60 * 60 * 1000));
  const yyyy = istDate.getUTCFullYear();
  const mm = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function getStaffAttendanceHistory(filters?: {
  search?: string;
  role?: string;
  status?: string;
  timeframe?: 'today' | '7days' | '15days' | '30days' | 'all';
}) {
  const supabase = await createClient();

  let query = supabase
    .from('staff_attendance')
    .select(`
      id,
      date,
      check_in,
      check_out,
      status,
      working_hours,
      overtime_hours,
      late_arrival_minutes,
      leave_type,
      shift,
      notes,
      staff:staff_id (
        id,
        full_name,
        role,
        employee_id,
        biometric_gents_id,
        biometric_ladies_id
      )
    `);

  if (filters?.timeframe && filters.timeframe !== 'all') {
    let daysToSubtract = 0;
    if (filters.timeframe === '7days') daysToSubtract = 7;
    else if (filters.timeframe === '15days') daysToSubtract = 15;
    else if (filters.timeframe === '30days') daysToSubtract = 30;

    const now = new Date();
    const targetDate = new Date(now.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000) + (5.5 * 60 * 60 * 1000));
    const dateStr = targetDate.getUTCFullYear() + '-' +
      String(targetDate.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(targetDate.getUTCDate()).padStart(2, '0');

    query = query.gte('date', dateStr);
  }

  if (filters?.status && filters.status !== 'All') {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('date', { ascending: false });

  if (error) {
    console.error('Error fetching staff attendance history:', error);
    throw error;
  }

  let list = (data || []).map((row: any) => ({
    id: row.id,
    date: row.date,
    check_in: row.check_in,
    check_out: row.check_out,
    status: row.status,
    working_hours: row.working_hours,
    overtime_hours: row.overtime_hours,
    late_arrival_minutes: row.late_arrival_minutes,
    leave_type: row.leave_type,
    shift: row.shift,
    notes: row.notes,
    employee_id: row.staff?.employee_id,
    full_name: row.staff?.full_name,
    role: row.staff?.role,
    biometric_gents_id: row.staff?.biometric_gents_id,
    biometric_ladies_id: row.staff?.biometric_ladies_id,
  }));

  if (filters?.search) {
    const q = filters.search.toLowerCase().trim();
    list = list.filter((item: { full_name: any; biometric_gents_id: any; biometric_ladies_id: any; }) =>
      (item.full_name || '').toLowerCase().includes(q) ||
      (item.biometric_gents_id || '').includes(q) ||
      (item.biometric_ladies_id || '').includes(q)
    );
  }

  if (filters?.role && filters.role !== 'All') {
    list = list.filter((item: { role: string | undefined; }) => item.role === filters.role);
  }

  return list;
}

export async function getStaffAttendanceTodayStats() {
  const supabase = await createClient();
  const todayStr = getISTDateString(new Date());

  const { count: totalStaffCount } = await supabase
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'Active');

  const { data, error } = await supabase
    .from('staff_attendance')
    .select('status, staff(role)')
    .eq('date', todayStr);

  if (error) {
    console.error('Error fetching today staff attendance stats:', error);
    return { present: 0, trainers: 0, janitors: 0, total: totalStaffCount || 0 };
  }

  let present = 0;
  let trainers = 0;
  let janitors = 0;

  (data || []).forEach((row: any) => {
    if (row.status !== 'Absent') {
      present++;
      if (row.staff?.role === 'Trainer') trainers++;
      if (row.staff?.role === 'Janitor') janitors++;
    }
  });

  return { present, trainers, janitors, total: totalStaffCount || 0 };
}

export async function assignBiometricId(
  targetId: string,
  type: 'member' | 'staff',
  biometricUserId: string,
  machineType?: 'Gents' | 'Ladies'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist']);
    const supabase = await createClient();

    if (!/^\d+$/.test(biometricUserId)) {
      return { success: false, error: 'Biometric User ID must contain numeric digits only' };
    }

    if (type === 'member') {
      const { data: existingMember } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('biometric_user_id', biometricUserId)
        .eq('machine_type', machineType || 'Gents')
        .limit(1);
      if (existingMember && existingMember.length > 0) {
        return { success: false, error: `Biometric ID ${biometricUserId} is already assigned to member ${existingMember[0].full_name} on ${machineType || 'Gents'} Machine` };
      }

      const targetCol = (machineType || 'Gents') === 'Gents' ? 'biometric_gents_id' : 'biometric_ladies_id';
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq(targetCol, biometricUserId)
        .limit(1);
      if (existingStaff && existingStaff.length > 0) {
        return { success: false, error: `Biometric ID ${biometricUserId} is already assigned to staff member ${existingStaff[0].full_name} on ${machineType || 'Gents'} Machine` };
      }

      const { error: updateError } = await supabase
        .from('members')
        .update({ biometric_user_id: biometricUserId })
        .eq('id', targetId);

      if (updateError) throw updateError;

      await logAudit(
        `Assigned Biometric ID ${biometricUserId} to member ${targetId}`,
        'Members',
        user.id
      );
    } else {
      const targetCol = (machineType || 'Gents') === 'Gents' ? 'biometric_gents_id' : 'biometric_ladies_id';

      const { data: existingMember } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('biometric_user_id', biometricUserId)
        .eq('machine_type', machineType || 'Gents')
        .limit(1);
      if (existingMember && existingMember.length > 0) {
        return { success: false, error: `Biometric ID ${biometricUserId} is already assigned to member ${existingMember[0].full_name} on ${machineType || 'Gents'} Machine` };
      }

      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq(targetCol, biometricUserId)
        .limit(1);
      if (existingStaff && existingStaff.length > 0) {
        return { success: false, error: `Biometric ID ${biometricUserId} is already assigned to staff member ${existingStaff[0].full_name} on ${machineType || 'Gents'} Machine` };
      }

      const { error: updateError } = await supabase
        .from('staff')
        .update({ [targetCol]: biometricUserId })
        .eq('id', targetId);

      if (updateError) throw updateError;

      await logAudit(
        `Assigned Biometric ID ${biometricUserId} on ${machineType || 'Gents'} to staff member ${targetId}`,
        'Staff',
        user.id
      );
    }

    await supabase
      .from('biometric_sync_logs')
      .update({ status: 'Success', message: `Biometric ID ${biometricUserId} assigned and linked` })
      .eq('biometric_user_id', biometricUserId)
      .eq('status', 'Failed');

    revalidatePath('/');
    revalidatePath('/attendance');
    revalidatePath('/staff');
    revalidatePath('/members');

    return { success: true };
  } catch (err: any) {
    console.error('Error assigning biometric ID:', err);
    return { success: false, error: err.message || 'Unknown error' };
  }
}

