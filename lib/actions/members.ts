"use server";

import { createClient } from '@/lib/supabase/server';
import { Member, MemberFormValues } from '@/types';
import { sendWelcomeSMS, sendRenewalSMS } from '@/lib/sms';
import { getMembershipExpiry, formatDate } from '@/lib/utils';

export async function getMembers(): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Member[];
}

export async function getMemberById(id: string): Promise<Member | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Member;
}

export async function createMember(values: MemberFormValues): Promise<Member> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('members')
    .insert([values])
    .select()
    .single();
  if (error) throw error;

  // Dispatch welcome SMS to the new member
  try {
    if (data.phone) {
      await sendWelcomeSMS(data.id, data.full_name, data.phone);
    }
  } catch (smsErr) {
    console.error('Failed to trigger welcome SMS:', smsErr);
  }

  return data as Member;
}

export async function updateMember(id: string, values: Partial<MemberFormValues>): Promise<Member> {
  const supabase = await createClient();

  // Retrieve current member record to check status/plan changes
  const { data: oldMember } = await supabase
    .from('members')
    .select('full_name, phone, join_date, status, membership_plan')
    .eq('id', id)
    .single();

  const { data, error } = await supabase
    .from('members')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;

  // Trigger automated Renewal SMS if membership start shifted or reactivated to Active
  if (oldMember && data && data.phone) {
    const isPlanRenewed = values.join_date && values.join_date !== oldMember.join_date;
    const isStatusActivated = (oldMember.status === 'Expired' || oldMember.status === 'Inactive') && data.status === 'Active';

    if (isPlanRenewed || isStatusActivated) {
      const newExpiry = getMembershipExpiry(data.join_date, data.membership_plan);
      const formattedExpiry = formatDate(newExpiry);
      
      try {
        await sendRenewalSMS(data.id, data.full_name, formattedExpiry, data.phone);
      } catch (smsErr) {
        console.error('Failed to trigger renewal SMS:', smsErr);
      }
    }
  }

  return data as Member;
}

export async function deleteMember(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadProfilePhoto(file: File): Promise<string> {
  const supabase = await createClient();
  const ext = file.name.split('.').pop();
  const filename = `${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('profile-photos')
    .upload(filename, file, { upsert: true });
  if (error) throw error;
  const { data } = supabase.storage.from('profile-photos').getPublicUrl(filename);
  return data.publicUrl;
}

export async function getDashboardStats() {
  const supabase = await createClient();
  const { data: members } = await supabase.from('members').select('status, membership_plan, join_date');
  const { data: invoices } = await supabase
    .from('invoices')
    .select('amount, status, created_at')
    .eq('status', 'Paid');

  const total = members?.length ?? 0;
  const active = members?.filter(m => m.status === 'Active').length ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenue = invoices
    ?.filter(i => new Date(i.created_at) >= monthStart)
    .reduce((sum, i) => sum + Number(i.amount), 0) ?? 0;

  return { total, active, revenue };
}
