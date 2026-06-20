'use client';

import { useEffect, useState } from 'react';
import {
  Activity,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { getAttendanceReport, getMemberReport, getRevenueReport } from '@/lib/actions/reports';
import { formatCurrency, formatDate } from '@/lib/utils';
import { TableSkeleton } from '@/components/ui/Skeleton';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'attendance' | 'members' | 'revenue'>('attendance');
  const [attendanceTimeframe, setAttendanceTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [memberFilter, setMemberFilter] = useState<'active' | 'expired'>('active');

  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [memberData, setMemberData] = useState<any[]>([]);
  const [revenueData, setRevenueData] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  // Fetch reports based on active tab/filters
  const fetchReport = async () => {
    setLoading(true);
    try {
      if (activeTab === 'attendance') {
        const data = await getAttendanceReport(attendanceTimeframe);
        setAttendanceData(data);
      } else if (activeTab === 'members') {
        const data = await getMemberReport(memberFilter);
        setMemberData(data);
      } else if (activeTab === 'revenue') {
        const data = await getRevenueReport();
        setRevenueData(data);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, attendanceTimeframe, memberFilter]);

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
            { id: 'attendance' as const, label: 'Attendance logs', icon: Activity },
            { id: 'members' as const, label: 'Members audit', icon: Users },
            { id: 'revenue' as const, label: 'Financial tallies', icon: TrendingUp },
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

          {activeTab === 'revenue' && (
            <div className="flex gap-2">
              <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                <FileText className="h-3.5 w-3.5" /> All-time invoices log
              </span>
            </div>
          )}
        </div>

        {/* CSV Export Button */}
        <div>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              if (activeTab === 'attendance') {
                handleCSVExport(attendanceData, `attendance_${attendanceTimeframe}`);
              } else if (activeTab === 'members') {
                handleCSVExport(memberData, `members_${memberFilter}`);
              } else if (activeTab === 'revenue') {
                handleCSVExport(revenueData?.invoices || [], 'financials_revenue');
              }
            }}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
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
                      <th>Device ID</th>
                      <th>Time</th>
                      <th>Punch Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceData.map((row) => (
                      <tr key={row.id}>
                        <td><p className="table-primary">{row.member_name}</p></td>
                        <td><span className="font-mono text-xs text-slate-500">{row.device_user_id}</span></td>
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
                      <th>Plan</th>
                      <th>Join date</th>
                      <th>Expiry date</th>
                      <th>Days remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberData.map((row) => (
                      <tr key={row.id}>
                        <td><p className="table-primary">{row.full_name}</p></td>
                        <td><span className="text-sm text-slate-600">{row.phone}</span></td>
                        <td><span className="text-sm text-slate-900 font-semibold">{row.membership_plan}</span></td>
                        <td><span className="text-xs text-slate-500">{formatDate(row.join_date)}</span></td>
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
        </div>
      )}
    </div>
  );
}
