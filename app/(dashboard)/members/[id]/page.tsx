'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  ClipboardList,
  Edit,
  FileText,
  Fingerprint,
  HeartPulse,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Breadcrumb,
  Card,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SmsSendButton } from '@/components/ui/SmsSendButton';
import { deleteMember, getMemberById } from '@/lib/actions/members';
import { getHealthByMember } from '@/lib/actions/health';
import { getParqByMember } from '@/lib/actions/parq';
import { getInvoicesByMember } from '@/lib/actions/invoices';
import { getAttendanceHistory } from '@/lib/actions/attendance';
import { getDevices } from '@/lib/actions/devices';
import { AttendanceLog, BiometricDevice, HealthAssessment, Invoice, Member, ParqResponse } from '@/types';
import {
  calculateAge,
  cn,
  formatCurrency,
  formatDate,
  getMembershipExpiry,
} from '@/lib/utils';
import { buildExpiryReminderMessage } from '@/lib/native-sms';

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [assessments, setAssessments] = useState<HealthAssessment[]>([]);
  const [parqs, setParqs] = useState<ParqResponse[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>([]);
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const [mounted, setMounted] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [currentAttPage, setCurrentAttPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState<AttendanceLog | null>(null);
  const attItemsPerPage = 5;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    Promise.all([
      getMemberById(id),
      getHealthByMember(id),
      getParqByMember(id),
      getInvoicesByMember(id),
      getAttendanceHistory({ member_id: id }).catch((e) => {
        console.error('Failed to get attendance history:', e);
        return [];
      }),
      getDevices().catch((e) => {
        console.error('Failed to get devices:', e);
        return [];
      }),
    ])
      .then(([memberData, healthData, parqData, invoiceData, attendanceData, devicesData]) => {
        setMember(memberData);
        setAssessments(healthData);
        setParqs(parqData);
        setInvoices(invoiceData);
        setAttendance(attendanceData || []);
        setDevices(devicesData || []);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMember(id);
      router.push('/members');
    } catch {
      window.alert('Failed to delete member.');
      setDeleting(false);
    }
  }

  // Relative time helper
  function formatRelativeTime(dateString: string | null | undefined): string {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Never';
    
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    
    if (diffMs < 0) return 'Just now';
    
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffSecs < 60) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    
    return formatDate(date);
  }

  if (loading) return <LoadingSpinner size={40} />;
  if (!member) return <div className="empty-state"><p className="card-title">Member not found</p></div>;

  const age = calculateAge(member.dob);
  const start = member.package_start_date;
  const expiry = member.package_end_date;
  const latestAssessment = assessments[0];

  // Attendance stats calculations
  const totalCheckins = attendance.filter(log => log.punch_type === 'checkin').length;
  const totalCheckouts = attendance.filter(log => log.punch_type === 'checkout').length;
  const lastVisitDate = attendance.length > 0 ? formatDate(attendance[0].punch_time) : '—';
  const firstVisitDate = attendance.length > 0 ? formatDate(attendance[attendance.length - 1].punch_time) : '—';
  const lastSeen = attendance.length > 0 ? formatRelativeTime(attendance[0].punch_time) : 'Never';
  
  // This calendar month
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthCheckins = attendance.filter(log => {
    if (log.punch_type !== 'checkin' || !log.punch_time) return false;
    const pt = new Date(log.punch_time);
    return pt.getTime() >= startOfMonth.getTime();
  }).length;
  
  // Today checkins
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayCheckins = attendance.filter(log => {
    if (log.punch_type !== 'checkin' || !log.punch_time) return false;
    const pt = new Date(log.punch_time);
    return pt.getTime() >= startOfToday.getTime();
  }).length;
  
  // Average visits per week
  let avgVisitsPerWeek = 0;
  const checkinLogs = attendance.filter(log => log.punch_type === 'checkin');
  if (checkinLogs.length > 0) {
    const oldestDate = new Date(checkinLogs[checkinLogs.length - 1].punch_time);
    const diffTime = Math.abs(now.getTime() - oldestDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
    const diffWeeks = diffDays / 7;
    avgVisitsPerWeek = diffWeeks > 0 ? parseFloat((checkinLogs.length / diffWeeks).toFixed(1)) : checkinLogs.length;
  }

  // Filtered attendance logs
  const filteredAttendance = attendance.filter((log) => {
    if (!log.punch_time) return false;
    const logDate = new Date(log.punch_time);
    const logTime = logDate.getTime();
    
    if (filterType === 'today') {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      return logTime >= todayStart.getTime() && logTime <= todayEnd.getTime();
    }
    
    if (filterType === '7days') {
      const past7 = new Date();
      past7.setDate(past7.getDate() - 7);
      past7.setHours(0, 0, 0, 0);
      return logTime >= past7.getTime();
    }
    
    if (filterType === '30days') {
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      past30.setHours(0, 0, 0, 0);
      return logTime >= past30.getTime();
    }
    
    if (filterType === 'custom') {
      if (customStart) {
        const start = new Date(customStart);
        start.setHours(0, 0, 0, 0);
        if (logTime < start.getTime()) return false;
      }
      if (customEnd) {
        const end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
        if (logTime > end.getTime()) return false;
      }
      return true;
    }
    
    return true; // 'all'
  });

  // Chart data calculation
  const getChartData = () => {
    const checkinLogsFiltered = filteredAttendance.filter(l => l.punch_type === 'checkin');
    const countsByDate: Record<string, number> = {};
    
    let daysToGenerate = 30;
    let startDate = new Date();
    
    if (filterType === 'today') {
      daysToGenerate = 1;
      startDate = new Date();
    } else if (filterType === '7days') {
      daysToGenerate = 7;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 6);
    } else if (filterType === '30days') {
      daysToGenerate = 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
    } else if (filterType === 'custom') {
      const start = customStart ? new Date(customStart) : new Date();
      const end = customEnd ? new Date(customEnd) : new Date();
      const diffTime = Math.abs(end.getTime() - start.getTime());
      daysToGenerate = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;
      if (daysToGenerate > 60) daysToGenerate = 60;
      startDate = new Date(start);
    } else {
      // 'all' filter: show last 30 days
      daysToGenerate = 30;
      startDate = new Date();
      startDate.setDate(startDate.getDate() - 29);
    }
    
    const dataList = [];
    for (let i = 0; i < daysToGenerate; i++) {
      const current = new Date(startDate);
      current.setDate(startDate.getDate() + i);
      const dateKey = current.toDateString();
      const displayLabel = current.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      countsByDate[dateKey] = 0;
      dataList.push({ dateKey, label: displayLabel });
    }
    
    checkinLogsFiltered.forEach((log) => {
      const logDateKey = new Date(log.punch_time).toDateString();
      if (countsByDate[logDateKey] !== undefined) {
        countsByDate[logDateKey]++;
      }
    });
    
    return dataList.map(item => ({
      name: item.label,
      Visits: countsByDate[item.dateKey] || 0
    }));
  };

  const chartData = getChartData();

  // Device lookup map
  const deviceNameMap = new Map<string, string>();
  devices.forEach((d) => {
    if (d.serial_number) {
      deviceNameMap.set(d.serial_number, d.name);
    }
  });

  // Table pagination
  const totalPages = Math.ceil(filteredAttendance.length / attItemsPerPage);
  const paginatedAttendance = filteredAttendance.slice(
    (currentAttPage - 1) * attItemsPerPage,
    currentAttPage * attItemsPerPage
  );

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Members', href: '/members' },
          { label: member.full_name },
        ]}
      />
      <PageHeader
        title={member.full_name}
        subtitle={`Member since ${formatDate(start)}`}
        action={
          <>
            <SmsSendButton
              phone={member.phone}
              message={buildExpiryReminderMessage(
                member.full_name,
                formatDate(expiry),
              )}
              variant="sms"
              label="Send SMS"
            />
            <Link href={`/members/${id}/edit`} className="btn btn-primary">
              <Edit className="h-4 w-4" /> Edit member
            </Link>
            <ConfirmDialog
              title="Delete member?"
              description={`This will permanently delete ${member.full_name} and cannot be undone.`}
              onConfirm={() => void handleDelete()}
              trigger={
                <button type="button" className="btn btn-danger" disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="page-stack">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={member.profile_photo} name={member.full_name} size="xl" />
              <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">{member.full_name}</h2>
              {age !== null && <p className="mt-1 text-xs text-slate-500">{age} years old</p>}
              <div className="mt-3"><StatusBadge variant={member.status} /></div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="space-y-4">
                {[
                  { icon: Phone, value: member.phone, label: 'Phone' },
                  { icon: Mail, value: member.email, label: 'Email' },
                  { icon: MapPin, value: member.address, label: 'Address' },
                  { icon: AlertCircle, value: member.emergency_contact, label: 'Emergency contact' },
                  { icon: Fingerprint, value: member.biometric_user_id, label: 'Biometric User ID' },
                ].map(({ icon: Icon, value, label }) => value ? (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="metric-label">{label}</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
                    </div>
                  </div>
                ) : null)}
              </div>
            </div>
          </Card>

          <div className="rounded-2xl border border-amber-300 bg-amber-300 p-5 text-zinc-950 shadow-[0_12px_30px_rgba(196,145,2,0.16)]">
            <p className="text-xs font-semibold text-black/55">Package Plan</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{member.package_name}</p>
            <p className="mt-1 text-sm font-semibold text-black/75">{formatCurrency(member.package_price)} / {member.package_duration}</p>
            <div className="mt-4 flex items-center gap-2 border-t border-black/10 pt-3">
              <Calendar className="h-4 w-4 text-black/55" />
              <p className="text-xs font-medium text-black/65">Expires {formatDate(expiry)}</p>
            </div>
          </div>
        </div>

        <div className="page-stack">
          <SectionCard
            title="Latest assessment"
            description={latestAssessment ? `Recorded ${formatDate(latestAssessment.created_at)}` : 'No health assessment has been recorded yet.'}
            icon={<HeartPulse className="h-5 w-5" />}
            action={
              latestAssessment ? (
                <Link href={`/health/${latestAssessment.id}`} className="btn btn-ghost btn-sm">View details</Link>
              ) : (
                <Link href={`/health/new?member=${id}`} className="btn btn-secondary btn-sm">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Link>
              )
            }
          >
            {latestAssessment ? (
              <div className="metric-grid">
                {[
                  { label: 'Height', value: latestAssessment.height ? `${latestAssessment.height} cm` : '-' },
                  { label: 'Weight', value: latestAssessment.weight ? `${latestAssessment.weight} kg` : '-' },
                  { label: 'BMI', value: latestAssessment.bmi ? String(latestAssessment.bmi) : '-' },
                  { label: 'Body fat', value: latestAssessment.body_fat ? `${latestAssessment.body_fat}%` : '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="metric-tile">
                    <p className="metric-label">{label}</p>
                    <p className="metric-value">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Create an assessment to start tracking body metrics and health notes.</p>
            )}
          </SectionCard>

          <SectionCard
            title={`PAR-Q forms (${parqs.length})`}
            description="Physical activity readiness and risk screening history."
            icon={<ClipboardList className="h-5 w-5" />}
            action={
              <Link href={`/parq/new?member=${id}`} className="btn btn-secondary btn-sm">
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
            }
          >
            {parqs.length === 0 ? (
              <p className="body-text">No PAR-Q forms have been submitted.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {parqs.slice(0, 4).map((parq) => (
                  <Link
                    key={parq.id}
                    href={`/parq/${parq.id}`}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-slate-800">PAR-Q assessment</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(parq.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Invoices (${invoices.length})`}
            description="Recent charges and payment status."
            icon={<FileText className="h-5 w-5" />}
            action={
              <Link href={`/invoices/new?member=${id}`} className="btn btn-secondary btn-sm">
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
            }
          >
            {invoices.length === 0 ? (
              <p className="body-text">No invoices have been generated.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.slice(0, 4).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</p>
                      <p className="mt-1 text-xs text-slate-500">Due {formatDate(invoice.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(invoice.amount)}</span>
                      <StatusBadge variant={invoice.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Attendance History"
            description="Biometric check-in and check-out tracking registry."
            icon={<Fingerprint className="h-5 w-5" />}
            action={
              <Link
                href={`/attendance?device_id=${member.biometric_user_id || ''}`}
                className="btn btn-secondary btn-sm"
              >
                View Full Attendance Report
              </Link>
            }
          >
            {attendance.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Fingerprint className="h-6 w-6" /></div>
                <p className="card-title">No attendance records found for this member.</p>
                <p className="small-text max-w-sm">This member has not checked in using biometric devices yet.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Attendance Stats Cards */}
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="metric-tile">
                    <p className="metric-label font-semibold text-slate-500 uppercase tracking-wider">Total Visits</p>
                    <p className="metric-value text-xl font-bold text-slate-900 mt-1">{totalCheckins}</p>
                    <p className="text-xs text-slate-500 mt-1.5">{totalCheckins} check-ins • {totalCheckouts} check-outs</p>
                  </div>
                  
                  <div className="metric-tile">
                    <p className="metric-label font-semibold text-slate-500 uppercase tracking-wider">Current Month</p>
                    <p className="metric-value text-xl font-bold text-slate-900 mt-1">{currentMonthCheckins}</p>
                    <p className="text-xs text-slate-500 mt-1.5">Today: {todayCheckins} check-ins</p>
                  </div>
                  
                  <div className="metric-tile">
                    <p className="metric-label font-semibold text-slate-500 uppercase tracking-wider">Weekly Average</p>
                    <p className="metric-value text-xl font-bold text-slate-900 mt-1">{avgVisitsPerWeek}</p>
                    <p className="text-xs text-slate-500 mt-1.5">Visits per week</p>
                  </div>
                  
                  <div className="metric-tile">
                    <p className="metric-label font-semibold text-slate-500 uppercase tracking-wider">Last Seen</p>
                    <p className="metric-value text-xl font-bold text-slate-900 mt-1 truncate" title={lastSeen}>{lastSeen}</p>
                    <p className="text-xs text-slate-500 mt-1.5 truncate">First: {firstVisitDate}</p>
                  </div>
                </div>

                {/* Visits Per Day Chart */}
                <div>
                  <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-3">Visits Per Day</h4>
                  <div className="card p-4">
                    {mounted ? (
                      <div className="h-[240px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" tickLine={false} />
                            <YAxis fontSize={11} stroke="#94a3b8" allowDecimals={false} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: '#1e293b',
                                border: 'none',
                                borderRadius: '8px',
                                color: '#fff',
                                fontSize: '12px'
                              }}
                              cursor={{ fill: 'rgba(244, 196, 48, 0.06)' }}
                            />
                            <Bar dataKey="Visits" fill="#f4c430" radius={[4, 4, 0, 0]} maxBarSize={40} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="h-[240px] flex items-center justify-center text-slate-400">Loading chart...</div>
                    )}
                  </div>
                </div>

                {/* Filters */}
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2 items-center justify-between">
                    <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">Attendance logs</h4>
                    <div className="segmented-control">
                      {[
                        { type: 'all', label: 'All Time' },
                        { type: 'today', label: 'Today' },
                        { type: '7days', label: '7 Days' },
                        { type: '30days', label: '30 Days' },
                        { type: 'custom', label: 'Custom' },
                      ].map((item) => (
                        <button
                          key={item.type}
                          type="button"
                          className={cn(
                            "segment",
                            filterType === item.type && "segment-active"
                          )}
                          onClick={() => {
                            setFilterType(item.type as any);
                            setCurrentAttPage(1);
                          }}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filterType === 'custom' && (
                    <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100 animate-page-enter">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">From:</label>
                        <input
                          type="date"
                          value={customStart}
                          onChange={(e) => {
                            setCustomStart(e.target.value);
                            setCurrentAttPage(1);
                          }}
                          className="input-field h-9 text-xs py-1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-slate-500">To:</label>
                        <input
                          type="date"
                          value={customEnd}
                          onChange={(e) => {
                            setCustomEnd(e.target.value);
                            setCurrentAttPage(1);
                          }}
                          className="input-field h-9 text-xs py-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Table */}
                {filteredAttendance.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                    <p className="text-sm font-semibold text-slate-600">No records match the active filters.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="data-table border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      <table>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Time</th>
                            <th>Punch Type</th>
                            <th>Device Name</th>
                            <th>Device Serial</th>
                            <th>Sync Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedAttendance.map((log) => {
                            const deviceSerial = log.device_id || '';
                            const deviceName = deviceNameMap.get(deviceSerial) || 'Unknown Device';
                            
                            return (
                              <tr
                                key={log.id}
                                className="cursor-pointer transition-colors hover:bg-slate-50/80"
                                onClick={() => setSelectedLog(log)}
                              >
                                <td className="table-primary">
                                  {log.punch_time ? new Date(log.punch_time).toLocaleDateString('en-IN', {
                                    day: '2-digit',
                                    month: 'short',
                                    year: 'numeric'
                                  }) : '—'}
                                </td>
                                <td>
                                  {log.punch_time ? new Date(log.punch_time).toLocaleTimeString('en-IN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                    hour12: true
                                  }) : '—'}
                                </td>
                                <td>
                                  <span className={cn(
                                    "badge font-bold",
                                    log.punch_type === 'checkin' ? "badge-active" : "badge-inactive"
                                  )}>
                                    {log.punch_type === 'checkin' ? 'Check-in' : 'Check-out'}
                                  </span>
                                </td>
                                <td className="font-medium text-slate-700">{deviceName}</td>
                                <td className="font-mono text-xs text-slate-500">{deviceSerial || '—'}</td>
                                <td>
                                  <span className={cn(
                                    "badge font-bold",
                                    log.sync_status?.toLowerCase() === 'synced' ? 'badge-active' : 'badge-expired'
                                  )}>
                                    {log.sync_status || 'Pending'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination Controls */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCurrentAttPage(p => Math.max(1, p - 1))}
                          disabled={currentAttPage === 1}
                        >
                          Previous
                        </button>
                        <span className="text-xs font-semibold text-slate-500">
                          Page {currentAttPage} of {totalPages}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setCurrentAttPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentAttPage === totalPages}
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Selected Log Diagnostics Details Modal */}
      {selectedLog && (
        <div className="alert-dialog-overlay flex items-center justify-center p-4">
          <div className="alert-dialog-content max-w-md w-full relative animate-dialog-in">
            <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-3">
              Attendance Log Details
            </h3>
            
            <div className="mt-4 space-y-3.5">
              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date & Time</span>
                <span className="text-sm font-medium text-slate-900 text-right">
                  {selectedLog.punch_time ? new Date(selectedLog.punch_time).toLocaleString('en-IN', {
                    dateStyle: 'full',
                    timeStyle: 'medium'
                  }) : '—'}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Punch Type</span>
                <span className={cn(
                  "badge font-bold",
                  selectedLog.punch_type === 'checkin' ? "badge-active" : "badge-inactive"
                )}>
                  {selectedLog.punch_type === 'checkin' ? 'Check-in' : 'Check-out'}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Name</span>
                <span className="text-sm font-medium text-slate-800">
                  {deviceNameMap.get(selectedLog.device_id || '') || 'Unknown Device'}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Device Serial</span>
                <span className="text-sm font-mono text-slate-800">
                  {selectedLog.device_id || '—'}
                </span>
              </div>

              <div className="flex justify-between items-center gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Sync Status</span>
                <span className={cn(
                  "badge font-bold",
                  selectedLog.sync_status?.toLowerCase() === 'synced' ? 'badge-active' : 'badge-expired'
                )}>
                  {selectedLog.sync_status || 'Pending'}
                </span>
              </div>

              <div className="flex justify-between items-start gap-4">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Record ID</span>
                <span className="text-xs font-mono text-slate-500 break-all select-all text-right">
                  {selectedLog.id}
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                className="btn btn-secondary w-full sm:w-auto"
                onClick={() => setSelectedLog(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
