import { supabase } from '@/lib/supabase';
import { ParqResponse, ParqFormValues } from '@/types';

export async function getParqResponses(): Promise<ParqResponse[]> {
  const { data, error } = await supabase
    .from('parq_responses')
    .select('*, member:members(full_name, phone)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ParqResponse[];
}

export async function getParqByMember(memberId: string): Promise<ParqResponse[]> {
  const { data, error } = await supabase
    .from('parq_responses')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as ParqResponse[];
}

export async function getParqById(id: string): Promise<ParqResponse | null> {
  const { data, error } = await supabase
    .from('parq_responses')
    .select('*, member:members(full_name, phone)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as ParqResponse;
}

export async function createParqResponse(values: ParqFormValues): Promise<ParqResponse> {
  const { member_id, notes, ...questionAnswers } = values;
  const answers: Record<string, string> = {};
  Object.entries(questionAnswers).forEach(([k, v]) => {
    answers[k] = v as string;
  });

  const { data, error } = await supabase
    .from('parq_responses')
    .insert([{ member_id, answers, notes }])
    .select()
    .single();
  if (error) throw error;
  return data as ParqResponse;
}
