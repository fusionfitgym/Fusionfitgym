'use client';

import { useEffect, useState } from 'react';
import {
  Database,
  Calendar,
  HardDrive,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  Trash2,
  RefreshCw,
  Play,
  Clock,
  Save,
  Loader2,
  ListTodo
} from 'lucide-react';
import {
  PageHeader,
  SectionCard,
  FormField,
  FormActions,
  LoadingSpinner
} from '@/components/ui/Primitives';
import {
  triggerBackupAction,
  restoreFromBackupAction,
  getBackupProgressAction,
  getBackupHistoryAction,
  getBackupSettingsAction,
  updateBackupSettingsAction,
  deleteBackupAction,
  BackupHistoryItem,
  BackupSettings
} from '@/lib/actions/backup';
import { BackupProgress } from '@/lib/backup-service';
import { toast } from 'sonner';

export default function BackupPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<BackupHistoryItem[]>([]);
  const [settings, setSettings] = useState<BackupSettings>({
    backup_schedule_time: '02:00',
    backup_enabled: true,
    backup_last_successful_run: null
  });
  const [progress, setProgress] = useState<BackupProgress>({
    status: 'idle',
    step: 'idle',
    progress: 0,
    error: null,
    lastUpdated: new Date().toISOString()
  });

  // Action states
  const [savingSettings, setSavingSettings] = useState(false);
  const [triggeringBackup, setTriggeringBackup] = useState(false);
  const [deletingPath, setDeletingPath] = useState<string | null>(null);
  
  // Restore Modal State
  const [restoreItem, setRestoreItem] = useState<BackupHistoryItem | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);

  // Form states for schedule settings
  const [scheduleTime, setScheduleTime] = useState('02:00');
  const [backupEnabled, setBackupEnabled] = useState(true);

  // Fetch initial data
  const loadData = async () => {
    try {
      const [hist, sett, prog] = await Promise.all([
        getBackupHistoryAction(),
        getBackupSettingsAction(),
        getBackupProgressAction()
      ]);
      setHistory(hist);
      setSettings(sett);
      setScheduleTime(sett.backup_schedule_time);
      setBackupEnabled(sett.backup_enabled);
      setProgress(prog);
    } catch (err) {
      toast.error('Failed to load backup data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Poll progress if a task is running or restoring
  useEffect(() => {
    if (progress.status === 'running' || progress.status === 'restoring') {
      const interval = setInterval(async () => {
        const currentProg = await getBackupProgressAction();
        setProgress(currentProg);
        
        // Stop polling if complete/failed, and reload tables
        if (currentProg.status === 'completed') {
          clearInterval(interval);
          toast.success(currentProg.step === 'idle' ? 'Operation completed successfully!' : 'Task finished.');
          loadData();
        } else if (currentProg.status === 'failed') {
          clearInterval(interval);
          toast.error(`Operation failed: ${currentProg.error || 'Unknown error'}`);
          loadData();
        }
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [progress.status]);

  // Handle manual backup trigger
  const handleTriggerBackup = async () => {
    setTriggeringBackup(true);
    try {
      const res = await triggerBackupAction();
      if (res.success) {
        toast.info('Backup process started in the background.');
        // Set state to running immediately to activate polling
        setProgress({
          status: 'running',
          step: 'database_export',
          progress: 5,
          error: null,
          lastUpdated: new Date().toISOString()
        });
      } else {
        toast.error(res.error || 'Failed to start backup');
      }
    } catch (err: any) {
      toast.error(err.message || 'An unexpected error occurred');
    } finally {
      setTriggeringBackup(false);
    }
  };

  // Handle save schedule settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await updateBackupSettingsAction({
        scheduleTime,
        enabled: backupEnabled
      });
      if (res.success) {
        toast.success('Backup schedule configuration updated!');
        setSettings(prev => ({
          ...prev,
          backup_schedule_time: scheduleTime,
          backup_enabled: backupEnabled
        }));
      } else {
        toast.error(res.error || 'Failed to update schedule');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update settings');
    } finally {
      setSavingSettings(false);
    }
  };

  // Handle delete backup log/file
  const handleDeleteBackup = async (filename: string, createdAt: string) => {
    const formattedDate = new Date(createdAt).toLocaleDateString();
    if (!confirm(`Are you sure you want to permanently delete the backup from ${formattedDate}?`)) return;

    // Build the expected path based on backup timestamp name
    // Format: gym_backup_YYYY-MM-DD_HHMM.zip
    // Parse path: Year / Month / Filename
    const match = filename.match(/gym_backup_(\d{4})-(\d{2})-\d{2}_\d{4}\.zip/);
    if (!match) {
      toast.error('Invalid backup filename format');
      return;
    }
    const year = match[1];
    const month = match[2];
    const backupPath = `${year}/${month}/${filename}`;

    setDeletingPath(filename);
    try {
      const res = await deleteBackupAction(backupPath);
      if (res.success) {
        toast.success('Backup deleted successfully.');
        setHistory(prev => prev.filter(item => item.filename !== filename));
      } else {
        toast.error(res.error || 'Failed to delete backup');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting backup');
    } finally {
      setDeletingPath(null);
    }
  };

  // Handle restore action
  const handleRestoreSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreItem) return;

    if (confirmText.toUpperCase() !== 'RESTORE') {
      toast.error('Please type "RESTORE" to confirm database overwrite.');
      return;
    }

    const filename = restoreItem.filename;
    const match = filename.match(/gym_backup_(\d{4})-(\d{2})-\d{2}_\d{4}\.zip/);
    if (!match) {
      toast.error('Invalid backup file name structure');
      return;
    }
    const year = match[1];
    const month = match[2];
    const backupPath = `${year}/${month}/${filename}`;

    setRestoring(true);
    try {
      const res = await restoreFromBackupAction(backupPath);
      if (res.success) {
        toast.info('Restore process initiated. The system is rebuilding in the background.');
        setRestoreItem(null);
        setConfirmText('');
        // Set state to restoring immediately to activate polling
        setProgress({
          status: 'restoring',
          step: 'restoring_db',
          progress: 5,
          error: null,
          lastUpdated: new Date().toISOString()
        });
      } else {
        toast.error(res.error || 'Failed to initiate restore');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error restoring database');
    } finally {
      setRestoring(false);
    }
  };

  // Helper bytes formats
  const formatBytes = (bytes: number, decimals = 2) => {
    if (!bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Helper date formats
  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return 'Never';
    return new Date(isoString).toLocaleString();
  };

  // Calculate Next Scheduled Backup (Timezone offset matching user)
  const getNextScheduledBackup = (schedTime: string) => {
    if (!settings.backup_enabled) return 'Disabled';
    const now = new Date();
    // Offset IST is +5.5 hours
    const istTime = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    
    const [hourStr, minStr] = schedTime.split(':');
    const schedHour = parseInt(hourStr || '2', 10);
    const schedMin = parseInt(minStr || '0', 10);
    
    const nextScheduled = new Date(istTime.getTime());
    nextScheduled.setUTCHours(schedHour, schedMin, 0, 0);
    
    if (istTime.getUTCHours() > schedHour || (istTime.getUTCHours() === schedHour && istTime.getUTCMinutes() >= schedMin)) {
      nextScheduled.setUTCDate(nextScheduled.getUTCDate() + 1);
    }
    
    const nextScheduledUTC = new Date(nextScheduled.getTime() - (5.5 * 60 * 60 * 1000));
    return nextScheduledUTC.toLocaleString();
  };

  // Calculate total space used in MB
  const totalStorageUsed = history
    .filter(item => item.status === 'Success')
    .reduce((acc, item) => acc + item.size_bytes, 0);

  const isExecuting = progress.status === 'running' || progress.status === 'restoring';

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-medium page-enter">
      <PageHeader
        title="Backup Management"
        subtitle="Secure cloud data backup and restore controls for your business."
        action={
          <button
            type="button"
            onClick={handleTriggerBackup}
            disabled={isExecuting || triggeringBackup}
            className="flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2 text-xs font-bold text-zinc-950 shadow-sm transition hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-600"
          >
            {triggeringBackup || (progress.status === 'running' && triggeringBackup) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Backup Now
          </button>
        }
      />

      <div className="page-stack">
        {/* Live Progress Bar Container */}
        {isExecuting && (
          <section className="card p-4 sm:p-6 border border-amber-300/30 bg-amber-400/[0.02] shadow-[0_4px_20px_rgba(244,196,48,0.05)] rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400/20">
              <div
                className="h-full bg-amber-300 transition-all duration-500 animate-pulse"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white capitalize">
                      {progress.status === 'restoring' ? 'Restoring System State' : 'Running Automated Backup'}
                    </h3>
                    <p className="text-xs text-zinc-400">
                      Step: {progress.step.replace('_', ' ')}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-extrabold text-amber-300">{progress.progress}%</span>
              </div>

              <div className="w-full bg-zinc-800 rounded-full h-2">
                <div
                  className="bg-amber-300 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 italic">
                Please do not close this window or navigate away while the operation is writing database transactions.
              </p>
            </div>
          </section>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="card p-4 flex items-center gap-4 bg-zinc-950/20 border border-white/[0.05]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Last Run Status</p>
              <p className="truncate text-[13px] font-bold text-white mt-0.5">
                {settings.backup_last_successful_run ? 'Successful' : 'No Backups Yet'}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                {settings.backup_last_successful_run ? new Date(settings.backup_last_successful_run).toLocaleDateString() : 'Never'}
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4 bg-zinc-950/20 border border-white/[0.05]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <Clock className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Next Auto Backup</p>
              <p className="truncate text-[13px] font-bold text-white mt-0.5">
                {settings.backup_enabled ? settings.backup_schedule_time : 'Disabled'}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                {getNextScheduledBackup(settings.backup_schedule_time)}
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4 bg-zinc-950/20 border border-white/[0.05]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <HardDrive className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Storage Used</p>
              <p className="truncate text-base font-bold text-white mt-0.5">
                {formatBytes(totalStorageUsed)}
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                Secure Cloud Storage
              </p>
            </div>
          </div>

          <div className="card p-4 flex items-center gap-4 bg-zinc-950/20 border border-white/[0.05]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <Database className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Total Daily Backups</p>
              <p className="truncate text-base font-bold text-white mt-0.5">
                {history.filter(item => item.status === 'Success').length} Backups
              </p>
              <p className="text-[10px] text-zinc-400 mt-0.5 truncate">
                Limit: 30 Daily logs
              </p>
            </div>
          </div>
        </div>

        {/* Configuration settings & details */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Settings Box */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSaveSettings} className="h-full">
              <SectionCard
                title="Schedule Settings"
                description="Configure scheduled background daily backup runs."
                icon={<Calendar className="h-5 w-5" />}
              >
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between rounded-xl bg-zinc-900/40 border border-white/[0.03] p-3.5">
                    <div>
                      <p className="text-xs font-bold text-white">Enable Auto Backups</p>
                      <p className="text-[11px] text-zinc-500">Zero-click backup trigger every day</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={backupEnabled}
                        disabled={isExecuting}
                        onChange={(e) => setBackupEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-300" />
                    </label>
                  </div>

                  <FormField label="Backup Run Time (IST)">
                    <div className="relative">
                      <input
                        type="time"
                        value={scheduleTime}
                        disabled={isExecuting || !backupEnabled}
                        onChange={(e) => setScheduleTime(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-zinc-900/60 text-white focus:outline-none focus:border-amber-300/40 text-sm font-semibold"
                        required
                      />
                    </div>
                  </FormField>

                  <FormActions className="mt-2">
                    <button
                      type="submit"
                      disabled={isExecuting || savingSettings}
                      className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 border border-white/[0.08] px-4 py-2 text-xs font-bold text-white transition hover:bg-zinc-700 disabled:opacity-50 w-full sm:w-auto"
                    >
                      {savingSettings ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save Schedule
                    </button>
                  </FormActions>
                </div>
              </SectionCard>
            </form>
          </div>

          {/* Backup History Table */}
          <div className="lg:col-span-2">
            <SectionCard
              title="Backup History"
              description="Review and download daily exports or restore data states."
              icon={<ListTodo className="h-5 w-5" />}
            >
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <table className="min-w-full divide-y divide-white/[0.05] text-left">
                  <thead>
                    <tr className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                      <th className="px-4 py-3">Date & Time</th>
                      <th className="px-4 py-3">Size</th>
                      <th className="px-4 py-3">Records</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {history.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-zinc-500 italic">
                          No backup operations recorded.
                        </td>
                      </tr>
                    ) : (
                      history.map((item) => {
                        const dateStr = formatDateTime(item.created_at);
                        const isDeleting = deletingPath === item.filename;

                        return (
                          <tr key={item.id} className="hover:bg-white/[0.02]">
                            <td className="px-4 py-3.5 font-medium text-white">
                              {dateStr}
                            </td>
                            <td className="px-4 py-3.5 text-zinc-300">
                              {item.status === 'Success' ? formatBytes(item.size_bytes) : '--'}
                            </td>
                            <td className="px-4 py-3.5 text-zinc-300">
                              {item.status === 'Success' ? `${item.records_count} rows` : '--'}
                            </td>
                            <td className="px-4 py-3.5">
                              {item.status === 'Success' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" /> Success
                                </span>
                              )}
                              {item.status === 'Failed' && (
                                <span
                                  title={item.error_message || 'Unknown error'}
                                  className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-400 cursor-help"
                                >
                                  <XCircle className="h-3 w-3" /> Failed
                                </span>
                              )}
                              {item.status === 'In Progress' && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400 animate-pulse">
                                  <Loader2 className="h-3 w-3 animate-spin" /> Progress
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right whitespace-nowrap">
                              {item.status === 'Success' && (
                                <div className="inline-flex gap-2">
                                  {/* Native Downloader Endpoint */}
                                  <a
                                    href={`/api/backup/download?path=${item.created_at.split('T')[0].split('-').slice(0, 2).join('/')}/${item.filename}`}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                    title="Download Backup"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => setRestoreItem(item)}
                                    disabled={isExecuting}
                                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:text-amber-300 hover:bg-zinc-800 transition disabled:opacity-50"
                                    title="Restore from Backup"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                  </button>
                                </div>
                              )}
                              
                              <button
                                type="button"
                                onClick={() => handleDeleteBackup(item.filename, item.created_at)}
                                disabled={isExecuting || isDeleting}
                                className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition disabled:opacity-50"
                                title="Delete Backup"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>

      {/* Restore Confirmation Modal Overlay */}
      {restoreItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card max-w-md w-full border border-white/[0.08] bg-zinc-950 p-6 shadow-2xl relative animate-page-enter">
            <div className="flex items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
                <AlertTriangle className="h-6 w-6" />
              </span>
              <div>
                <h3 className="text-base font-bold text-white">Confirm System Restore</h3>
                <p className="text-xs text-zinc-400 mt-1">
                  You are about to restore the gym database state from:
                </p>
                <div className="bg-zinc-900 rounded-lg p-2.5 my-3 text-[11px] font-mono text-zinc-300 break-all select-all">
                  {restoreItem.filename}
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.05] pt-4 mt-4 flex flex-col gap-4">
              <div className="rounded-xl border border-red-500/20 bg-red-500/[0.02] p-3 text-[11px] text-zinc-400">
                <p className="font-bold text-white">⚠️ CRITICAL WARNING:</p>
                <p className="mt-1">
                  This action will delete and overwrite ALL current tables, invoices, records, and uploaded assets. A safety backup of the current database will be created automatically before starting.
                </p>
              </div>

              <form onSubmit={handleRestoreSubmit} className="flex flex-col gap-4">
                <FormField label="Type 'RESTORE' to verify override:">
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RESTORE"
                    className="w-full h-11 px-3.5 rounded-xl border border-white/[0.08] bg-zinc-900 text-white focus:outline-none focus:border-red-400/40 text-sm font-bold uppercase tracking-wider placeholder:text-zinc-600 placeholder:normal-case"
                    required
                    autoFocus
                  />
                </FormField>

                <FormActions>
                  <button
                    type="button"
                    onClick={() => {
                      setRestoreItem(null);
                      setConfirmText('');
                    }}
                    disabled={restoring}
                    className="rounded-xl border border-white/[0.08] px-4 py-2.5 text-xs font-bold text-zinc-400 hover:text-white transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={restoring || confirmText.toUpperCase() !== 'RESTORE'}
                    className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
                  >
                    {restoring ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    Confirm Restore
                  </button>
                </FormActions>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
