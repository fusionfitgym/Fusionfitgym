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
    .from('user_profiles')
    .select('role')
    .eq('auth_user_id', user.id)
    .single();

  if (!profile || profile.role !== 'Super Admin') {
    throw new Error('Forbidden: Only Super Admins can execute this action.');
  }
  return user.id;
}

export async function listProfiles() {
  await enforceSuperAdmin();
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
}

export async function adminCreateUser(values: { email: string; password?: string; fullName: string; role: string }) {
  const adminId = await enforceSuperAdmin();
  const admin = getAdminClient();

  // Create auth account
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.password || 'password123', // Default password if none provided
    email_confirm: true,
    user_metadata: {
      full_name: values.fullName,
      role: values.role,
    },
  });

  if (authError) throw authError;

  await logAudit(`Created user account: ${values.email} as ${values.role}`, 'Users', adminId);
  return authData.user;
}

export async function adminToggleUserDisabled(profileId: string, disabled: boolean, userEmail: string) {
  const adminId = await enforceSuperAdmin();
  const supabase = await createServerClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ disabled })
    .eq('id', profileId);

  if (error) throw error;

  await logAudit(`${disabled ? 'Disabled' : 'Enabled'} user account: ${userEmail}`, 'Users', adminId);
}

export async function adminResetUserPassword(authUserId: string, newPassword: string, userEmail: string) {
  const adminId = await enforceSuperAdmin();
  const admin = getAdminClient();

  const { error } = await admin.auth.admin.updateUserById(authUserId, {
    password: newPassword,
  });

  if (error) throw error;

  await logAudit(`Admin reset password for user: ${userEmail}`, 'Users', adminId);
}

export async function adminDeleteUser(authUserId: string, userEmail: string) {
  const adminId = await enforceSuperAdmin();
  const admin = getAdminClient();

  // Deleting user in auth.users deletes user_profile because of ON DELETE CASCADE
  const { error } = await admin.auth.admin.deleteUser(authUserId);

  if (error) throw error;

  await logAudit(`Deleted user account: ${userEmail}`, 'Users', adminId);
}

export async function listAuditLogs() {
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
      user_profiles!audit_logs_user_id_fkey(full_name, email)
    `)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    // Fallback if relation schema isn't set up yet or fails
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (fallbackError) throw fallbackError;
    return fallbackData;
  }

  return data;
}
