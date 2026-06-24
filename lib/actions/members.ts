"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Member, MemberFormValues } from '@/types';
import { sendWelcomeSMS, sendRenewalSMS } from '@/lib/sms';
import { getMembershipExpiry, formatDate } from '@/lib/utils';
import { validateRole } from './auth';
import { logAudit } from './audit';

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

export async function createMember(values: MemberFormValues): Promise<{ data?: Member; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin', 'Receptionist', 'Trainer']);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('members')
      .insert([values])
      .select()
      .single();
    if (error) return { error: error.message };

    await logAudit(`Created member: ${data.full_name}`, 'Members', user.id);

    // Dispatch welcome SMS to the new member
    try {
      if (data.phone) {
        await sendWelcomeSMS(data.id, data.full_name, data.phone);
      }
    } catch (smsErr) {
      console.error('Failed to trigger welcome SMS:', smsErr);
    }

    revalidatePath('/');
    revalidatePath('/members');
    return { data: data as Member };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function updateMember(id: string, values: Partial<MemberFormValues>): Promise<{ data?: Member; error?: string }> {
  try {
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
    if (error) return { error: error.message };

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

    revalidatePath('/');
    revalidatePath('/members');
    return { data: data as Member };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function deleteMember(id: string): Promise<void> {
  const { user } = await validateRole(['Super Admin', 'Admin']);
  const supabase = await createClient();

  const { data: member } = await supabase
    .from('members')
    .select('full_name')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;

  await logAudit(`Deleted member: ${member?.full_name || id}`, 'Members', user.id);
  revalidatePath('/');
  revalidatePath('/members');
}

export async function uploadProfilePhoto(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const adminSupabase = createAdminClient();

    // Ensure the bucket exists by checking the list of buckets and creating it if missing
    const { data: buckets, error: listError } = await adminSupabase.storage.listBuckets();
    if (listError) {
      console.error('Failed to list buckets:', listError.message);
    }
    
    const bucketExists = buckets?.some(b => b.id === 'profile-photos');
    if (!bucketExists) {
      const { error: createError } = await adminSupabase.storage.createBucket('profile-photos', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880 // 5MB
      });
      if (createError) {
        return { error: `Failed to create storage bucket: ${createError.message}` };
      }
    }

    const ext = file.name.split('.').pop();
    const filename = `${Date.now()}.${ext}`;
    const { error } = await adminSupabase.storage
      .from('profile-photos')
      .upload(filename, file, { upsert: true });
    if (error) return { error: error.message };

    const { data } = adminSupabase.storage.from('profile-photos').getPublicUrl(filename);
    return { url: data.publicUrl };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function getDashboardStats() {
  const supabase = await createClient();
  
  // Run queries in parallel using Promise.all
  const [
    { data: members, error: membersError },
    { data: invoices, error: invoicesError }
  ] = await Promise.all([
    supabase.from('members').select('status, membership_plan, join_date'),
    supabase
      .from('invoices')
      .select('amount, status, created_at')
      .eq('status', 'Paid')
  ]);

  if (membersError) throw membersError;
  if (invoicesError) throw invoicesError;

  const total = members?.length ?? 0;
  const active = members?.filter((m: any) => m.status === 'Active').length ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenue = invoices
    ?.filter((i: any) => new Date(i.created_at) >= monthStart)
    .reduce((sum: number, i: any) => sum + Number(i.amount), 0) ?? 0;

  return { total, active, revenue };
}

export async function getMembersPaginated({
  page = 1,
  limit = 10,
  search = '',
  status = 'All',
  plan = 'All'
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
} = {}): Promise<{ members: Member[]; totalCount: number }> {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let query = supabase
    .from('members')
    .select('*', { count: 'exact' });

  // Apply search filtering on name, phone, or email
  const cleanSearch = search.trim();
  if (cleanSearch) {
    query = query.or(`full_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`);
  }

  // Apply status filter
  if (status && status !== 'All') {
    query = query.eq('status', status);
  }

  // Apply plan filter
  if (plan && plan !== 'All') {
    query = query.eq('membership_plan', plan);
  }

  // Sorting and pagination ranges
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching paginated members:', error);
    throw error;
  }

  return {
    members: (data || []) as Member[],
    totalCount: count || 0,
  };
}
