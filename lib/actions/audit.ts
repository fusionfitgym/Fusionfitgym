"use server";

import { createClient } from '@/lib/supabase/server';

export async function logAudit(action: string, module: string, overrideUserId?: string) {
  try {
    const supabase = await createClient();
    let userId = overrideUserId;

    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id;
    }

    const { error } = await supabase.from('audit_logs').insert([
      {
        user_id: userId || null,
        action,
        module,
      },
    ]);
    if (error) {
      console.error('Database error writing audit log:', error);
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
