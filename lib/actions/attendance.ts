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
async function enrichLogs(rawLogs: any[]): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  
  // Fetch all members with biometric user IDs for matching
  const { data: members, error: membersError } = await supabase
    .from('members')
    .select('id, full_name, phone, email, membership_plan, join_date, status, profile_photo, biometric_user_id');
    
  if (membersError) {
    console.error('Error fetching members for matching:', membersError);
    return [];
  }

  // Create lookup map (key: clean biometric ID digits, value: member object)
  const membersMap = new Map<string, any>();
  members.forEach((member: any) => {
    if (member.biometric_user_id) {
      const cleanId = cleanBiometricId(member.biometric_user_id);
      if (cleanId) {
        membersMap.set(cleanId, member);
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
    
    // Match member
    const member = membersMap.get(cleanId) || null;
    
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
      device_id: log.device_id,
      punch_time: timestamp,
      punch_type,
      created_at: log.created_at,
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
export async function getTodayAttendanceLogs(): Promise<AttendanceLog[]> {
  const supabase = await createClient();
  const startOfDay = getStartOfTodayIST();

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('*')
    .gte('created_at', startOfDay.toISOString())
    .order('created_at', { ascending: false });

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
  
  if (filters?.startDate) {
    query = query.gte('created_at', new Date(filters.startDate).toISOString());
  }
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

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(0,0,0,0);

  // Fetch today's logs and past 30 days logs
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
      .gte('created_at', thirtyDaysAgo.toISOString())
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

  // Daily trend calculations (last 30 days)
  const dailyCounts: Record<string, number> = {};
  for (let i = 29; i >= 0; i--) {
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
