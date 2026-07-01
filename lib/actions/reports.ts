"use server";

import { createClient } from '@/lib/supabase/server';
import { Member } from '@/types';
import { enrichLogs } from './attendance';

export async function getAttendanceReport(timeframe: 'daily' | 'weekly' | 'monthly') {
  const supabase = await createClient();

  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
  fifteenDaysAgo.setHours(0, 0, 0, 0);

  const { data: allRawLogs, error: fetchAllError } = await supabase
    .from('attendance_logs')
    .select('*')
    .gte('punch_time', fifteenDaysAgo.toISOString())
    .order('punch_time', { ascending: false });

  if (fetchAllError) {
    console.error('Error fetching all attendance logs for report:', fetchAllError);
    throw fetchAllError;
  }

  const enrichedAllLogs = await enrichLogs(allRawLogs || []);

  // Daily / Today start
  const dailyStart = new Date();
  dailyStart.setHours(0, 0, 0, 0);

  // Last 7 days start
  const weeklyStart = new Date();
  weeklyStart.setDate(weeklyStart.getDate() - 7);
  weeklyStart.setHours(0, 0, 0, 0);

  // Last 15 days start (capped since older is deleted/not fetched)
  const monthlyStart = fifteenDaysAgo;

  const dailyLogs = enrichedAllLogs.filter(log => new Date(log.punch_time) >= dailyStart);
  const weeklyLogs = enrichedAllLogs.filter(log => new Date(log.punch_time) >= weeklyStart);
  const monthlyLogs = enrichedAllLogs.filter(log => new Date(log.punch_time) >= monthlyStart);

  let filteredLogs = [];
  if (timeframe === 'daily') {
    filteredLogs = dailyLogs;
  } else if (timeframe === 'weekly') {
    filteredLogs = weeklyLogs;
  } else {
    filteredLogs = monthlyLogs;
  }

  // Ensure they are ordered newest first (since enrichLogs might have changed order to ASC)
  filteredLogs.sort((a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime());

  console.log(`[REPORTS QUERY LOG] Timeframe: ${timeframe}`);
  console.log(`Raw row count in DB (last 15 days): ${allRawLogs ? allRawLogs.length : 0}`);
  console.log(`Enriched and filtered row count: ${filteredLogs.length}`);

  // Calculate statistics based only on the last 15 days (excluding deleted/expired logs)
  const validAllLogs = enrichedAllLogs.filter(log => log.member && log.member.status === 'Active');
  
  const isTodayIST = (punchTime: string) => {
    if (!punchTime) return false;
    const punchDate = new Date(punchTime);
    const today = new Date();
    return punchDate.getDate() === today.getDate() &&
           punchDate.getMonth() === today.getMonth() &&
           punchDate.getFullYear() === today.getFullYear();
  };

  const totalLogs15 = validAllLogs.length;
  const todayLogs = validAllLogs.filter(log => isTodayIST(log.punch_time));
  const todayLogsCount = todayLogs.length;
  const checkinsToday = todayLogs.filter(log => log.punch_type === 'checkin').length;
  const checkoutsToday = todayLogs.filter(log => log.punch_type === 'checkout').length;

  // Opportunistic cleanup: ~2% of the time, delete logs older than 15 days.
  if (Math.random() < 0.02) {
    (async () => {
      const { error } = await supabase
        .from('attendance_logs')
        .delete()
        .lt('punch_time', fifteenDaysAgo.toISOString());
      if (error) {
        console.error('Opportunistic attendance log cleanup failed:', error);
      }
    })().catch(err => console.error('Failed to run opportunistic cleanup:', err));
  }

  return {
    logs: filteredLogs,
    debug: {
      totalLogs15,
      todayLogsCount,
      checkinsToday,
      checkoutsToday,
      totalCount: enrichedAllLogs.length,
      last7DaysCount: weeklyLogs.length,
      last30DaysCount: monthlyLogs.length,
      rawCountBeforeFilter: allRawLogs ? allRawLogs.length : 0
    }
  };
}

export async function getMemberReport(type: 'active' | 'expired') {
  const supabase = await createClient();
  const { data: members, error } = await supabase
      .from('members')
      .select('id, full_name, phone, email, package_name, package_duration, package_price, package_start_date, package_end_date, status');

  if (error) {
    console.error('Error fetching member report:', error);
    throw error;
  }

  const processed = (members || []).map((member: Member) => {
    const expiry = new Date(member.package_end_date || '');
    const now = new Date();
    const isExpired = isNaN(expiry.getTime()) ? true : expiry < now;
    const resolvedStatus = isExpired ? 'Expired' : member.status;
    const diffTime = isNaN(expiry.getTime()) ? 0 : expiry.getTime() - now.getTime();
    const daysRemaining = isNaN(expiry.getTime()) ? 0 : Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {
      ...member,
      status: resolvedStatus,
      expiry_date: isNaN(expiry.getTime()) ? '' : expiry.toISOString().split('T')[0],
      days_remaining: daysRemaining,
    };
  });

  if (type === 'active') {
    return processed.filter((m: { status: string }) => m.status === 'Active');
  } else {
    return processed.filter((m: { status: string }) => m.status === 'Expired');
  }
}

export async function getRevenueReport() {
  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, due_date, status, created_at, members(full_name, package_name)');

  if (error) {
    console.error('Error fetching revenue report:', error);
    throw error;
  }

  let totalRevenue = 0;
  let pendingRevenue = 0;
  let overdueRevenue = 0;

  const list = (invoices || []).map((inv: {
    invoice_number: string;
    amount: number | string;
    due_date: string;
    status: string;
    created_at: string;
    members: { full_name: string; package_name: string } | { full_name: string; package_name: string }[] | null;
  }) => {
    const amount = Number(inv.amount);
    if (inv.status === 'Paid') {
      totalRevenue += amount;
    } else if (inv.status === 'Pending') {
      pendingRevenue += amount;
    } else if (inv.status === 'Overdue') {
      overdueRevenue += amount;
    }

    const memberData = Array.isArray(inv.members) ? inv.members[0] : inv.members;

    return {
      invoice_number: inv.invoice_number,
      member_name: memberData?.full_name ?? 'Unknown',
      plan: memberData?.package_name ?? '—',
      amount,
      due_date: inv.due_date,
      status: inv.status,
      created_at: inv.created_at,
    };
  });

  return {
    totalRevenue,
    pendingRevenue,
    overdueRevenue,
    invoices: list,
  };
}
