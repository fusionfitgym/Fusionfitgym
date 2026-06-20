import Link from 'next/link';
import dynamic from 'next/dynamic';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Clock,
  Dumbbell,
  FileText,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Send,
} from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/session-cache';
import { Member } from '@/types';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentMembers } from '@/components/dashboard/RecentMembers';
import { PageHeader } from '@/components/ui/Primitives';
import { getAttendanceAnalytics } from '@/lib/actions/attendance';
import { getSMSStats } from '@/lib/actions/sms';
import { formatCurrency, isExpiringSoon, getMembershipExpiry, formatDate, cn } from '@/lib/utils';
import DashboardChartsSection from '@/components/dashboard/DashboardChartsSection';
import AttendancePeakSection from '@/components/dashboard/AttendancePeakSection';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Authenticate user session on the server
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // 2. Fetch profile from cookie cache or database
  const cookieStore = await cookies();
  const cachedSessionVal = cookieStore.get('fusionfit-session')?.value;
  const cachedProfile = cachedSessionVal ? await verifySession(cachedSessionVal, user.id) : null;

  let profile = null;
  if (cachedProfile) {
    profile = {
      role: cachedProfile.role,
      full_name: cachedProfile.fullName
    };
  } else {
    const { data } = await supabase
      .from('users_profiles')
      .select('role, full_name')
      .eq('auth_user_id', user.id)
      .single();
    profile = data;
  }

  const role = profile?.role || 'Trainer';
  const showRevenueAnalytics = ['Super Admin', 'Admin'].includes(role);
  const showAttendanceAnalytics = ['Super Admin', 'Admin', 'Receptionist'].includes(role);
  const showSMSAnalytics = ['Super Admin', 'Admin'].includes(role);

  // 3. Optimized parallel fetching of data
  const promises: any[] = [
    supabase
      .from('members')
      .select('id, full_name, phone, join_date, status, membership_plan, profile_photo')
      .order('created_at', { ascending: false })
  ];

  if (showRevenueAnalytics) {
    promises.push(
      supabase
        .from('invoices')
        .select('amount, status, created_at')
        .eq('status', 'Paid')
    );
  } else {
    promises.push(Promise.resolve({ data: [] }));
  }

  if (showAttendanceAnalytics) {
    promises.push(getAttendanceAnalytics());
  } else {
    promises.push(Promise.resolve(null));
  }

  if (showSMSAnalytics) {
    promises.push(getSMSStats());
  } else {
    promises.push(Promise.resolve(null));
  }

  const [
    membersResult,
    invoicesResult,
    attendance,
    smsStats
  ] = await Promise.all(promises);

  const members = (membersResult?.data || []) as Member[];
  const invoices = (invoicesResult?.data || []) as any[];

  // 4. Client-side state operations computed on Server
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

  // Chart data formatting
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
    { href: '/members/add', label: 'Add member', description: 'Create a member profile', icon: UserPlus, roles: ['Super Admin', 'Admin', 'Receptionist', 'Trainer'] },
    { href: '/invoices/new', label: 'Create invoice', description: 'Record a payment', icon: FileText, roles: ['Super Admin', 'Admin', 'Receptionist'] },
    { href: '/health/new', label: 'Health assessment', description: 'Capture fitness metrics', icon: Dumbbell, roles: ['Super Admin', 'Admin', 'Trainer'] },
    { href: '/parq/new', label: 'New PAR-Q form', description: 'Readiness screening', icon: ClipboardList, roles: ['Super Admin', 'Admin', 'Trainer'] },
  ].filter((action) => action.roles.includes(role));

  const visibleCardsCount = 1 + (showAttendanceAnalytics ? 2 : 0) + (showRevenueAnalytics ? 1 : 0);

  return (
    <div className="page page-enter">
      <PageHeader
        title="Dashboard"
        subtitle={`Welcome back, ${profile?.full_name || 'User'}. Here is your management view.`}
        action={
          <Link href="/members/add" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Add member
          </Link>
        }
      />

      {/* Adaptive Stats Grid */}
      <div
        className={cn(
          'grid grid-cols-1 gap-4 lg:gap-6',
          visibleCardsCount === 1
            ? 'md:grid-cols-1 lg:grid-cols-1'
            : visibleCardsCount === 3
            ? 'md:grid-cols-3 lg:grid-cols-3'
            : 'md:grid-cols-2 lg:grid-cols-4',
        )}
      >
        <StatCard
          title="Total members"
          value={total}
          icon={<Users className="h-5 w-5" />}
          subtitle="All registered members"
          accent
        />
        {showAttendanceAnalytics && (
          <>
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
          </>
        )}
        {showRevenueAnalytics && (
          <StatCard
            title="Monthly revenue"
            value={formatCurrency(monthlyRevenue)}
            icon={<TrendingUp className="h-5 w-5" />}
            subtitle="Paid invoices this month"
          />
        )}
      </div>

      {/* SMS Summary Card */}
      {showSMSAnalytics && smsStats && (
        <section className="card mt-6 p-4 sm:p-5 border-amber-200 bg-amber-50/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3.5 mb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-600" />
                SMS System Summary
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time status of system-generated notifications and member alerts</p>
            </div>
            <Link href="/sms" className="btn btn-ghost btn-sm text-amber-700 hover:text-amber-800 self-start sm:self-auto">
              Open SMS logs <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[
              { label: 'Messages Sent Today', value: smsStats.todaySent, color: 'text-emerald-700' },
              { label: 'Failed Messages', value: smsStats.failed, color: 'text-red-600' },
              { label: 'Monthly SMS Cost', value: `₹${smsStats.monthlyCost.toFixed(2)}`, color: 'text-amber-700' },
              { label: 'Delivery Success Rate', value: `${smsStats.successRate}%`, color: 'text-blue-700' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-slate-200/40">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{label}</span>
                <span className={cn('span font-extrabold block mt-1 tracking-tight', color)}>{value}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      {quickActions.length > 0 && (
        <section className="mt-6">
          <div className="mb-4">
            <h2 className="section-title">Quick actions</h2>
            <p className="section-description">Common workflows, one click away</p>
          </div>
          <div
            className={cn(
              'grid grid-cols-1 gap-3 sm:grid-cols-2',
              quickActions.length === 3 ? 'lg:grid-cols-3' : 'lg:grid-cols-4',
            )}
          >
            {quickActions.map(({ href, label, description, icon: Icon }) => (
              <Link key={href} href={href} className="card card-hover flex min-h-24 items-center gap-4 p-4">
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
      )}

      {/* Dynamic Visualizations & Expiring Alerts */}
      {showRevenueAnalytics && (
        <DashboardChartsSection revenueData={revenueData} pieData={pieData} />
      )}

      {/* Attendance Trend Widget & Expiry warnings list */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Hourly distribution peak log */}
        {showAttendanceAnalytics && (
          <AttendancePeakSection hourlyDistribution={attendance?.hourlyDistribution ?? []} />
        )}

        {/* Expiring memberships roster */}
        <section className={cn('card p-4 sm:p-6', !showAttendanceAnalytics && 'xl:col-span-3')}>
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
                  <span className="badge badge-expired text-[10px] font-bold">{m.daysRemaining} day(s) left</span>
                </div>
              </div>
            ))}

            {expiringMembersList.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-400">No memberships expiring soon.</div>
            )}
          </div>
        </section>
      </div>

      <div className="mt-6">
        <RecentMembers members={members as any} />
      </div>
    </div>
  );
}
