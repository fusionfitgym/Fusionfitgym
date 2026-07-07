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
  assignBiometricId,
  getAttendanceLogsPaginated,
} from '@/lib/actions/attendance';
import { getMembers } from '@/lib/actions/members';
import { getStaff } from '@/lib/actions/staff';
import { AttendanceLog, BiometricSyncLog } from '@/types';
import { cn } from '@/lib/utils';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

// Dynamically import recharts bar chart with a loading placeholder skeleton
const AttendancePeakChart = dynamic(() => import('@/components/dashboard/AttendancePeakChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

function AttendancePageContent() {
  const searchParams = useSearchParams();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const deviceIdParam = searchParams.get('device_id');
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState(deviceIdParam || '');
  const [debouncedSearch, setDebouncedSearch] = useState(deviceIdParam || '');
  const [machineFilter, setMachineFilter] = useState<'All' | 'Gents' | 'Ladies'>('All');
  const [timeframeFilter, setTimeframeFilter] = useState<'daily' | 'weekly' | 'monthly' | 'all'>('daily');
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const limit = 25;

  useEffect(() => {
    if (deviceIdParam) {
      setSearchQuery(deviceIdParam);
    }
  }, [deviceIdParam]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1); // Reset to first page on search
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [loading, setLoading] = useState(true);
  const [syncLogs, setSyncLogs] = useState<BiometricSyncLog[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const [assignSearch, setAssignSearch] = useState('');
  const [assignOptions, setAssignOptions] = useState<any[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigningLog, setAssigningLog] = useState<any | null>(null);
  const [assignType, setAssignType] = useState<'member' | 'staff' | null>(null);

  useEffect(() => {
    if (!assigningLog || !assignType) return;
    setAssignLoading(true);

    if (isDemo) {
      if (assignType === 'member') {
        setAssignOptions(demo.members);
      } else {
        setAssignOptions(demo.staff);
      }
      setAssignLoading(false);
      return;
    }

    if (assignType === 'member') {
      getMembers()
        .then(setAssignOptions)
        .catch(console.error)
        .finally(() => setAssignLoading(false));
    } else {
      getStaff({ page: 1, limit: 100 })
        .then((res) => setAssignOptions(res.staff))
        .catch(console.error)
        .finally(() => setAssignLoading(false));
    }
  }, [assigningLog, assignType, isDemo]);

  const filteredAssignOptions = assignOptions.filter((opt) =>
    (opt.full_name || '').toLowerCase().includes(assignSearch.toLowerCase())
  );

  const handleConfirmAssignment = async (targetId: string) => {
    if (!assigningLog || !assignType) return;
    const bioId = assigningLog.biometric_user_id;

    try {
      if (isDemo) {
        if (assignType === 'member') {
          demo.updateMember(targetId, { biometric_user_id: bioId });
          toast.success(`Biometric ID ${bioId} assigned to member (Demo Mode)`);
        } else {
          const field = assigningLog.machine_type === 'Ladies' ? 'biometric_ladies_id' : 'biometric_gents_id';
          demo.updateStaff(targetId, { [field]: bioId });
          toast.success(`Biometric ID ${bioId} assigned to staff ${field === 'biometric_gents_id' ? 'Gents' : 'Ladies'} (Demo Mode)`);
        }
        setAssigningLog(null);
        setAssignType(null);
        setAssignSearch('');
        fetchAttendanceData();
        return;
      }

      const res = await assignBiometricId(targetId, assignType, bioId, assigningLog.machine_type);
      if (!res.success) {
        toast.error(res.error || 'Failed to assign biometric ID');
        return;
      }

      toast.success(`Biometric ID ${bioId} linked successfully!`);
      setAssigningLog(null);
      setAssignType(null);
      setAssignSearch('');
      fetchAttendanceData();
      if (showDiagnostics) {
        getSyncLogs().then(setSyncLogs).catch(console.error);
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred during assignment');
    }
  };

  const fetchAttendanceData = () => {
    if (isDemo) {
      let demoLogs = demo.attendance;
      if (machineFilter !== 'All') {
        demoLogs = demoLogs.filter((l: any) => l.machine_type === machineFilter);
      }
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        demoLogs = demoLogs.filter((l: any) => {
          const name = l.member?.full_name || l.member_name || '';
          const bioId = l.biometric_user_id || '';
          return name.toLowerCase().includes(q) || bioId.includes(q);
        });
      }
      setLogs(demoLogs as any);
      setTotalCount(demoLogs.length);
      setAnalytics(demo.getAttendanceAnalytics());
      setLoading(false);
      return;
    }
    
    // Fetch paginated enriched logs
    getAttendanceLogsPaginated({
      page,
      limit,
      timeframe: timeframeFilter,
      search: debouncedSearch,
      machine: machineFilter
    })
      .then((res) => {
        setLogs(res.logs);
        setTotalCount(res.totalCount);
      })
      .catch((err) => console.error('Failed to load paginated logs:', err))
      .finally(() => setLoading(false));

    // Fetch analytics summary (non-blocking)
    getAttendanceAnalytics()
      .then(setAnalytics)
      .catch((err) => console.error('Failed to load analytics:', err));
  };

  useEffect(() => {
    fetchAttendanceData();
    // Auto refresh every 30 seconds for live updates
    const interval = setInterval(fetchAttendanceData, 30000);
    return () => clearInterval(interval);
  }, [page, timeframeFilter, debouncedSearch, machineFilter]);

  // Real-time subscription to update automatically on new punch
  useEffect(() => {
    if (isDemo) return;
    const supabase = createClient();
    const channel = supabase
      .channel('attendance_live_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        () => {
          fetchAttendanceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [page, timeframeFilter, debouncedSearch, machineFilter]);

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
      if (isDemo) {
        demo.deleteAttendanceLog(id);
        fetchAttendanceData();
        toast.success('Attendance log deleted (Demo Mode)');
        return;
      }
      await deleteAttendanceLog(id);
      fetchAttendanceData(); // Refresh UI counters, trends, and records lists
    } catch (err) {
      console.error('Failed to delete log:', err);
      window.alert('Failed to delete log.');
    }
  };

  const handleExportCSV = async () => {
    try {
      let exportData: AttendanceLog[] = [];
      if (isDemo) {
        exportData = logs;
      } else {
        const res = await getAttendanceLogsPaginated({
          page: 1,
          limit: 1000,
          timeframe: timeframeFilter,
          search: debouncedSearch,
          machine: machineFilter
        });
        exportData = res.logs;
      }

      if (exportData.length === 0) {
        toast.error('No logs to export');
        return;
      }

      const headers = ['Member Name', 'Biometric ID', 'Machine', 'Time', 'Punch Type'];
      const csvRows = [headers.join(',')];

      exportData.forEach((log) => {
        const memberName = (log?.member as any)?.name || log?.member?.full_name || log?.member_name || 'Unknown Member';
        const biometricId = log?.biometric_user_id || '—';
        const machine = log.machine_type || 'Gents';
        const timeStr = log.punch_time ? new Date(log.punch_time).toLocaleString('en-IN') : '—';
        const typeStr = log.punch_type === 'checkout' ? 'Check-out' : 'Check-in';

        const row = [
          `"${memberName.replace(/"/g, '""')}"`,
          `"${biometricId.replace(/"/g, '""')}"`,
          `"${machine.replace(/"/g, '""')}"`,
          `"${timeStr.replace(/"/g, '""')}"`,
          `"${typeStr.replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(','));
      });

      const csvContent = 'data:text/csv;charset=utf-8,' + csvRows.join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `attendance_logs_${timeframeFilter}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Attendance logs exported successfully!');
    } catch (err) {
      console.error('Failed to export attendance logs:', err);
      toast.error('Failed to export CSV');
    }
  };

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
                            <p className="font-semibold">
                              {isSuccess 
                                ? sLog.message 
                                : `Unknown User (Biometric ID: ${sLog.biometric_user_id})`}
                            </p>
                            <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500 font-sans">
                              <span>Biometric ID: <strong className="font-mono">{sLog.biometric_user_id}</strong></span>
                              <span>•</span>
                              <span>{new Date(sLog.punch_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                            </div>
                            {!isSuccess && (
                              <div className="mt-2.5 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningLog(sLog);
                                    setAssignType('member');
                                  }}
                                  className="btn btn-xs bg-amber-300 text-zinc-950 hover:bg-amber-400 cursor-pointer font-bold rounded-lg px-2.5 py-1 text-[11px] border border-amber-400"
                                >
                                  Assign To Existing Member
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAssigningLog(sLog);
                                    setAssignType('staff');
                                  }}
                                  className="btn btn-xs bg-slate-200 text-slate-800 hover:bg-slate-300 cursor-pointer font-bold rounded-lg px-2.5 py-1 text-[11px] border border-slate-300"
                                >
                                  Assign To Existing Staff
                                </button>
                              </div>
                            )}
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
                <h2 className="section-title">
                  {timeframeFilter === 'daily' && "Today's activity log"}
                  {timeframeFilter === 'weekly' && "Weekly activity log (Last 7 Days)"}
                  {timeframeFilter === 'monthly' && "Monthly activity log (Last 30 Days)"}
                  {timeframeFilter === 'all' && "Historical activity log (Last 90 Days)"}
                </h2>
                <p className="section-description">Real-time punch records from the biometric machines</p>
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <select 
                  value={timeframeFilter} 
                  onChange={(e) => {
                    setTimeframeFilter(e.target.value as any);
                    setPage(1);
                  }} 
                  className="select-field md:w-36"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="all">90 Days</option>
                </select>
                <select 
                  value={machineFilter} 
                  onChange={(e) => {
                    setMachineFilter(e.target.value as any);
                    setPage(1);
                  }} 
                  className="select-field md:w-36"
                >
                  <option value="All">All Members</option>
                  <option value="Gents">Gents Machine</option>
                  <option value="Ladies">Ladies Machine</option>
                </select>
                <button
                  onClick={handleExportCSV}
                  className="btn btn-sm btn-ghost border border-slate-200 cursor-pointer font-bold text-xs flex items-center gap-1.5 h-9 px-3 rounded-lg hover:bg-slate-50 bg-white"
                >
                  📥 Export CSV
                </button>
              </div>
              <div className="input-with-icon max-w-xs">
                <Search className="h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search member or ID..."
                  className="input-field"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="card p-12 text-center text-slate-400">
                No check-in logs found matching the filters.
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
                      {logs.map((log) => {
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
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">{biometricUserId}</span>
                                <span className="text-xs text-slate-500">{log.machine_type || 'Gents'}</span>
                              </div>
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

                {/* Pagination Controls */}
                {totalCount > limit && (
                  <div className="flex items-center justify-between border-t border-slate-100 p-4 bg-slate-50/30">
                    <p className="text-xs text-slate-500 font-medium">
                      Showing <strong className="text-slate-800">{(page - 1) * limit + 1}</strong> to{' '}
                      <strong className="text-slate-800">{Math.min(page * limit, totalCount)}</strong> of{' '}
                      <strong className="text-slate-800">{totalCount}</strong> logs
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="btn btn-sm btn-ghost border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-white"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setPage(p => Math.min(Math.ceil(totalCount / limit), p + 1))}
                        disabled={page >= Math.ceil(totalCount / limit)}
                        className="btn btn-sm btn-ghost border border-slate-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer bg-white"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </>
      )}
      {/* Biometric Assignment Modal */}
      {assigningLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md bg-white p-6 shadow-xl animate-enter">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Assign Biometric ID: {assigningLog.biometric_user_id}
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              Select the {assignType === 'member' ? 'member' : 'staff member'} to map this biometric machine user ID.
            </p>
            
            {/* Search Input */}
            <div className="input-with-icon mb-4">
              <Search className="h-4 w-4" />
              <input
                type="text"
                placeholder={`Search ${assignType === 'member' ? 'member' : 'staff'} by name...`}
                className="input-field"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
              />
            </div>
            
            {/* List */}
            <div className="max-h-60 overflow-y-auto border border-slate-100 rounded-lg divide-y divide-slate-100 mb-6">
              {assignLoading ? (
                <div className="p-4 text-center text-slate-400">Loading...</div>
              ) : filteredAssignOptions.length === 0 ? (
                <div className="p-4 text-center text-slate-400">No matches found.</div>
              ) : (
                filteredAssignOptions.map((opt: any) => (
                  <button
                    key={opt.id}
                    onClick={() => handleConfirmAssignment(opt.id)}
                    className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{opt.full_name}</p>
                      <p className="text-xs text-slate-500">{opt.phone || opt.employee_id || ''}</p>
                    </div>
                    <span className="text-[11px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                      Assign
                    </span>
                  </button>
                ))
              )}
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setAssigningLog(null);
                  setAssignType(null);
                  setAssignSearch('');
                }}
                className="btn btn-ghost"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
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
