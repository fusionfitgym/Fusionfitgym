'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  Activity,
  ArrowRight,
  Clock,
  Fingerprint,
  Search,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  getAttendanceAnalytics,
  getTodayAttendanceLogs,
  deleteAttendanceLog,
} from '@/lib/actions/attendance';
import { AttendanceLog } from '@/types';
import { CardSkeleton, ChartSkeleton, TableSkeleton } from '@/components/ui/Skeleton';

// Dynamically import recharts bar chart with a loading placeholder skeleton
const AttendancePeakChart = dynamic(() => import('@/components/dashboard/AttendancePeakChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

export default function AttendancePage() {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

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

  const handleDelete = async (id: string) => {
    try {
      await deleteAttendanceLog(id);
      fetchAttendanceData(); // Refresh UI counters, trends, and records lists
    } catch (err) {
      console.error('Failed to delete log:', err);
      window.alert('Failed to delete log.');
    }
  };

  const filteredLogs = logs.filter((log) =>
    log.member_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.device_user_id.includes(searchQuery)
  );

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
                  placeholder="Search member or device user ID..."
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
                        <th>Device user ID</th>
                        <th>Time</th>
                        <th>Punch type</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.map((log) => (
                        <tr key={log.id}>
                          <td>
                            <div className="flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                                <Fingerprint className="h-4 w-4" />
                              </div>
                              <span className="table-primary">{log.member_name}</span>
                            </div>
                          </td>
                          <td>
                            <span className="font-mono text-xs text-slate-600">{log.device_user_id}</span>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 text-xs text-slate-700">
                              <Clock className="h-3.5 w-3.5 text-slate-400" />
                              {new Date(log.punch_time).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`badge ${
                                log.punch_type === 'checkin' ? 'badge-active' : 'badge-frozen'
                              }`}
                            >
                              {log.punch_type === 'checkin' ? 'Check-in' : 'Check-out'}
                            </span>
                          </td>
                          <td className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Link href={`/members/${log.member_id}`} className="btn btn-ghost btn-sm">
                                Profile <ArrowRight className="h-3 w-3" />
                              </Link>
                              <ConfirmDialog
                                title="Delete log?"
                                description="This will permanently delete this check-in record."
                                onConfirm={() => void handleDelete(log.id)}
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
                      ))}
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
