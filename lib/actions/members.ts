"use server";

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Member, MemberFormValues, memberSchema } from '@/types';
import { sendWelcomeSMS, sendRenewalSMS } from '@/lib/sms';
import { formatDate } from '@/lib/utils';
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
    
    // Validate inputs server-side (Requirement 3 & 4)
    const validatedValues = memberSchema.parse(values);
    
    const supabase = await createClient();

    // Server-side uniqueness check: biometric_user_id must be unique per machine
    if (validatedValues.biometric_user_id) {
      const { data: existing } = await supabase
        .from('members')
        .select('id')
        .eq('biometric_user_id', validatedValues.biometric_user_id)
        .eq('machine_type', validatedValues.machine_type)
        .limit(1);
      if (existing && existing.length > 0) {
        return { error: `Biometric ID ${validatedValues.biometric_user_id} already exists on ${validatedValues.machine_type} Machine.` };
      }
    }

    const { data, error } = await supabase
      .from('members')
      .insert([validatedValues])
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function updateMember(id: string, values: Partial<MemberFormValues>): Promise<{ data?: Member; error?: string }> {
  try {
    const supabase = await createClient();

    // Retrieve current member record to check status/plan changes
    const { data: oldMember } = await supabase
      .from('members')
      .select('full_name, phone, package_start_date, package_end_date, status, package_name')
      .eq('id', id)
      .single();

    // Validate biometric_user_id specifically if it is updated (Requirement 3 & 4)
    if (values.biometric_user_id !== undefined) {
      const bioId = values.biometric_user_id;
      if (bioId && !/^\d+$/.test(bioId)) {
        throw new Error("Biometric User ID must contain numeric digits only");
      }

      // Check uniqueness when biometric_user_id or machine_type is changing
      const targetMachine = values.machine_type || undefined;
      if (bioId) {
        let q = supabase.from('members').select('id');
        q = q.eq('biometric_user_id', bioId);
        if (targetMachine) q = q.eq('machine_type', targetMachine);
        else q = q.eq('machine_type', (await supabase.from('members').select('machine_type').eq('id', id).single()).data?.machine_type || 'Gents');
        const { data: existing } = await q.limit(1);
        if (existing && existing.length > 0 && existing[0].id !== id) {
          return { error: `Biometric ID ${bioId} already exists on ${targetMachine || 'the assigned'} Machine.` };
        }
      }
    }

    const { data, error } = await supabase
      .from('members')
      .update(values)
      .eq('id', id)
      .select()
      .single();
    if (error) return { error: error.message };

    // Trigger automated Renewal SMS if membership start shifted or reactivated to Active
    if (oldMember && data && data.phone) {
      const isPlanRenewed = (values.package_start_date && values.package_start_date !== oldMember.package_start_date) || (values.package_end_date && values.package_end_date !== oldMember.package_end_date);
      const isStatusActivated = (oldMember.status === 'Expired' || oldMember.status === 'Inactive') && data.status === 'Active';

      if (isPlanRenewed || isStatusActivated) {
        const formattedExpiry = formatDate(data.package_end_date);
        
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
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
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
    return { error: errorMsg };
  }
}

export async function getDashboardStats() {
  const supabase = await createClient();
  
  // Run queries in parallel using Promise.all
  const [
    { data: members, error: membersError },
    { data: invoices, error: invoicesError }
  ] = await Promise.all([
    supabase.from('members').select('status, package_name, package_start_date, package_end_date'),
    supabase
      .from('invoices')
      .select('amount, status, created_at')
      .eq('status', 'Paid')
  ]);

  if (membersError) throw membersError;
  if (invoicesError) throw invoicesError;

  const total = members?.length ?? 0;
  const active = members?.filter((m: { status: string }) => m.status === 'Active').length ?? 0;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const revenue = invoices
    ?.filter((i: { created_at: string }) => new Date(i.created_at) >= monthStart)
    .reduce((sum: number, i: { amount: number | string }) => sum + Number(i.amount), 0) ?? 0;

  return { total, active, revenue };
}

export async function getMembersPaginated({
  page = 1,
  limit = 10,
  search = '',
  status = 'All',
  plan = 'All',
  machine = 'All'
}: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  plan?: string;
  machine?: string;
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
    query = query.ilike('package_name', `%${plan}%`);
  }

  // Apply machine filter
  if (machine && machine !== 'All') {
    query = query.eq('machine_type', machine);
  }

  // Apply machine filter if provided via the `plan` param overload (legacy) or explicit machine param
  // NOTE: to keep backward compatibility, callers should pass `plan` and `machine` separately in future.

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

export async function getMemberByBiometricId(biometricId: string): Promise<Member | null> {
  const supabase = await createClient();
  
  // Clean biometric ID to digits only
  const cleanId = biometricId.replace(/[^0-9]/g, '');
  if (!cleanId) return null;
  
  // Try to find by Gents machine first, then Ladies (caller should ideally pass machine)
  const { data: gentsData, error: gentsErr } = await supabase
    .from('members')
    .select('*')
    .eq('biometric_user_id', cleanId)
    .eq('machine_type', 'Gents')
    .limit(1)
    .maybeSingle();
  if (gentsErr) {
    console.error('Error in getMemberByBiometricId (Gents):', gentsErr);
  }
  if (gentsData) return gentsData as Member;

  const { data: ladiesData, error: ladiesErr } = await supabase
    .from('members')
    .select('*')
    .eq('biometric_user_id', cleanId)
    .eq('machine_type', 'Ladies')
    .limit(1)
    .maybeSingle();
  if (ladiesErr) {
    console.error('Error in getMemberByBiometricId (Ladies):', ladiesErr);
  }
  if (ladiesData) return ladiesData as Member;
    
  return null;
}

