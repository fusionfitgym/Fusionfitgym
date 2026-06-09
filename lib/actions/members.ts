import { supabase } from '@/lib/supabase';
import { Member, MemberFormValues } from '@/types';

export async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Member[];
}

export async function getMemberById(id: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Member;
}

export async function createMember(values: MemberFormValues): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert([values])
    .select()
    .single();
  if (error) throw error;
  return data as Member;
}

export async function updateMember(id: string, values: Partial<MemberFormValues>): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .update(values)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Member;
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from('members').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadProfilePhoto(file: File): Promise<string> {
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
