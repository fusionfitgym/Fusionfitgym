"use server";

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { logAudit } from './audit';
import { verifySession, signSession } from '@/lib/session-cache';

export async function getCurrentUserProfile() {
  const supabase = await createClient();
  
  // Safe way to retrieve the authenticated user
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) return null;

  // Retrieve cached user_profile details if present and valid
  const cookieStore = await cookies();
  const cachedSessionVal = cookieStore.get('fusionfit-session')?.value;
  const cachedProfile = cachedSessionVal ? await verifySession(cachedSessionVal, user.id) : null;

  if (cachedProfile) {
    const profile = {
      id: cachedProfile.id,
      auth_user_id: user.id,
      full_name: cachedProfile.fullName,
      email: user.email || '',
      role: cachedProfile.role,
      status: cachedProfile.status,
      created_at: '',
    };
    return { user, profile };
  }

  // Retrieve their user_profile role from the database
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('id, role, status, full_name')
    .eq('auth_user_id', user.id)
    .single();

  if (profileError || !profile) return null;

  // Set the cryptographic cache cookie for subsequent loads (valid for 5 mins)
  const sessionVal = await signSession({
    id: profile.id,
    role: profile.role as any,
    status: profile.status as any,
    fullName: profile.full_name || '',
    userId: user.id
  });
  
  try {
    cookieStore.set('fusionfit-session', sessionVal, {
      maxAge: 5 * 60,
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
  } catch (cookieError) {
    // Safely ignore when called during rendering (where writing cookies is not allowed)
    console.warn("Could not set session cache cookie during layout/page render:", cookieError);
  }

  const fullProfile = {
    ...profile,
    auth_user_id: user.id,
    email: user.email || '',
    created_at: '',
  };

  return { user, profile: fullProfile };
}

export interface SignInState {
  error?: string;
  success?: boolean;
}

export async function signInAction(prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const rememberMe = formData.get('rememberMe') === 'true';

  if (!email || !password) {
    return { error: 'Email and password are required.' };
  }

  const supabase = await createClient();

  // 1. Rate Limiting Login Check (Max 5 attempts in the last 15 minutes)
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { count, error: countError } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('action', `Login Failed: ${email}`)
    .gte('created_at', fifteenMinutesAgo);

  if (!countError && count !== null && count >= 5) {
    return { error: 'Too many login attempts. This email is locked for 15 minutes. Please try again later.' };
  }

  // 2. Manage Remember Me Cookie
  const cookieStore = await cookies();
  if (rememberMe) {
    cookieStore.set('remember_me', 'true', { maxAge: 60 * 60 * 24 * 7, path: '/' });
  } else {
    cookieStore.set('remember_me', 'false', { path: '/' });
  }

  // 3. Attempt Authentication
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    await logAudit(`Login Failed: ${email}`, 'Auth');
    return { error: error.message };
  }

  // 4. Validate Account Status (Suspended Check)
  const { data: profile, error: profileError } = await supabase
    .from('users_profiles')
    .select('*')
    .eq('auth_user_id', data.user.id)
    .single();

  if (profileError || !profile) {
    await supabase.auth.signOut();
    await logAudit(`Login Failed (No profile): ${email}`, 'Auth');
    return { error: 'No profile associated with this account.' };
  }

  if (profile.status === 'Suspended') {
    await supabase.auth.signOut();
    await logAudit(`Login Attempt on Suspended Account: ${email}`, 'Auth');
    return { error: 'Your account has been suspended. Please contact the administrator.' };
  }

  // 5. Audit Logging & Session confirmation
  await logAudit(`Login Success: ${email}`, 'Auth', data.user.id);
  return { success: true };
}

export async function signOutAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    await logAudit(`Logout Success`, 'Auth', user.id);
  }
  
  await supabase.auth.signOut();
}

export async function resetPasswordForEmailAction(email: string, redirectTo: string) {
  if (!email) throw new Error('Email is required');
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
  await logAudit(`Password Reset Requested for: ${email}`, 'Auth');
}

export async function updatePasswordAction(password: string) {
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters');
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
  await logAudit('Password Reset Success', 'Auth');
}

export async function validateRole(allowedRoles: string[]) {
  const result = await getCurrentUserProfile();
  if (!result || !result.profile) {
    throw new Error('Unauthenticated. Please log in.');
  }
  if (result.profile.status === 'Suspended') {
    throw new Error('Unauthorized. Your account has been suspended.');
  }
  if (!allowedRoles.includes(result.profile.role)) {
    throw new Error('Unauthorized. You do not have permission for this action.');
  }
  return result;
}
