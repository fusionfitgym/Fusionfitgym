'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  ClipboardList,
  Clock,
  Dumbbell,
  FileText,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentMembers } from '@/components/dashboard/RecentMembers';
import { LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { getMembers } from '@/lib/actions/members';
import { getInvoices } from '@/lib/actions/invoices';
import { getAttendanceAnalytics } from '@/lib/actions/attendance';
import { Invoice, Member } from '@/types';
import { formatCurrency, isExpiringSoon, getMembershipExpiry, formatDate } from '@/lib/utils';

const planColors: Record<string, string> = {
  Monthly: '#f4c430',
  Quarterly: '#f59e0b',
  Biannual: '#64748b',
  Annual: '#18181b',
};

export default function DashboardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attendance, setAttendance] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMembers(), getInvoices(), getAttendanceAnalytics()])
      .then(([memberData, invoiceData, attendanceData]) => {
        setMembers(memberData);
        setInvoices(invoiceData);
        setAttendance(attendanceData);
      })
      .catch((err) => console.error('Failed to load dashboard data:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size={40} />;

  const total = members.length;
  const active = members.filter((member) => member.status === 'Active').length;
  const expiringSoon = members.filter(
    (member) =>
      member.status === 'Active' &&
      isExpiringSoon(member.join_date, member.membership_plan),
  ).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = invoices
    .filter((invoice) => invoice.status === 'Paid' && new Date(invoice.created_at) >= monthStart)
    .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

  const planCounts: Record<string, number> = {};
  members.forEach((member) => {
    planCounts[member.membership_plan] = (planCounts[member.membership_plan] ?? 0) + 1;
  });
  const pieData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  const revenueData = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const revenue = invoices
      .filter((invoice) => {
        const createdAt = new Date(invoice.created_at);
        return invoice.status === 'Paid' && createdAt >= start && createdAt <= end;
      })
      .reduce((sum, invoice) => sum + Number(invoice.amount), 0);

    return {
      month: date.toLocaleString('en-IN', { month: 'short' }),
      revenue,
    };
  });

  const expiringMembersList = members
    .filter((m) => m.status === 'Active' && isExpiringSoon(m.join_date, m.membership_plan))
    .map((m) => {
      const expiry = getMembershipExpiry(m.join_date, m.membership_plan);
      const diff = expiry.getTime() - new Date().getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return { ...m, daysRemaining: days, expiryDate: expiry };
    })
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5);

  const quickActions = [
    { href: '/members/add', label: 'Add member', description: 'Create a member profile', icon: UserPlus },
    { href: '/invoices/new', label: 'Create invoice', description: 'Record a membership payment', icon: FileText },
    { href: '/health/new', label: 'Health assessment', description: 'Capture fitness metrics', icon: Dumbbell },
    { href: '/parq/new', label: 'New PAR-Q form', description: 'Run readiness screening', icon: ClipboardList },
  ];

  return (
    <div className="page page-enter">
      <PageHeader
        title="Dashboard"
        subtitle="A concise view of membership health, revenue, live occupancy, and biometric gates."
        action={
          <Link href="/members/add" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Add member
          </Link>
        }
      />

      {/* Upgraded Stats Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 lg:gap-6">
        <StatCard
          title="Total members"
          value={total}
          icon={<Users className="h-5 w-5" />}
          subtitle="All registered members"
          accent
        />
        <StatCard
          title="Live occupancy"
          value={attendance?.occupancy ?? 0}
          icon={<Activity className="h-5 w-5 text-emerald-600 animate-pulse" />}
          subtitle="Members inside gym now"
        />
        <StatCard
          title="Today's check-ins"
          value={attendance?.checkins ?? 0}
          icon={<UserCheck className="h-5 w-5" />}
          subtitle="Biometric punches logged today"
        />
        <StatCard
          title="Monthly revenue"
          value={formatCurrency(monthlyRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle="Paid invoices this month"
        />
      </div>

      {/* Quick Actions */}
      <section className="mt-6">
        <div className="mb-4">
          <h2 className="section-title">Quick actions</h2>
          <p className="section-description">Common workflows, one click away</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map(({ href, label, description, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="card card-hover flex min-h-24 items-center gap-4 p-4"
            >
              <span className="icon-box">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-950">{label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Dynamic Visualizations & Expiring Alerts */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Revenue trend graph */}
        <section className="card min-h-80 p-4 sm:p-6 xl:col-span-2">
          <div className="mb-6">
            <h2 className="section-title">Revenue trend</h2>
            <p className="section-description">Paid invoice volume over the last six months</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf2" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8c94a3' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#8c94a3' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  formatter={(value) => [formatCurrency(Number(value ?? 0)), 'Revenue']}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #e2e5ea',
                    boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="revenue" fill="#f4c430" radius={[6, 6, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Membership mix or Hourly attendance trend */}
        <section className="card min-h-80 p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="section-title">Membership mix</h2>
              <p className="section-description">Distribution across available plans</p>
            </div>
          </div>
          {pieData.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="45%"
                    innerRadius={52}
                    outerRadius={82}
                    dataKey="value"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={planColors[entry.name] ?? '#f4c430'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid #e2e5ea',
                      boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
                      fontSize: 12,
                    }}
                  />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12, color: '#5e6573' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-400">No membership data yet</div>
          )}
        </section>
      </div>

      {/* Attendance Trend Widget & Expiry warnings list */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Hourly distribution peak log */}
        <section className="card p-4 sm:p-6 xl:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="section-title">Today's attendance peak times</h2>
              <p className="section-description">Gate entry counts grouped per hour</p>
            </div>
            <Link href="/attendance" className="btn btn-ghost btn-sm">
              View live logs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendance?.hourlyDistribution ?? []} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf2" />
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8c94a3' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8c94a3' }} />
                <Tooltip
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{
                    borderRadius: 10,
                    border: '1px solid #e2e5ea',
                    boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Check-ins" fill="#f4c430" radius={[4, 4, 0, 0]} maxBarSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Expiring memberships roster */}
        <section className="card p-4 sm:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="section-title font-bold text-slate-900">Expiring memberships</h2>
              <p className="section-description">Expiring in the next 7 days</p>
            </div>
            <span className="badge badge-inactive font-bold">{expiringSoon}</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto pr-1">
            {expiringMembersList.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{m.full_name}</p>
                  <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                    <Clock className="h-3 w-3" /> Expires {formatDate(m.expiryDate)}
                  </span>
                </div>
                <div>
                  <span className="badge badge-expired text-[10px] font-bold">
                    {m.daysRemaining} day(s) left
                  </span>
                </div>
              </div>
            ))}

            {expiringMembersList.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">
                No memberships expiring soon.
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <RecentMembers members={members} />
      </div>
    </div>
  );
}
