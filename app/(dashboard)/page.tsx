import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { unstable_noStore as noStore } from 'next/cache';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Clock,
  Dumbbell,
  FileText,
  HardHat,
  RefreshCw,
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
import { ExpiringMembersList } from '@/components/dashboard/ExpiringMembersList';
import { ExpiryAndBiometricsSection } from '@/components/dashboard/ExpiryAndBiometricsSection';
import { PageHeader } from '@/components/ui/Primitives';
import { getAttendanceAnalytics, getStaffAttendanceTodayStats } from '@/lib/actions/attendance';
import { getSMSStats } from '@/lib/actions/sms';
import { getStaffStats } from '@/lib/actions/staff';
import { getDashboardRenewalStats } from '@/lib/actions/renewals';
import { getMonthlyCycleRange, isInvoiceInCycle, formatCurrency, isExpiringSoon, getMembershipExpiry, formatDate, cn } from '@/lib/utils';
import DashboardChartsSection from '@/components/dashboard/DashboardChartsSection';
import AttendancePeakSection from '@/components/dashboard/AttendancePeakSection';
import DashboardClientPage from '@/components/dashboard/DashboardClientPage';
import MonthlyRevenueSection from '@/components/dashboard/MonthlyRevenueSection';

import { getCurrentUserProfile } from '@/lib/actions/auth';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const isDemo = cookieStore.get('demo-mode')?.value === 'true';
  if (isDemo) {
    return <DashboardClientPage />;
  }

  // Prevent Next.js from caching the dashboard RSC output
  noStore();
  
  const authResult = await getCurrentUserProfile();
  if (!authResult || !authResult.user || !authResult.profile) {
    redirect('/login');
  }

  const { profile } = authResult;
  const role = profile.role || 'Trainer';
  const showRevenueAnalytics = ['Super Admin', 'Admin'].includes(role);
  const showAttendanceAnalytics = ['Super Admin', 'Admin', 'Receptionist'].includes(role);
  const showSMSAnalytics = ['Super Admin', 'Admin'].includes(role);

  const now = new Date();
  const yr = now.getFullYear();
  const mth = String(now.getMonth() + 1).padStart(2, '0');
  const dy = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yr}-${mth}-${dy}`;

  const addDaysLoc = (dateStr: string, days: number): string => {
    const res = new Date(dateStr);
    res.setDate(res.getDate() + days);
    return res.toISOString().split('T')[0];
  };
  const threeDaysLaterStr = addDaysLoc(todayStr, 3);
  const sevenDaysLaterStr = addDaysLoc(todayStr, 7);

  // 6 months ago for revenue charts and cycle calculations
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  const sixMonthsAgoStart = new Date(sixMonthsAgo.getFullYear(), sixMonthsAgo.getMonth(), 1).toISOString();

  let totalMembers = 0;
  let dailyPassMembers = 0;
  let activeMonthlyMembers = 0;
  let weightTrainingOnlyMembers = 0;
  let cardioStrengthMembers = 0;
  let recentMembers: Member[] = [];
  let expiringToday: Member[] = [];
  let expiringIn3Days: Member[] = [];
  let expiredMembers: Member[] = [];
  let disabledBiometrics: Member[] = [];
  let expiringMembersList: any[] = [];
  let planCounts: Record<string, number> = {};
  let invoices: any[] = [];
  let totalRevenue = 0;
  let attendance: any = null;
  let smsStats: any = null;
  let staffStats = { total: 0, trainers: 0, janitors: 0, active: 0 };
  let staffAttendanceToday = { present: 0, trainers: 0, janitors: 0, total: 0 };
  let renewalStats = { renewalsToday: 0, renewalsThisMonth: 0, upcomingRenewals: 0, expiredMemberships: 0 };

  // Optimized parallel fetching of lightweight, indexed data
  try {
    const supabase = await createClient();

    const memberSelectCols = 'id, full_name, phone, package_name, package_start_date, package_end_date, status, profile_photo, duration, training_type, biometric_status, biometric_user_id';

    const basePromises: Promise<any>[] = [
      // 0: Total members count
      supabase.from('members').select('id', { count: 'exact', head: true }),
      // 1: Daily pass count
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').eq('duration', 'Daily Pass'),
      // 2: Active monthly count
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').neq('duration', 'Daily Pass'),
      // 3: Weight training count
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').eq('training_type', 'Weight Training Only'),
      // 4: Cardio / strength count
      supabase.from('members').select('id', { count: 'exact', head: true }).eq('status', 'Active').in('training_type', ['Weight Training + Cardio', 'Weight Training + Strength Training']),
      // 5: Recent 5 members
      supabase.from('members').select(memberSelectCols).order('created_at', { ascending: false }).limit(5),
      // 6: Expiring today list
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').eq('package_end_date', todayStr),
      // 7: Expiring in 3 days list
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').gt('package_end_date', todayStr).lte('package_end_date', threeDaysLaterStr),
      // 8: Expired members list (capped)
      supabase.from('members').select(memberSelectCols).eq('status', 'Expired').limit(50),
      // 9: Disabled biometrics list (capped)
      supabase.from('members').select(memberSelectCols).eq('biometric_status', 'DISABLED').limit(50),
      // 10: 7-day expiring list
      supabase.from('members').select(memberSelectCols).eq('status', 'Active').neq('duration', 'Daily Pass').gte('package_end_date', todayStr).lte('package_end_date', sevenDaysLaterStr).order('package_end_date', { ascending: true }).limit(5),
      // 11: Active packages for pie chart
      supabase.from('members').select('package_name').eq('status', 'Active'),
      // 12: Staff stats
      getStaffStats().catch(() => ({ total: 0, trainers: 0, janitors: 0, active: 0 })),
      // 13: Staff attendance today stats
      getStaffAttendanceTodayStats().catch(() => ({ present: 0, trainers: 0, janitors: 0, total: 0 })),
      // 14: Renewal stats
      getDashboardRenewalStats().catch(() => ({ renewalsToday: 0, renewalsThisMonth: 0, upcomingRenewals: 0, expiredMemberships: 0 })),
    ];

    // Conditional promises
    const revIndex = basePromises.length;
    if (showRevenueAnalytics) {
      basePromises.push(
        // Recent 6 months paid invoices
        supabase
          .from('invoices')
          .select('id, invoice_number, amount, paid_amount, status, created_at, payment_date, payment_method, member_id, member:members(full_name, phone)')
          .eq('status', 'Paid')
          .gte('created_at', sixMonthsAgoStart)
          .order('created_at', { ascending: false }),
        // All-time paid invoice amounts for total revenue stat
        supabase.from('invoices').select('paid_amount, amount').eq('status', 'Paid')
      );
    }

    const attIndex = basePromises.length;
    if (showAttendanceAnalytics) {
      basePromises.push(getAttendanceAnalytics().catch(() => null));
    }

    const smsIndex = basePromises.length;
    if (showSMSAnalytics) {
      basePromises.push(getSMSStats().catch(() => null));
    }

    const results = await Promise.all(basePromises);

    totalMembers = results[0]?.count ?? 0;
    dailyPassMembers = results[1]?.count ?? 0;
    activeMonthlyMembers = results[2]?.count ?? 0;
    weightTrainingOnlyMembers = results[3]?.count ?? 0;
    cardioStrengthMembers = results[4]?.count ?? 0;
    recentMembers = (results[5]?.data || []) as Member[];
    expiringToday = (results[6]?.data || []) as Member[];
    expiringIn3Days = (results[7]?.data || []) as Member[];
    expiredMembers = (results[8]?.data || []) as Member[];
    disabledBiometrics = (results[9]?.data || []) as Member[];
    
    const expiringRaw = (results[10]?.data || []) as Member[];
    expiringMembersList = expiringRaw.map((m) => {
      const expiry = new Date(m.package_end_date || '');
      const diff = expiry.getTime() - now.getTime();
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return { ...m, daysRemaining: isNaN(days) ? 0 : days, expiryDate: expiry };
    });

    const activePackages = results[11]?.data || [];
    activePackages.forEach((member: any) => {
      if (member?.package_name) {
        planCounts[member.package_name] = (planCounts[member.package_name] ?? 0) + 1;
      }
    });

    staffStats = results[12] || staffStats;
    staffAttendanceToday = results[13] || staffAttendanceToday;
    renewalStats = results[14] || renewalStats;

    if (showRevenueAnalytics) {
      invoices = results[revIndex]?.data || [];
      const allTimeInvoices = results[revIndex + 1]?.data || [];
      totalRevenue = allTimeInvoices.reduce((sum: number, inv: any) => sum + Number(inv.paid_amount || inv.amount || 0), 0);
    }

    if (showAttendanceAnalytics) {
      attendance = results[attIndex] || null;
    }

    if (showSMSAnalytics) {
      smsStats = results[smsIndex] || null;
    }
  } catch (error) {
    console.error("Failed executing dashboard data fetching:", error);
  }

  const cycleRange = getMonthlyCycleRange(now);
  const cyclePaidInvoices = invoices.filter((inv) => isInvoiceInCycle(inv, cycleRange));
  const monthlyCycleRevenue = cyclePaidInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0),
    0
  );

  const pieData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  const revenueData = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    const revenue = invoices
      .filter((invoice) => {
        if (!invoice || !invoice.created_at) return false;
        const createdAt = new Date(invoice.created_at);
        return invoice.status === 'Paid' && createdAt >= start && createdAt <= end;
      })
      .reduce((sum, invoice) => sum + Number(invoice.paid_amount || invoice.amount || 0), 0);

    return {
      month: date.toLocaleString('en-IN', { month: 'short' }),
      revenue,
    };
  });

  const expiringSoon = renewalStats.upcomingRenewals || expiringMembersList.length;

  const quickActions = [
    { href: '/members/add', label: 'Add member', description: 'Create a member profile', icon: UserPlus, roles: ['Super Admin', 'Admin', 'Receptionist', 'Trainer'] },
    { href: '/invoices/new', label: 'Create invoice', description: 'Record a payment', icon: FileText, roles: ['Super Admin', 'Admin', 'Receptionist'] },
    { href: '/health/new', label: 'Health assessment', description: 'Capture fitness metrics', icon: Dumbbell, roles: ['Super Admin', 'Admin', 'Trainer'] },
    { href: '/parq/new', label: 'New PAR-Q form', description: 'Readiness screening', icon: ClipboardList, roles: ['Super Admin', 'Admin', 'Trainer'] },
  ].filter((action) => action.roles.includes(role));

  const visibleCardsCount = 1 + (showAttendanceAnalytics ? 2 : 0) + (showRevenueAnalytics ? 2 : 0);

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
            : 'sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5',
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
          <>
            <StatCard
              title="Monthly Revenue (4th-3rd)"
              value={formatCurrency(monthlyCycleRevenue)}
              icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}
              subtitle={`Cycle: ${cycleRange.startDayMonth} – ${cycleRange.endDayMonth}`}
            />
            <StatCard
              title="Total revenue"
              value={formatCurrency(totalRevenue)}
              icon={<TrendingUp className="h-5 w-5" />}
              subtitle="All paid invoices"
            />
          </>
        )}
      </div>

      {/* Redesigned Gym Package Analytics Grid */}
      <div className="grid grid-cols-2 gap-4 mt-6 lg:grid-cols-4">
        <StatCard
          title="Daily Pass Members"
          value={dailyPassMembers}
          icon={<Users className="h-5 w-5 text-amber-500" />}
          subtitle="Active daily visitors"
        />
        <StatCard
          title="Active Monthly Members"
          value={activeMonthlyMembers}
          icon={<Users className="h-5 w-5 text-emerald-500" />}
          subtitle="Active package subscribers"
        />
        <StatCard
          title="Weight Training Only"
          value={weightTrainingOnlyMembers}
          icon={<Dumbbell className="h-5 w-5 text-blue-500" />}
          subtitle="Active weight training members"
        />
        <StatCard
          title="Cardio / Strength"
          value={cardioStrengthMembers}
          icon={<Activity className="h-5 w-5 text-indigo-500" />}
          subtitle="Active cardio or strength training"
        />
      </div>

      {/* Membership Renewal Statistics Grid */}
      <div className="mt-6">
        <h2 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider text-xs text-slate-500">Membership Renewal Statistics</h2>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            title="Renewals Today"
            value={renewalStats.renewalsToday}
            icon={<RefreshCw className="h-5 w-5 text-amber-500" />}
            subtitle="Renewals processed today"
          />
          <StatCard
            title="Renewals This Month"
            value={renewalStats.renewalsThisMonth}
            icon={<RefreshCw className="h-5 w-5 text-emerald-600" />}
            subtitle="Total renewals this month"
          />
          <StatCard
            title="Upcoming Renewals"
            value={renewalStats.upcomingRenewals || expiringSoon}
            icon={<Clock className="h-5 w-5 text-amber-600" />}
            subtitle="Expiring in next 7 days"
          />
          <StatCard
            title="Expired Memberships"
            value={renewalStats.expiredMemberships || expiredMembers.length}
            icon={<Users className="h-5 w-5 text-rose-500" />}
            subtitle="Memberships currently expired"
          />
        </div>
      </div>

      {/* Staff Statistics Row */}
      {showRevenueAnalytics && (
        <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="col-span-2 lg:col-span-4 flex items-center gap-2">
            <HardHat className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Overview</span>
          </div>
          <StatCard
            title="Total Staff"
            value={staffStats.total}
            icon={<HardHat className="h-5 w-5 text-violet-500" />}
            subtitle="All registered staff"
          />
          <StatCard
            title="Trainers"
            value={staffStats.trainers}
            icon={<Users className="h-5 w-5 text-amber-500" />}
            subtitle="Registered trainers"
          />
          <StatCard
            title="Janitors"
            value={staffStats.janitors}
            icon={<HardHat className="h-5 w-5 text-blue-500" />}
            subtitle="Maintenance staff"
          />
          <StatCard
            title="Active Staff"
            value={staffStats.active}
            icon={<UserCheck className="h-5 w-5 text-emerald-500" />}
            subtitle="Currently active employees"
          />

          {/* Staff Attendance Row */}
          <div className="mt-2 col-span-2 lg:col-span-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Attendance Today</span>
          </div>
          <StatCard
            title="Staff Present Today"
            value={staffAttendanceToday.present}
            icon={<UserCheck className="h-5 w-5 text-emerald-500" />}
            subtitle="Staff punched in today"
          />
          <StatCard
            title="Trainers Present"
            value={staffAttendanceToday.trainers}
            icon={<Users className="h-5 w-5 text-amber-500" />}
            subtitle="Trainers punched in today"
          />
          <StatCard
            title="Janitors Present"
            value={staffAttendanceToday.janitors}
            icon={<HardHat className="h-5 w-5 text-blue-500" />}
            subtitle="Janitors punched in today"
          />
          <StatCard
            title="Total Staff Attendance Today"
            value={`${staffAttendanceToday.present} / ${staffStats.total}`}
            icon={<Activity className="h-5 w-5 text-violet-500" />}
            subtitle="Punched in / Total active"
          />
        </div>
      )}

      {/* SMS Summary Card */}
      {showSMSAnalytics && smsStats && (
        <section className="card mt-6 p-4 sm:p-5 border-amber-200 bg-amber-50/15">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-3.5 mb-3.5">
            <div>
              <h3 className="text-sm font-bold text-slate-950 flex items-center gap-2">
                <Send className="h-4 w-4 text-amber-600" />
                Communication System Summary
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Real-time status of system-generated notifications and member alerts</p>
            </div>
            <Link href="/sms" className="btn btn-ghost btn-sm text-amber-700 hover:text-amber-800 self-start sm:self-auto">
              Open SMS Hub <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {[
              { label: 'SMS Sent Today', value: smsStats.todaySent ?? 0, color: 'text-emerald-700' },
              { label: 'Pending SMS', value: smsStats.pending ?? 0, color: 'text-amber-700' },
              { label: 'Sent This Month', value: smsStats.monthlySent ?? 0, color: 'text-blue-700' },
              { label: 'Notification Queue', value: smsStats.notificationQueue ?? smsStats.pending ?? 0, color: 'text-violet-700' },
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

      {/* Expiry alerts and biometric status tabbed overview */}
      <ExpiryAndBiometricsSection 
        expiringToday={expiringToday}
        expiringIn3Days={expiringIn3Days}
        expiredMembers={expiredMembers}
        disabledBiometrics={disabledBiometrics}
      />

      {/* Dynamic Visualizations, Monthly Revenue & Expiring Alerts */}
      {showRevenueAnalytics && (
        <>
          <MonthlyRevenueSection invoices={invoices} />
          <DashboardChartsSection revenueData={revenueData} pieData={pieData} />
        </>
      )}

      {/* Attendance Trend Widget & Expiry warnings list */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Hourly distribution peak log */}
        {showAttendanceAnalytics && (
          <AttendancePeakSection hourlyDistribution={attendance?.hourlyDistribution ?? []} />
        )}

        {/* Expiring memberships roster */}
        <ExpiringMembersList
          members={expiringMembersList}
          expiringSoon={expiringSoon}
          showAttendanceAnalytics={showAttendanceAnalytics}
        />
      </div>

      <div className="mt-6">
        <RecentMembers members={recentMembers} />
      </div>
    </div>
  );
}
