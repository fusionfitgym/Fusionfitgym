"use server";

import { revalidatePath } from 'next/cache';
import { validateRole } from './auth';
import { logAudit } from './audit';
import { runBackup, runRestore, getProgress, BackupProgress } from '@/lib/backup-service';
import { createAdminClient } from '@/lib/supabase/admin';

export interface BackupHistoryItem {
  id: string;
  filename: string;
  status: 'Success' | 'Failed' | 'In Progress';
  size_bytes: number;
  records_count: number;
  error_message: string | null;
  created_at: string;
  duration_ms: number;
}

export interface BackupSettings {
  backup_schedule_time: string;
  backup_enabled: boolean;
  backup_last_successful_run: string | null;
}

// 1. Gated Server Action to manually trigger backup
export async function triggerBackupAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    
    // Check if another backup is already running
    const progress = await getProgress();
    if (progress.status === 'running' || progress.status === 'restoring') {
      return { success: false, error: 'A backup or restore operation is already in progress.' };
    }

    await logAudit('Manually triggered backup', 'Backup', user.id);
    
    // We execute the backup in the background
    // To allow the action to return immediately and run in background:
    // We run it asynchronously without awaiting
    runBackup(true).catch(err => {
      console.error('Manual background backup task failed:', err);
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unauthorized' };
  }
}

// 2. Gated Server Action to restore from a backup
export async function restoreFromBackupAction(backupPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);

    const progress = await getProgress();
    if (progress.status === 'running' || progress.status === 'restoring') {
      return { success: false, error: 'A backup or restore operation is already in progress.' };
    }

    await logAudit(`Triggered database restore from backup: ${backupPath}`, 'Backup', user.id);

    // Run restore asynchronously in background so client doesn't time out
    runRestore(backupPath).catch(err => {
      console.error('Background restore task failed:', err);
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unauthorized' };
  }
}

// 3. Action to get current backup/restore progress status
export async function getBackupProgressAction(): Promise<BackupProgress> {
  try {
    await validateRole(['Super Admin', 'Admin']);
    return await getProgress();
  } catch (err) {
    return {
      status: 'idle',
      step: 'idle',
      progress: 0,
      error: null,
      lastUpdated: new Date().toISOString()
    };
  }
}

// 4. Action to get backup history logs
export async function getBackupHistoryAction(): Promise<BackupHistoryItem[]> {
  try {
    await validateRole(['Super Admin', 'Admin']);
    const adminClient = createAdminClient();

    // Try reading from backup_history table first
    const { data: dbHistory, error } = await adminClient
      .from('backup_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && dbHistory) {
      return dbHistory as BackupHistoryItem[];
    }
  } catch (err) {
    console.warn('Could not read backup_history table, checking settings log fallback...', err);
  }

  // Fallback settings read
  try {
    const adminClient = createAdminClient();
    const { data } = await adminClient
      .from('settings')
      .select('value')
      .eq('key', 'backup_history_json')
      .maybeSingle();

    if (data?.value) {
      return JSON.parse(data.value);
    }
  } catch (err) {
    console.error('Failed to read settings fallback backup history:', err);
  }

  return [];
}

// 5. Action to retrieve scheduler settings
export async function getBackupSettingsAction(): Promise<BackupSettings> {
  try {
    await validateRole(['Super Admin', 'Admin']);
    const adminClient = createAdminClient();

    const { data } = await adminClient
      .from('settings')
      .select('key, value')
      .in('key', ['backup_schedule_time', 'backup_enabled', 'backup_last_successful_run']);

    const map: Record<string, string> = {};
    data?.forEach(row => { map[row.key] = row.value; });

    return {
      backup_schedule_time: map.backup_schedule_time ?? '02:00',
      backup_enabled: map.backup_enabled !== 'false',
      backup_last_successful_run: map.backup_last_successful_run ?? null
    };
  } catch (err) {
    return {
      backup_schedule_time: '02:00',
      backup_enabled: true,
      backup_last_successful_run: null
    };
  }
}

// 6. Action to update backup scheduler settings
export async function updateBackupSettingsAction(values: {
  scheduleTime: string;
  enabled: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const adminClient = createAdminClient();

    const rows = [
      { key: 'backup_schedule_time', value: values.scheduleTime },
      { key: 'backup_enabled', value: String(values.enabled) }
    ];

    const { error } = await adminClient.from('settings').upsert(rows, { onConflict: 'key' });
    if (error) throw error;

    await logAudit(`Updated backup settings: Schedule=${values.scheduleTime}, Enabled=${values.enabled}`, 'Settings', user.id);
    revalidatePath('/backup');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update settings' };
  }
}

// 7. Gated Server Action to delete a backup
export async function deleteBackupAction(backupPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { user } = await validateRole(['Super Admin', 'Admin']);
    const adminClient = createAdminClient();

    // Delete from storage
    const { error: storageError } = await adminClient.storage.from('backups').remove([backupPath]);
    if (storageError) {
      return { success: false, error: `Storage delete failed: ${storageError.message}` };
    }

    // Attempt to update DB record status to Deleted or remove it from logs
    const filename = backupPath.split('/').pop() || '';
    try {
      await adminClient
        .from('backup_history')
        .delete()
        .eq('filename', filename);
    } catch {}

    // Try fallback logs removal
    try {
      const { data } = await adminClient
        .from('settings')
        .select('value')
        .eq('key', 'backup_history_json')
        .maybeSingle();

      if (data?.value) {
        let logs: any[] = JSON.parse(data.value);
        logs = logs.filter(log => log.filename !== filename);
        await adminClient
          .from('settings')
          .upsert({ key: 'backup_history_json', value: JSON.stringify(logs) }, { onConflict: 'key' });
      }
    } catch {}

    await logAudit(`Deleted backup file: ${backupPath}`, 'Backup', user.id);
    revalidatePath('/backup');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Unauthorized' };
  }
}
