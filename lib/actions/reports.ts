"use server";

import { createClient } from '@/lib/supabase/server';
import { getMembershipExpiry } from '@/lib/utils';

export async function getAttendanceReport(timeframe: 'daily' | 'weekly' | 'monthly') {
  const supabase = await createClient();

  const startDate = new Date();
  if (timeframe === 'daily') {
    startDate.setHours(0, 0, 0, 0);
  } else if (timeframe === 'weekly') {
    startDate.setDate(startDate.getDate() - 7);
  } else {
    startDate.setDate(startDate.getDate() - 30);
  }

  const { data, error } = await supabase
    .from('attendance_logs')
    .select('id, member_name, device_user_id, punch_time, punch_type')
    .gte('punch_time', startDate.toISOString())
    .order('punch_time', { ascending: false });

  if (error) {
    console.error('Error fetching attendance report:', error);
    throw error;
  }
  return data;
}

export async function getMemberReport(type: 'active' | 'expired') {
  const supabase = await createClient();
  const { data: members, error } = await supabase
    .from('members')
    .select('id, full_name, phone, email, membership_plan, join_date, status');

  if (error) {
    console.error('Error fetching member report:', error);
    throw error;
  }

  const processed = (members || []).map((member: any) => {
    const expiry = getMembershipExpiry(member.join_date, member.membership_plan);
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
    return processed.filter((m: any) => m.status === 'Active');
  } else {
    return processed.filter((m: any) => m.status === 'Expired');
  }
}

export async function getRevenueReport() {
  const supabase = await createClient();
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, amount, due_date, status, created_at, members(full_name, membership_plan)');

  if (error) {
    console.error('Error fetching revenue report:', error);
    throw error;
  }

  let totalRevenue = 0;
  let pendingRevenue = 0;
  let overdueRevenue = 0;

  const list = invoices.map((inv: any) => {
    const amount = Number(inv.amount);
    if (inv.status === 'Paid') {
      totalRevenue += amount;
    } else if (inv.status === 'Pending') {
      pendingRevenue += amount;
    } else if (inv.status === 'Overdue') {
      overdueRevenue += amount;
    }

    return {
      invoice_number: inv.invoice_number,
      member_name: inv.members?.full_name ?? 'Unknown',
      plan: inv.members?.membership_plan ?? '—',
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
