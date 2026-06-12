"use server";

import { createClient } from '@/lib/supabase/server';
import { HealthAssessment, HealthFormValues } from '@/types';
import { calculateBMI } from '@/lib/utils';

export async function getHealthAssessments(): Promise<HealthAssessment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_assessments')
    .select('*, member:members(full_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as HealthAssessment[];
}

export async function getHealthByMember(memberId: string): Promise<HealthAssessment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_assessments')
    .select('*')
    .eq('member_id', memberId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as HealthAssessment[];
}

export async function getHealthById(id: string): Promise<HealthAssessment | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('health_assessments')
    .select('*, member:members(full_name)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as HealthAssessment;
}

export async function createHealthAssessment(values: HealthFormValues): Promise<HealthAssessment> {
  const supabase = await createClient();
  let bmi: number | undefined;
  if (values.height && values.weight) {
    bmi = calculateBMI(values.weight, values.height);
  }

  const { data, error } = await supabase
    .from('health_assessments')
    .insert([{ ...values, bmi }])
    .select()
    .single();
  if (error) throw error;
  return data as HealthAssessment;
}
