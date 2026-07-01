'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
  Database,
  HardHat,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { getAttendanceReport, getMemberReport, getRevenueReport } from '@/lib/actions/reports';
import { cleanupOldAttendanceLogs, getStaffAttendanceHistory } from '@/lib/actions/attendance';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { toast } from 'sonner';

export default function ReportsPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [activeTab, setActiveTab] = useState<'attendance' | 'members' | 'revenue' | 'staff_attendance'>('attendance');
  const [attendanceTimeframe, setAttendanceTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [memberFilter, setMemberFilter] = useState<'active' | 'expired'>('active');
  const [staffTimeframe, setStaffTimeframe] = useState<'today' | '7days' | '15days' | '30days'>('7days');

  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [attendanceDebug, setAttendanceDebug] = useState<any>(null);
  const [memberData, setMemberData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any>(null);
  const [staffAttendanceData, setStaffAttendanceData] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteOldLogs = async () => {
    setDeleting(true);
    const toastId = toast.loading('Deleting attendance logs older than 15 days...');
    try {
      const res = await cleanupOldAttendanceLogs();
      if (res.success) {
        toast.success(`✓ ${res.deletedCount} attendance logs deleted successfully.`, { id: toastId });
        await fetchReport();
      } else {
        toast.error(res.error || 'Failed to delete logs.', { id: toastId });
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'An unexpected error occurred.', { id: toastId });
    } finally {
      setDeleting(false);
    }
  };

  // Fetch reports based on active tab/filters
  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'attendance') {
        const res = await getAttendanceReport(attendanceTimeframe);
        setAttendanceData(res.logs);
        setAttendanceDebug(res.debug);
      } else if (activeTab === 'members') {
        const data = await getMemberReport(memberFilter);
        setMemberData(data);
      } else if (activeTab === 'revenue') {
        const data = await getRevenueReport();
        setRevenueData(data);
      } else if (activeTab === 'staff_attendance') {
        if (isDemo) {
          const data = demo.getStaffAttendanceHistory({ timeframe: staffTimeframe });
          setStaffAttendanceData(data);
        } else {
          const data = await getStaffAttendanceHistory({ timeframe: staffTimeframe });
          setStaffAttendanceData(data);
        }
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, attendanceTimeframe, memberFilter, staffTimeframe, isDemo]);

  // Client-side CSV Exporter
  const handleCSVExport = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      alert('No data available to export.');
      return;
    }

    // Clean data for CSV
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','), // Header row
      ...data.map((row) =>
        headers
          .map((fieldName) => {
            const value = row[fieldName];
            // Stringify and escape double quotes
            let cell = value === null || value === undefined ? '' : String(value);
            cell = cell.replace(/"/g, '""');
            if (cell.includes(',') || cell.includes('\n') || cell.includes('"')) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(',')
      ),
    ];

    const csvBlob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(csvBlob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Reporting center"
        subtitle="Extract detailed summaries, compile rosters, check billing tallies, and export spreadsheet audit files."
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-4" aria-label="Report Category Tabs">
          {[
            { id: 'attendance' as const, label: 'Attendance Logs', icon: Activity },
            { id: 'members' as const, label: 'Member Audit', icon: Users },
            { id: 'revenue' as const, label: 'Financial Reports', icon: TrendingUp },
            { id: 'staff_attendance' as const, label: 'Staff Attendance', icon: HardHat },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all ${
                activeTab === id
                  ? 'border-amber-400 text-zinc-950'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Controls & Filters */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {activeTab === 'attendance' && (
            <div className="segmented-control">
              {[
                { id: 'daily' as const, label: 'Today' },
                { id: 'weekly' as const, label: 'Last 7 days' },
                { id: 'monthly' as const, label: 'Last 30 days' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setAttendanceTimeframe(id)}
                  className={`segment ${attendanceTimeframe === id ? 'segment-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="segmented-control">
              {[
                { id: 'active' as const, label: 'Active members' },
                { id: 'expired' as const, label: 'Expired memberships' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setMemberFilter(id)}
                  className={`segment ${memberFilter === id ? 'segment-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'staff_attendance' && (
            <div className="segmented-control">
              {[
                { id: 'today' as const, label: 'Today' },
                { id: '7days' as const, label: 'Last 7 days' },
                { id: '15days' as const, label: 'Last 15 days' },
                { id: '30days' as const, label: 'Last 30 days' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setStaffTimeframe(id)}
                  className={`segment ${staffTimeframe === id ? 'segment-active' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          
          {activeTab === 'revenue' && (
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <FileText className="h-3.5 w-3.5" /> All-time invoices log
              </span>
            </div>
          )}
        </div>

        {/* CSV Export Button & Database Maintenance */}
        <div>
          {activeTab === 'attendance' ? (
            <div className="flex flex-col sm:items-end gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database Maintenance</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={loading || deleting}
                  onClick={() => handleCSVExport(attendanceData, `attendance_${attendanceTimeframe}`)}
                  className="btn btn-secondary flex items-center gap-2"
                >
                  📄 Export CSV
                </button>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      disabled={loading || deleting}
                      className="btn btn-danger flex items-center gap-2"
                      style={{ backgroundColor: '#dc2626', color: '#ffffff' }}
                    >
                      {deleting ? (
                        <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : '🗑'} Delete Old Logs
                    </button>
                  }
                  title="Delete Attendance Logs"
                  description="This will permanently delete all attendance logs older than 15 days. This action cannot be undone."
                  confirmLabel="Delete"
                  onConfirm={handleDeleteOldLogs}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => {
                if (activeTab === 'members') {
                  handleCSVExport(memberData, `members_${memberFilter}`);
                } else if (activeTab === 'revenue') {
                  handleCSVExport(revenueData?.invoices || [], 'financials_revenue');
                } else if (activeTab === 'staff_attendance') {
                  handleCSVExport(
                    staffAttendanceData.map(row => ({
                      'Employee ID': row.employee_id || '',
                      'Employee Name': row.full_name || '',
                      'Role': row.role || '',
                      'Biometric ID': row.biometric_user_id || '',
                      'Check In': row.check_in || '',
                      'Check Out': row.check_out || '',
                      'Shift': row.shift || '',
                      'Working Hours': row.working_hours || 0,
                      'Overtime': row.overtime_hours || 0,
                      'Date': row.date || '',
                      'Status': row.status || '',
                      'Notes': row.notes || ''
                    })),
                    `staff_attendance_${staffTimeframe}`
                  );
                }
              }}
              className="btn btn-secondary flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Tally Stats for Revenue */}
      {activeTab === 'revenue' && revenueData && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="card p-5 border-l-4 border-l-emerald-500">
            <p className="metric-label">Total collections</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(revenueData.totalRevenue)}
            </p>
          </div>
          <div className="card p-5 border-l-4 border-l-amber-500">
            <p className="metric-label">Pending receipts</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(revenueData.pendingRevenue)}
            </p>
          </div>
          <div className="card p-5 border-l-4 border-l-rose-500">
            <p className="metric-label">Overdue invoices</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {formatCurrency(revenueData.overdueRevenue)}
            </p>
          </div>
        </div>
      )}

      {/* Diagnostics Debug Stats for Attendance */}
      {activeTab === 'attendance' && attendanceDebug && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="card p-4 border-l-4 border-l-blue-500 bg-blue-50/5">
            <p className="metric-label text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Total Logs (15 Days)</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {attendanceDebug.totalLogs15 ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Logs from last 15 days</p>
          </div>
          <div className="card p-4 border-l-4 border-l-indigo-500 bg-indigo-50/5">
            <p className="metric-label text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Today's Logs</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {attendanceDebug.todayLogsCount ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">All check-ins/outs today</p>
          </div>
          <div className="card p-4 border-l-4 border-l-emerald-500 bg-emerald-50/5">
            <p className="metric-label text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Check-ins Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {attendanceDebug.checkinsToday ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Check-ins today</p>
          </div>
          <div className="card p-4 border-l-4 border-l-amber-500 bg-amber-50/5">
            <p className="metric-label text-slate-500 font-semibold text-[11px] uppercase tracking-wider">Check-outs Today</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              {attendanceDebug.checkoutsToday ?? 0}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 font-medium">Check-outs today</p>
          </div>
          <div className="card p-4 border-t-4 border-t-amber-400 bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  <Database className="h-3.5 w-3.5 text-amber-400" /> Database Health
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-800">
                  Healthy
                </span>
              </div>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Retention Policy</span>
                  <span className="font-semibold text-slate-900">15 Days</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto Cleanup</span>
                  <span className="font-semibold text-slate-900">Enabled</span>
                </div>
                <div className="flex justify-between">
                  <span>Next Cleanup</span>
                  <span className="font-semibold text-slate-900">2:00 AM Daily</span>
                </div>
              </div>
            </div>
            <div className="mt-2 pt-1 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
              <span>Status</span>
              <span className="font-bold text-emerald-600">Healthy</span>
            </div>
          </div>
        </div>
      )}

      {/* Results Content */}
      {loading ? (
        <TableSkeleton rows={8} cols={activeTab === 'attendance' ? 4 : 6} />
      ) : (
        <div className="card overflow-hidden">
          {activeTab === 'attendance' && (
            attendanceData.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No attendance records found.</div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Member Name</th>
                      <th>Biometric User ID</th>
                      <th>Time</th>
                      <th>Punch Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((row) => (
                      <tr key={row.id}>
                        <td><p className="table-primary">{row.member_name}</p></td>
                        <td><span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{row.biometric_user_id}</span></td>
                        <td>
                          <p className="text-xs text-slate-800">
                            {new Date(row.punch_time).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </td>
                        <td>
                          <span className={`badge ${row.punch_type === 'checkin' ? 'badge-active' : 'badge-frozen'}`}>
                            {row.punch_type === 'checkin' ? 'Check-in' : 'Check-out'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'members' && (
            memberData.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No matching members found.</div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Full name</th>
                      <th>Phone</th>
                      <th>Package</th>
                      <th>Start date</th>
                      <th>Expiry date</th>
                      <th>Days remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberData.map((row) => (
                      <tr key={row.id}>
                        <td><p className="table-primary">{row.full_name}</p></td>
                        <td><span className="text-sm text-slate-600">{row.phone}</span></td>
                        <td><span className="text-sm text-slate-900 font-semibold">{row.package_name} ({row.package_duration})</span></td>
                        <td><span className="text-xs text-slate-500">{formatDate(row.package_start_date)}</span></td>
                        <td><span className="text-xs text-slate-500">{formatDate(row.expiry_date)}</span></td>
                        <td>
                          {row.status === 'Expired' ? (
                            <span className="badge badge-inactive">Expired</span>
                          ) : (
                            <span className="badge badge-active">{row.days_remaining} day(s)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {activeTab === 'revenue' && (
            (!revenueData?.invoices || revenueData.invoices.length === 0) ? (
              <div className="p-12 text-center text-slate-400">No invoices tracked.</div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Invoice number</th>
                      <th>Member</th>
                      <th>Plan</th>
                      <th>Amount</th>
                      <th>Due date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revenueData.invoices.map((row: any, i: number) => (
                      <tr key={i}>
                        <td><span className="table-primary font-mono">{row.invoice_number}</span></td>
                        <td><p className="table-primary">{row.member_name}</p></td>
                        <td><span className="text-xs text-slate-500">{row.plan}</span></td>
                        <td><span className="text-sm text-slate-900 font-bold">{formatCurrency(row.amount)}</span></td>
                        <td><span className="text-xs text-slate-500">{formatDate(row.due_date)}</span></td>
                        <td>
                          <span
                            className={`badge ${
                              row.status === 'Paid'
                                ? 'badge-active'
                                : row.status === 'Pending'
                                ? 'badge-expired'
                                : 'badge-inactive'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
          {activeTab === 'staff_attendance' && (
            staffAttendanceData.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No staff attendance records found.</div>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Role</th>
                      <th>Biometric ID</th>
                      <th>Check In</th>
                      <th>Check Out</th>
                      <th>Work Hours</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAttendanceData.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div>
                            <p className="table-primary">{row.full_name}</p>
                            <span className="text-[10px] text-slate-400 font-bold">{row.employee_id}</span>
                          </div>
                        </td>
                        <td><span className="text-xs text-slate-600 font-semibold">{row.role}</span></td>
                        <td><span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{row.biometric_user_id || '—'}</span></td>
                        <td><span className="text-xs text-slate-800">{row.check_in ? new Date(row.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</span></td>
                        <td><span className="text-xs text-slate-800">{row.check_out ? new Date(row.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—'}</span></td>
                        <td><span className="text-xs text-slate-800">{row.working_hours !== null && row.working_hours !== undefined ? `${row.working_hours} hrs` : '—'}</span></td>
                        <td><span className="text-xs text-slate-500">{formatDate(row.date)}</span></td>
                        <td>
                          <span
                            className={`badge ${
                              row.status === 'Present'
                                ? 'badge-active'
                                : row.status === 'Late'
                                ? 'badge-warning'
                                : row.status === 'Half Day'
                                ? 'badge-orange bg-orange-100 text-orange-800 border-orange-200'
                                : 'badge-inactive'
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
