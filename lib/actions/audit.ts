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

    // Opportunistic cleanup: ~2% of the time, delete logs older than 5 days.
    // This acts as a fallback in case pg_cron is not available.
    if (Math.random() < 0.02) {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const { error: cleanupError } = await supabase
        .from('audit_logs')
        .delete()
        .lt('created_at', fiveDaysAgo);
      if (cleanupError) {
        console.error('Opportunistic audit log cleanup failed:', cleanupError);
      }
    }
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

/**
 * Manually delete audit logs older than 5 days.
 * Can be called from an API route or admin action.
 */
export async function cleanupOldAuditLogs(): Promise<{ deleted: boolean; error?: string }> {
  try {
    const supabase = await createClient();
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from('audit_logs')
      .delete()
      .lt('created_at', fiveDaysAgo);
    if (error) {
      return { deleted: false, error: error.message };
    }
    return { deleted: true };
  } catch (err: any) {
    return { deleted: false, error: err.message || 'Unknown error' };
  }
}
