'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { Staff, StaffFormValues } from '@/types';
import { validateRole } from './auth';
import { logAudit } from './audit';

// ── Helper: Upload staff photo ─────────────────────────────────────────────────
export async function uploadStaffPhoto(file: File): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await createClient();
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `staff/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage
      .from('profile-photos')
      .upload(fileName, file, { upsert: true, contentType: file.type });
    if (error) return { error: error.message };
    const { data } = supabase.storage.from('profile-photos').getPublicUrl(fileName);
    return { url: data.publicUrl };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to upload photo';
    return { error: msg };
  }
}

// ── Get paginated staff list ───────────────────────────────────────────────────
export async function getStaff({
  page = 1,
  limit = 10,
  search = '',
  role = 'All',
  status = 'All',
}: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: string;
} = {}): Promise<{ staff: Staff[]; totalCount: number }> {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  let query = supabase.from('staff').select('*', { count: 'exact' });

  const cleanSearch = search.trim();
  if (cleanSearch) {
    query = query.or(
      `full_name.ilike.%${cleanSearch}%,phone.ilike.%${cleanSearch}%,employee_id.ilike.%${cleanSearch}%,email.ilike.%${cleanSearch}%`
    );
  }

  if (role && role !== 'All') {
    query = query.eq('role', role);
  }

  if (status && status !== 'All') {
    query = query.eq('status', status);
  }

  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error fetching staff:', error);
    throw error;
  }

  return {
    staff: (data || []) as Staff[],
    totalCount: count || 0,
  };
}

// ── Get staff member by ID ─────────────────────────────────────────────────────
export async function getStaffById(id: string): Promise<Staff | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('staff').select('*').eq('id', id).single();
  if (error) return null;
  return data as Staff;
}

// ── Create staff member ────────────────────────────────────────────────────────
export async function createStaff(
  values: StaffFormValues
): Promise<{ data?: Staff; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    // Check biometric_gents_id uniqueness across staff and Gents members
    if (values.biometric_gents_id) {
      const bioGents = values.biometric_gents_id;
      if (!/^\d+$/.test(bioGents)) {
        return { error: "Biometric Gents ID must contain numeric digits only" };
      }
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('biometric_gents_id', bioGents)
        .maybeSingle();
      if (existingStaff) {
        return { error: `Biometric Gents ID ${bioGents} is already assigned to staff member ${existingStaff.full_name}.` };
      }
      const { data: existingMember } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('biometric_user_id', bioGents)
        .eq('machine_type', 'Gents')
        .maybeSingle();
      if (existingMember) {
        return { error: `Biometric ID ${bioGents} is already assigned to Gents member ${existingMember.full_name}.` };
      }
    }

    // Check biometric_ladies_id uniqueness across staff and Ladies members
    if (values.biometric_ladies_id) {
      const bioLadies = values.biometric_ladies_id;
      if (!/^\d+$/.test(bioLadies)) {
        return { error: "Biometric Ladies ID must contain numeric digits only" };
      }
      const { data: existingStaff } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('biometric_ladies_id', bioLadies)
        .maybeSingle();
      if (existingStaff) {
        return { error: `Biometric Ladies ID ${bioLadies} is already assigned to staff member ${existingStaff.full_name}.` };
      }
      const { data: existingMember } = await supabase
        .from('members')
        .select('id, full_name')
        .eq('biometric_user_id', bioLadies)
        .eq('machine_type', 'Ladies')
        .maybeSingle();
      if (existingMember) {
        return { error: `Biometric ID ${bioLadies} is already assigned to Ladies member ${existingMember.full_name}.` };
      }
    }

    // Build insert payload — strip empty strings to null for optional fields
    const payload: Record<string, unknown> = {
      full_name: values.full_name,
      role: values.role,
      phone: values.phone,
      status: values.status,
      joining_date: values.joining_date,
      employee_id: values.employee_id || '',   // trigger will fill if empty
    };

    const optionalText = ['gender', 'dob', 'email', 'address', 'emergency_contact',
      'profile_photo', 'shift', 'specialization', 'certifications',
      'cleaning_area', 'working_shift', 'notes', 'biometric_gents_id', 'biometric_ladies_id'] as const;

    for (const key of optionalText) {
      const val = (values as Record<string, unknown>)[key];
      payload[key] = val === '' ? null : val ?? null;
    }

    const optionalNum = ['salary', 'experience'] as const;
    for (const key of optionalNum) {
      const val = (values as Record<string, unknown>)[key];
      payload[key] = val === '' || val === undefined ? null : Number(val);
    }

    const { data, error } = await supabase
      .from('staff')
      .insert([payload])
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(
      `Created staff: ${data.full_name} (${data.employee_id}, ${data.role})`,
      'Staff',
      user.id
    );

    revalidatePath('/');
    revalidatePath('/staff');
    return { data: data as Staff };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create staff member';
    return { error: msg };
  }
}

// ── Update staff member ────────────────────────────────────────────────────────
export async function updateStaff(
  id: string,
  values: Partial<StaffFormValues>
): Promise<{ data?: Staff; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    // Check biometric_gents_id uniqueness across staff and Gents members on update
    if (values.biometric_gents_id !== undefined) {
      const bioGents = values.biometric_gents_id;
      if (bioGents && !/^\d+$/.test(bioGents)) {
        return { error: "Biometric Gents ID must contain numeric digits only" };
      }
      if (bioGents) {
        const { data: existingStaff } = await supabase
          .from('staff')
          .select('id, full_name')
          .eq('biometric_gents_id', bioGents)
          .maybeSingle();
        if (existingStaff && existingStaff.id !== id) {
          return { error: `Biometric Gents ID ${bioGents} is already assigned to staff member ${existingStaff.full_name}.` };
        }
        const { data: existingMember } = await supabase
          .from('members')
          .select('id, full_name')
          .eq('biometric_user_id', bioGents)
          .eq('machine_type', 'Gents')
          .maybeSingle();
        if (existingMember) {
          return { error: `Biometric ID ${bioGents} is already assigned to Gents member ${existingMember.full_name}.` };
        }
      }
    }

    // Check biometric_ladies_id uniqueness across staff and Ladies members on update
    if (values.biometric_ladies_id !== undefined) {
      const bioLadies = values.biometric_ladies_id;
      if (bioLadies && !/^\d+$/.test(bioLadies)) {
        return { error: "Biometric Ladies ID must contain numeric digits only" };
      }
      if (bioLadies) {
        const { data: existingStaff } = await supabase
          .from('staff')
          .select('id, full_name')
          .eq('biometric_ladies_id', bioLadies)
          .maybeSingle();
        if (existingStaff && existingStaff.id !== id) {
          return { error: `Biometric Ladies ID ${bioLadies} is already assigned to staff member ${existingStaff.full_name}.` };
        }
        const { data: existingMember } = await supabase
          .from('members')
          .select('id, full_name')
          .eq('biometric_user_id', bioLadies)
          .eq('machine_type', 'Ladies')
          .maybeSingle();
        if (existingMember) {
          return { error: `Biometric ID ${bioLadies} is already assigned to Ladies member ${existingMember.full_name}.` };
        }
      }
    }

    const payload: Record<string, unknown> = {};

    const textFields = ['full_name', 'role', 'gender', 'dob', 'phone', 'email', 'address',
      'emergency_contact', 'profile_photo', 'employee_id', 'joining_date', 'shift',
      'status', 'specialization', 'certifications', 'cleaning_area', 'working_shift', 'notes', 'biometric_gents_id', 'biometric_ladies_id'];

    for (const key of textFields) {
      if (key in values) {
        const val = (values as Record<string, unknown>)[key];
        payload[key] = val === '' ? null : val ?? null;
      }
    }

    const numFields = ['salary', 'experience'];
    for (const key of numFields) {
      if (key in values) {
        const val = (values as Record<string, unknown>)[key];
        payload[key] = val === '' || val === undefined ? null : Number(val);
      }
    }

    const { data, error } = await supabase
      .from('staff')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) return { error: error.message };

    await logAudit(
      `Updated staff: ${data.full_name} (${data.employee_id})`,
      'Staff',
      user.id
    );

    revalidatePath('/');
    revalidatePath('/staff');
    revalidatePath(`/staff/${id}`);
    return { data: data as Staff };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update staff member';
    return { error: msg };
  }
}

// ── Delete staff member ────────────────────────────────────────────────────────
export async function deleteStaff(id: string): Promise<{ error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const supabase = await createClient();

    const { data: existing } = await supabase
      .from('staff')
      .select('full_name, employee_id')
      .eq('id', id)
      .single();

    const { error } = await supabase.from('staff').delete().eq('id', id);
    if (error) return { error: error.message };

    if (existing) {
      await logAudit(
        `Deleted staff: ${existing.full_name} (${existing.employee_id})`,
        'Staff',
        user.id
      );
    }

    revalidatePath('/');
    revalidatePath('/staff');
    return {};
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to delete staff member';
    return { error: msg };
  }
}

// ── Get staff stats for dashboard ─────────────────────────────────────────────
export async function getStaffStats(): Promise<{
  total: number;
  trainers: number;
  janitors: number;
  active: number;
}> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from('staff').select('role, status');
    if (error) return { total: 0, trainers: 0, janitors: 0, active: 0 };
    const staff = data || [];
    return {
      total: staff.length,
      trainers: staff.filter((s: { role: string }) => s.role === 'Trainer').length,
      janitors: staff.filter((s: { role: string }) => s.role === 'Janitor').length,
      active: staff.filter((s: { status: string }) => s.status === 'Active').length,
    };
  } catch {
    return { total: 0, trainers: 0, janitors: 0, active: 0 };
  }
}
