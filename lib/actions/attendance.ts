"use server";

import { createClient } from '@/lib/supabase/server';
import { AttendanceLog } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

// Fetch all attendance logs for the current calendar day
export async function getTodayAttendanceLogs(): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

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

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch today's logs
  const { data: todayLogs, error: todayError } = await supabase
    .from('attendance_logs')
    .select('member_id, punch_type, punch_time')
    .gte('punch_time', startOfDay.toISOString());

  if (todayError) {
    console.error('Error fetching today logs for analytics:', todayError);
    return { checkins: 0, checkouts: 0, occupancy: 0, dailyTrend: [], hourlyDistribution: [] };
  }

  let checkins = 0;
  let checkouts = 0;
  todayLogs?.forEach((log) => {
    if (log.punch_type === 'checkin') checkins++;
    else if (log.punch_type === 'checkout') checkouts++;
  });

  // Occupancy calculation: Members who checked-in within the last 4 hours and did not checkout subsequently
  const fourHoursAgo = new Date();
  fourHoursAgo.setHours(fourHoursAgo.getHours() - 4);

  const { data: recentLogs, error: recentError } = await supabase
    .from('attendance_logs')
    .select('member_id, punch_type, punch_time')
    .gte('punch_time', fourHoursAgo.toISOString())
    .order('punch_time', { ascending: true });

  const activeMembers = new Set<string>();
  if (!recentError && recentLogs) {
    recentLogs.forEach((log) => {
      if (log.punch_type === 'checkin') {
        activeMembers.add(log.member_id);
      } else if (log.punch_type === 'checkout') {
        activeMembers.delete(log.member_id);
      }
    });
  }
  const occupancy = activeMembers.size;

  // Monthly trends (past 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0,0,0,0);

  const { data: trendLogs } = await supabase
    .from('attendance_logs')
    .select('punch_time, punch_type')
    .gte('punch_time', thirtyDaysAgo.toISOString())
    .eq('punch_type', 'checkin');

  const dailyCounts: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    dailyCounts[dateStr] = 0;
  }

  trendLogs?.forEach((log) => {
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

  todayLogs?.forEach((log) => {
    if (log.punch_type === 'checkin') {
      const hour = new Date(log.punch_time).getHours();
      if (hourlyCounts[hour] !== undefined) {
        hourlyCounts[hour]++;
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
}
