'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  Calendar,
  Clock,
  HardHat,
  Search,
  UserCheck,
  Users,
  Fingerprint,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { getStaffAttendanceHistory, getStaffAttendanceTodayStats } from '@/lib/actions/attendance';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

type RoleFilter = 'All' | 'Trainer' | 'Janitor';
type StatusFilter = 'All' | 'Present' | 'Late' | 'Half Day' | 'Absent';
type TimeframeFilter = 'all' | 'today' | '7days' | '15days' | '30days';

export default function StaffAttendancePage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [logs, setLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ present: 0, trainers: 0, janitors: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all');

  const fetchAttendance = () => {
    setLoading(true);
    if (isDemo) {
      const data = demo.getStaffAttendanceHistory({
        search,
        role: roleFilter,
        status: statusFilter,
        timeframe,
      });
      setLogs(data);
      setStats(demo.getStaffAttendanceTodayStats());
      setLoading(false);
      return;
    }

    Promise.all([
      getStaffAttendanceHistory({
        search,
        role: roleFilter,
        status: statusFilter,
        timeframe,
      }),
      getStaffAttendanceTodayStats(),
    ])
      .then(([historyData, statsData]) => {
        setLogs(historyData);
        setStats(statsData);
      })
      .catch((err) => {
        console.error('Error fetching staff attendance:', err);
        toast.error('Failed to load staff attendance logs');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttendance();
  }, [search, roleFilter, statusFilter, timeframe, isDemo]);

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return '—';
    try {
      const d = new Date(timeStr);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '—';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'Present':
        return 'badge badge-success';
      case 'Late':
        return 'badge badge-warning';
      case 'Half Day':
        return 'badge badge-orange bg-orange-100 text-orange-800 border-orange-200';
      case 'Absent':
        return 'badge badge-danger';
      default:
        return 'badge badge-slate';
    }
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Staff attendance logs"
        subtitle="Check biometric punches, work shifts, late arrival flags, and hours clocked by staff."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4 lg:gap-6">
        <div className="card flex items-center gap-4 p-5">
          <span className="icon-box bg-emerald-50 text-emerald-600">
            <UserCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="metric-label">Staff Present Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{stats.present}</p>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5">
          <span className="icon-box bg-amber-50 text-amber-600">
            <Users className="h-5 w-5" />
          </span>
          <div>
            <p className="metric-label">Trainers Present</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{stats.trainers}</p>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5">
          <span className="icon-box bg-blue-50 text-blue-600">
            <HardHat className="h-5 w-5" />
          </span>
          <div>
            <p className="metric-label">Janitors Present</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{stats.janitors}</p>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5 bg-amber-50/40 border-amber-200">
          <span className="icon-box bg-amber-400 text-zinc-950 shadow-[0_4px_12px_rgba(244,196,48,0.2)]">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <p className="metric-label font-semibold text-amber-900">Total Active Staff</p>
            <p className="mt-1 text-2xl font-bold text-zinc-950">
              {stats.present} / {stats.total}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <section className="mt-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as TimeframeFilter)}
              className="select-field md:w-36"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="15days">Last 15 Days</option>
              <option value="30days">Last 30 Days</option>
            </select>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
              className="select-field md:w-36"
            >
              <option value="All">All Roles</option>
              <option value="Trainer">Trainer</option>
              <option value="Janitor">Janitor</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="select-field md:w-36"
            >
              <option value="All">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Half Day">Half Day</option>
              <option value="Absent">Absent</option>
            </select>
          </div>

          <div className="input-with-icon max-w-xs">
            <Search className="h-4 w-4" />
            <input
              type="text"
              placeholder="Search staff or biometric ID..."
              className="input-field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Data Table */}
        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : logs.length === 0 ? (
          <div className="card p-12 text-center text-slate-400">
            No staff attendance logs found matching the filters.
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Role</th>
                    <th>Biometric ID</th>
                    <th>Check In</th>
                    <th>Check Out</th>
                    <th>Work Shift</th>
                    <th>Work Hours</th>
                    <th>Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div>
                          <p className="font-bold text-slate-900">
                            {row.full_name || 'Unknown Staff'}
                          </p>
                          <p className="text-[10px] font-semibold text-slate-400 mt-0.5">
                            {row.employee_id || '—'}
                          </p>
                        </div>
                      </td>
                      <td>
                        <span className="text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-100 rounded-md px-2 py-1">
                          {row.role}
                        </span>
                      </td>
                      <td className="font-mono text-xs text-slate-700 font-semibold">
                        <span className="inline-flex items-center gap-1">
                          <Fingerprint className="h-3 w-3 text-slate-400" />
                          {row.biometric_gents_id || row.biometric_ladies_id || '—'}
                        </span>
                      </td>
                      <td className="text-slate-900 text-xs font-medium">
                        {formatTime(row.check_in)}
                      </td>
                      <td className="text-slate-900 text-xs font-medium">
                        {formatTime(row.check_out)}
                      </td>
                      <td className="text-slate-600 text-xs font-medium">{row.shift || '—'}</td>
                      <td>
                        {row.working_hours !== null && row.working_hours !== undefined ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-bold text-slate-900">
                              {row.working_hours} hrs
                            </span>
                            {row.overtime_hours > 0 && (
                              <span className="text-[10px] text-emerald-600 font-bold">
                                +{row.overtime_hours} OT
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">In Progress</span>
                        )}
                      </td>
                      <td className="text-slate-600 text-xs font-medium">{formatDate(row.date)}</td>
                      <td>
                        <span className={getStatusBadgeClass(row.status)}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
