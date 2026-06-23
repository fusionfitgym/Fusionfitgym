"use server";

import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { logAudit } from './audit';

// Helper to create Supabase client using Service Role key for administrative tasks
function getAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is missing in environmental variables. Please configure it in .env.local.');
  }
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// Check if current user is Super Admin
async function enforceSuperAdmin() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthenticated');

  const { data: profile } = await supabase
    .from('users_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile || profile.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admins can execute this action.');
  }
  return user.id;
}

export async function listProfiles() {
  try {
    await enforceSuperAdmin();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('users_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return { error: error.message };
    return { data };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function adminCreateUser(values: {
  email: string;
  password?: string;
  fullName: string;
  phone?: string;
  role: string;
  status: 'Active' | 'Suspended';
  notes?: string;
}) {
  try {
    const adminId = await enforceSuperAdmin();
    const admin = getAdminClient();

    // Create auth account
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: values.email,
      password: values.password || 'password123', // Default temporary password if none provided
      email_confirm: true,
      user_metadata: {
        full_name: values.fullName,
        role: values.role,
        phone: values.phone || '',
        status: values.status,
        notes: values.notes || '',
      },
    });

    if (authError) return { error: authError.message };

    // The database trigger 'on_auth_user_created' will auto-insert into 'users_profiles'.
    // However, we explicitly update the profile to ensure all our custom fields are saved immediately.
    const supabase = await createServerClient();
    const { error: profileError } = await supabase
      .from('users_profiles')
      .update({
        full_name: values.fullName,
        phone: values.phone || '',
        role: values.role,
        status: values.status,
        notes: values.notes || '',
      })
      .eq('auth_user_id', authData.user.id);

    if (profileError) {
      console.error('Error updating users_profiles on creation:', profileError);
    }

    await logAudit(`Created user account: ${values.email} as ${values.role}`, 'Users', adminId);
    return { data: authData.user };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function adminUpdateUser(values: {
  id: string; // users_profiles.id
  authUserId: string;
  fullName: string;
  phone?: string;
  role: string;
  status: 'Active' | 'Suspended';
  notes?: string;
  userEmail: string;
}) {
  try {
    const adminId = await enforceSuperAdmin();
    
    if (values.authUserId === adminId && values.status === 'Suspended') {
      return { error: 'You cannot suspend your own administrator account.' };
    }

    const supabase = await createServerClient();
    
    // 1. Update public profile
    const { error: profileError } = await supabase
      .from('users_profiles')
      .update({
        full_name: values.fullName,
        phone: values.phone || '',
        role: values.role,
        status: values.status,
        notes: values.notes || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', values.id);

    if (profileError) return { error: profileError.message };

    // 2. Update auth metadata via admin client to keep it in sync
    try {
      const admin = getAdminClient();
      const { error: authError } = await admin.auth.admin.updateUserById(values.authUserId, {
        user_metadata: {
          full_name: values.fullName,
          role: values.role,
          phone: values.phone || '',
          status: values.status,
          notes: values.notes || '',
        }
      });

      if (authError) {
        console.error('Failed to update auth metadata for user:', authError);
      }
    } catch (err) {
      console.error('Error contacting Admin API for metadata sync:', err);
    }

    await logAudit(`Updated user profile: ${values.userEmail}`, 'Users', adminId);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function adminToggleUserDisabled(profileId: string, disabled: boolean, userEmail: string) {
  try {
    const adminId = await enforceSuperAdmin();
    const supabase = await createServerClient();

    const targetStatus = disabled ? 'Suspended' : 'Active';

    // Find the auth user id for self-suspension protection
    const { data: profile } = await supabase
      .from('users_profiles')
      .select('auth_user_id')
      .eq('id', profileId)
      .single();

    if (profile && profile.auth_user_id === adminId && targetStatus === 'Suspended') {
      return { error: 'You cannot suspend your own administrator account.' };
    }

    const { error } = await supabase
      .from('users_profiles')
      .update({ status: targetStatus })
      .eq('id', profileId);

    if (error) return { error: error.message };

    await logAudit(`Changed account status to ${targetStatus} for user: ${userEmail}`, 'Users', adminId);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function adminResetUserPassword(authUserId: string, newPassword: string, userEmail: string) {
  try {
    const adminId = await enforceSuperAdmin();
    const admin = getAdminClient();

    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password: newPassword,
    });

    if (error) return { error: error.message };

    await logAudit(`Admin reset password for user: ${userEmail}`, 'Users', adminId);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function adminDeleteUser(authUserId: string, userEmail: string) {
  try {
    const adminId = await enforceSuperAdmin();
    if (authUserId === adminId) {
      return { error: 'You cannot delete your own administrator account.' };
    }
    const admin = getAdminClient();

    // Deleting user in auth.users deletes user_profile because of ON DELETE CASCADE
    const { error } = await admin.auth.admin.deleteUser(authUserId);

    if (error) return { error: error.message };

    await logAudit(`Deleted user account: ${userEmail}`, 'Users', adminId);
    return { success: true };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}

export async function listAuditLogs() {
  try {
    await enforceSuperAdmin();
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        module,
        created_at,
        user_id,
        users_profiles!audit_logs_user_id_fkey(full_name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.warn('Direct join on audit_logs and users_profiles failed, returning fallback audit log data:', error.message);
      // Fallback if relation schema isn't set up yet or fails
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (fallbackError) return { error: fallbackError.message };
      return { data: fallbackData };
    }

    return { data };
  } catch (err: any) {
    return { error: err.message || 'An unexpected error occurred.' };
  }
}
