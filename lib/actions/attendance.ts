"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { AttendanceLog, Member } from '@/types';
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

// Fetch all attendance logs for the current calendar day
export async function getTodayAttendanceLogs(): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const startOfDay = getStartOfTodayIST();

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .gte('punch_time', startOfDay.toISOString())
    .order('punch_time', { ascending: false });

  if (error) {
    console.error('Error in getTodayAttendanceLogs:', error);
    throw error;
  }
  return data as AttendanceLog[];
}

// Fetch general attendance history with filters
export async function getAttendanceHistory(filters?: {
  member_id?: string;
  startDate?: string;
  endDate?: string;
}): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  let query = supabase.from('attendance_logs').select('*');

  if (filters?.member_id) {
    query = query.eq('member_id', filters.member_id);
  }
  if (filters?.startDate) {
    query = query.gte('punch_time', new Date(filters.startDate).toISOString());
  }
  if (filters?.endDate) {
    // Extend end date to late night
    const end = new Date(filters.endDate);
    end.setHours(23, 59, 59, 999);
    query = query.lte('punch_time', end.toISOString());
  }

  const { data, error } = await query.order('punch_time', { ascending: false });

  if (error) {
    console.error('Error in getAttendanceHistory:', error);
    throw error;
  }
  return data as AttendanceLog[];
}

// Calculate current metrics, including check-ins, check-outs, and live occupancy
export async function getAttendanceAnalytics() {
  const supabase = await createClient();

  const startOfDay = getStartOfTodayIST();

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0,0,0,0);

  // Fetch all attendance analytics queries in parallel to optimize DB load
  const [
    { data: todayLogs, error: todayError },
    { data: trendLogs, error: trendError }
  ] = await Promise.all([
    supabase
      .from('attendance_logs')
      .select('member_id, punch_type, punch_time')
      .gte('punch_time', startOfDay.toISOString())
      .order('punch_time', { ascending: true }),
    supabase
      .from('attendance_logs')
      .select('punch_time, punch_type')
      .gte('punch_time', thirtyDaysAgo.toISOString())
      .eq('punch_type', 'checkin')
  ]);

  if (todayError) {
    console.error('Error fetching today logs for analytics:', todayError);
    return { checkins: 0, checkouts: 0, occupancy: 0, dailyTrend: [], hourlyDistribution: [] };
  }

  let checkins = 0;
  let checkouts = 0;
  todayLogs?.forEach((log: any) => {
    if (log?.punch_type === 'checkin') checkins++;
    else if (log?.punch_type === 'checkout') checkouts++;
  });

  // Occupancy: use ALL of today's logs (sorted ascending) to track who is currently inside
  const activeMembers = new Set<string>();
  if (todayLogs) {
    todayLogs.forEach((log: any) => {
      if (log?.member_id) {
        if (log.punch_type === 'checkin') {
          activeMembers.add(log.member_id);
        } else if (log.punch_type === 'checkout') {
          activeMembers.delete(log.member_id);
        }
      }
    });
  }
  const occupancy = activeMembers.size;


  const dailyCounts: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dailyCounts[dateStr] = 0;
  }

  trendLogs?.forEach((log: any) => {
    const dateStr = new Date(log.punch_time).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    if (dailyCounts[dateStr] !== undefined) {
      dailyCounts[dateStr]++;
    }
  });

  const dailyTrend = Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));

  // Hourly distribution for today
  const hourlyCounts: Record<number, number> = {};
  for (let i = 5; i <= 23; i++) {
    // 5 AM to 11 PM
    hourlyCounts[i] = 0;
  }

  todayLogs?.forEach((log: any) => {
    if (log?.punch_type === 'checkin' && log?.punch_time) {
      const pDate = new Date(log.punch_time);
      if (!isNaN(pDate.getTime())) {
        // Convert UTC time to IST hours for display
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
    .select('member_name, punch_time')
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
    `Deleted attendance check-in for: ${log?.member_name || id} ${punchTimeStr ? `at ${punchTimeStr}` : ''}`,
    'Attendance',
    user.id
  );
  revalidatePath('/');
  revalidatePath('/attendance');
}

// Fetch the 10 most recent logs of today, batch-enriching member data on the server
export async function getTodayMonitorLogs() {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch the 10 most recent logs of today in a single query
  const { data: logs, error: logsError } = await supabase
    .from('attendance_logs')
    .select('id, member_id, member_name, device_user_id, punch_time, punch_type')
    .gte('punch_time', startOfDay.toISOString())
    .order('punch_time', { ascending: false })
    .limit(10);

  if (logsError) {
    console.error('Error in getTodayMonitorLogs:', logsError);
    throw logsError;
  }

  if (!logs || logs.length === 0) return [];

  // Batch query all associated members to avoid N+1 query overhead in client
  const memberIds = Array.from(new Set(logs.map((log: any) => log?.member_id).filter(Boolean)));
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, phone, email, membership_plan, join_date, status, profile_photo')
    .in('id', memberIds);

  if (membersError) {
    console.error('Error fetching batch members for monitor:', membersError);
    throw membersError;
  }

  const memberMap = new Map((members || []).map((m: any) => [m.id, m]));

  return logs.map((log: any) => ({
    ...log,
    member: log?.member_id ? memberMap.get(log.member_id) || null : null
  }));
}
