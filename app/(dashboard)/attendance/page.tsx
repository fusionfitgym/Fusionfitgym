'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Clock,
  Fingerprint,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Terminal,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { PageHeader, LoadingSpinner } from '@/components/ui/Primitives';
import { createClient } from '@/lib/supabase/client';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  getAttendanceAnalytics,
  getTodayAttendanceLogs,
  deleteAttendanceLog,
  getSyncLogs,
} from '@/lib/actions/attendance';
import { AttendanceLog, BiometricSyncLog } from '@/types';
import { cn } from '@/lib/utils';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

// Dynamically import recharts bar chart with a loading placeholder skeleton
const AttendancePeakChart = dynamic(() => import('@/components/dashboard/AttendancePeakChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const deviceIdParam = searchParams.get('device_id');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState(deviceIdParam || '');

  useEffect(() => {
    if (deviceIdParam) {
      setSearchQuery(deviceIdParam);
    }
  }, [deviceIdParam]);
  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<BiometricSyncLog[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const fetchAttendanceData = () => {
    Promise.all([getTodayAttendanceLogs(), getAttendanceAnalytics()])
      .then(([logsData, analyticsData]) => {
        setLogs(logsData);
        setAnalytics(analyticsData);
      })
      .catch((err) => console.error('Failed to load attendance:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttendanceData();
    // Auto refresh every 30 seconds for live updates
    const interval = setInterval(fetchAttendanceData, 30000);
    return () => clearInterval(interval);
  }, []);

  // Fetch diagnostics sync logs
  useEffect(() => {
    if (showDiagnostics) {
      getSyncLogs().then(setSyncLogs).catch(console.error);
    }
  }, [showDiagnostics]);

  // Realtime subscription for sync diagnostics
  useEffect(() => {
    if (!showDiagnostics) return;
    
    const supabase = createClient();
    const channel = supabase
      .channel('realtime:biometric_sync_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'biometric_sync_logs' },
        (payload: any) => {
          setSyncLogs((prev) => [payload.new as BiometricSyncLog, ...prev.slice(0, 29)]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showDiagnostics]);

  const handleDelete = async (id: string) => {
    try {
      await deleteAttendanceLog(id);
      fetchAttendanceData(); // Refresh UI counters, trends, and records lists
    } catch (err) {
      console.error('Failed to delete log:', err);
      window.alert('Failed to delete log.');
    }
  };

  const searchText = (searchQuery || "").toLowerCase();

  const filteredLogs = (logs || []).filter((log) => {
    const memberName =
      (log?.member as any)?.name ||
      log?.member?.full_name ||
      log?.member_name ||
      "Unknown Member";
    const biometricUserId = log?.biometric_user_id || "";
    
    return (
      (memberName || "").toLowerCase().includes(searchText) ||
      (biometricUserId || "").includes(searchQuery || "")
    );
  });

  return (
    <div className="page page-enter">
      <PageHeader
        title="Attendance dashboard"
        subtitle="Monitor live biometric logs, track check-ins, check-outs, and gym occupancy metrics."
      />

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <ChartSkeleton />
          <TableSkeleton rows={5} cols={5} />
        </div>
      ) : (
        <>
          {/* Analytics Summary */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:gap-6">
            <div className="card flex items-center gap-4 p-5">
              <span className="icon-box">
                <UserCheck className="h-5 w-5" />
              </span>
              <div>
                <p className="metric-label">Today's check-ins</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{analytics?.checkins ?? 0}</p>
              </div>
            </div>

            <div className="card flex items-center gap-4 p-5">
              <span className="icon-box bg-zinc-100 text-zinc-600">
                <UserX className="h-5 w-5" />
              </span>
              <div>
                <p className="metric-label">Today's check-outs</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{analytics?.checkouts ?? 0}</p>
              </div>
            </div>

            <div className="card flex items-center gap-4 p-5 border-amber-300 bg-amber-50">
              <span className="icon-box bg-amber-300 text-zinc-950 shadow-[0_4px_12px_rgba(244,196,48,0.2)]">
                <Activity className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <p className="metric-label text-amber-800 font-semibold">Live occupancy</p>
                <p className="mt-1 text-2xl font-bold text-amber-950">{analytics?.occupancy ?? 0} members active</p>
              </div>
            </div>
          </div>

          {/* Real-time Biometric Sync Diagnostics Console */}
          <section className="card mt-6 border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex w-full items-center justify-between p-4 sm:p-5 text-left font-semibold text-slate-900 cursor-pointer hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-amber-300 shadow">
                  <Terminal className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-950">Biometric Sync Diagnostics Console</h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">Debug real-time member matching and hardware sync issues</p>
                </div>
              </div>
              {showDiagnostics ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
            </button>

            {showDiagnostics && (
              <div className="border-t border-slate-100 p-4 sm:p-5 bg-slate-50/50">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Live matching logs</span>
                  <button 
                    onClick={() => getSyncLogs().then(setSyncLogs).catch(console.error)}
                    className="text-xs text-amber-700 hover:text-amber-800 font-semibold cursor-pointer"
                  >
                    Refresh Logs
                  </button>
                </div>

                <div className="space-y-2 max-h-[250px] overflow-y-auto font-mono text-xs">
                  {syncLogs.length === 0 ? (
                    <div className="text-center py-6 text-slate-400">No sync events recorded recently. Try punching on the device.</div>
                  ) : (
                    syncLogs.map((sLog) => {
                      const isSuccess = sLog.status === 'Success';
                      return (
                        <div 
                          key={sLog.id} 
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-xl border transition-all duration-200",
                            isSuccess 
                              ? "bg-emerald-50/40 border-emerald-100 text-emerald-950" 
                              : "bg-rose-50/40 border-rose-100 text-rose-950"
                          )}
                        >
                          {isSuccess ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold">{sLog.message}</p>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 font-sans">
                              <span>Biometric ID: <strong className="font-mono">{sLog.biometric_user_id}</strong></span>
                              <span>•</span>
                              <span>{new Date(sLog.punch_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </section>

          {/* Hourly Trend Chart */}
          <section className="card mt-6 p-4 sm:p-6">
            <div className="mb-6">
              <h2 className="section-title">Hourly check-in volume</h2>
              <p className="section-description">Peak attendance hours registered today</p>
            </div>
            <AttendancePeakChart data={analytics?.hourlyDistribution ?? []} />
          </section>

          {/* Daily Attendance Logs */}
          <section className="mt-6">
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="section-title">Today's activity log</h2>
                <p className="section-description">Real-time punch records from the eSSL X200B biometric machine</p>
              </div>
              <div className="input-with-icon max-w-xs">
                <Search className="h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search member or biometric user ID..."
                  className="input-field"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="card p-12 text-center text-slate-400">
                No check-in logs found for today matching the filters.
              </div>
            ) : (
              <div className="card overflow-hidden">
                <div className="data-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Member name</th>
                        <th>Biometric User ID</th>
                        <th>Time</th>
                        <th>Punch type</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => {
                        const memberName =
                          (log?.member as any)?.name ||
                          log?.member?.full_name ||
                          log?.member_name ||
                          "Unknown Member";
                        const biometricUserId = log?.biometric_user_id || "—";
                        const punchType = log?.punch_type || "checkin";
                        
                        return (
                          <tr key={log?.id || Math.random().toString()}>
                            <td>
                              <div className="flex items-center gap-2">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                                  <Fingerprint className="h-4 w-4" />
                                </div>
                                <span className="table-primary">{memberName}</span>
                              </div>
                            </td>
                            <td>
                              <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{biometricUserId}</span>
                            </td>
                            <td>
                              <div className="flex items-center gap-1.5 text-xs text-slate-700">
                                <Clock className="h-3.5 w-3.5 text-slate-400" />
                                {log?.punch_time ? new Date(log.punch_time).toLocaleTimeString('en-IN', {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                }) : '—'}
                              </div>
                            </td>
                            <td>
                              <span
                                className={`badge ${
                                  punchType === 'checkin' ? 'badge-active' : 'badge-frozen'
                                }`}
                              >
                                {punchType === 'checkin' ? 'Check-in' : 'Check-out'}
                              </span>
                            </td>
                            <td className="text-right">
                              <div className="flex justify-end items-center gap-2">
                                <Link href={`/members/${log?.member_id || ''}`} className="btn btn-ghost btn-sm">
                                  Profile <ArrowRight className="h-3.5 w-3.5" />
                                </Link>
                                <ConfirmDialog
                                  title="Delete log?"
                                  description="This will permanently delete this check-in record."
                                  onConfirm={() => log?.id && void handleDelete(log.id)}
                                  trigger={
                                    <button
                                      type="button"
                                      className="table-action table-action-danger flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-100"
                                      title="Delete log"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <AttendancePageContent />
    </Suspense>
  );
}
