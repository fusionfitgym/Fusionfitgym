'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Dumbbell,
  FileText,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Send,
  HardHat,
} from 'lucide-react';

import { useDemoState } from '@/components/auth/DemoStateProvider';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentMembers } from '@/components/dashboard/RecentMembers';
import { ExpiringMembersList } from '@/components/dashboard/ExpiringMembersList';
import { formatCurrency, formatDate, cn } from '@/lib/utils';
import DashboardChartsSection from '@/components/dashboard/DashboardChartsSection';
import AttendancePeakSection from '@/components/dashboard/AttendancePeakSection';

export default function DashboardClientPage() {
  const { members, invoices, trainers, expenses, callLogs, notifications, attendance, getAttendanceAnalytics, getStaffStats, getStaffAttendanceTodayStats } = useDemoState();

  const analytics = useMemo(() => getAttendanceAnalytics(), [attendance, getAttendanceAnalytics]);

  // Compute stats client side
  const total = members.length;
  const active = members.filter((m) => m.status === 'Active').length;
  
  const now = new Date(2026, 5, 30); // Demo reference date (June 30, 2026)
  
  const expiringSoon = useMemo(() => {
    return members.filter((member) => {
      if (!member || member.status !== 'Active' || !member.package_end_date) return false;
      const expiry = new Date(member.package_end_date);
      if (isNaN(expiry.getTime())) return false;
      const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff >= 0 && diff <= 7;
    }).length;
  }, [members]);

  const monthlyRevenue = useMemo(() => {
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return invoices
      .filter((invoice) => invoice && invoice.status === 'Paid' && invoice.created_at && new Date(invoice.created_at) >= thirtyDaysAgo)
      .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
  }, [invoices, now]);

  const dailyPassMembers = members.filter((m) => m.duration === 'Daily Pass' && m.status === 'Active').length;
  const activeMonthlyMembers = members.filter((m) => m.duration !== 'Daily Pass' && m.status === 'Active').length;
  const weightTrainingOnlyMembers = members.filter((m) => m.training_type === 'Weight Training Only' && m.status === 'Active').length;
  const cardioStrengthMembers = members.filter((m) => m.training_type !== 'Weight Training Only' && m.status === 'Active').length;

  // Chart data formatting
  const pieData = useMemo(() => {
    const planCounts: Record<string, number> = {};
    members.forEach((member) => {
      if (member && member.package_name) {
        planCounts[member.package_name] = (planCounts[member.package_name] ?? 0) + 1;
      }
    });
    return Object.entries(planCounts).map(([name, value]) => ({ name, value }));
  }, [members]);

  const revenueData = useMemo(() => {
    return Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(2026, 5, 30);
      date.setMonth(date.getMonth() - (5 - index));
      const start = new Date(date.getFullYear(), date.getMonth(), 1);
      const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      const revenue = invoices
        .filter((invoice) => {
          if (!invoice || !invoice.created_at) return false;
          const createdAt = new Date(invoice.created_at);
          return invoice.status === 'Paid' && createdAt >= start && createdAt <= end;
        })
        .reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);

      return {
        month: date.toLocaleString('en-IN', { month: 'short' }),
        revenue,
      };
    });
  }, [invoices]);

  const expiringMembersList = useMemo(() => {
    return members
      .filter((m) => {
        if (!m || m.status !== 'Active' || !m.package_end_date) return false;
        const expiry = new Date(m.package_end_date);
        if (isNaN(expiry.getTime())) return false;
        const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= 0 && diff <= 7;
      })
      .map((m) => {
        const expiry = new Date(m.package_end_date);
        const diff = expiry.getTime() - now.getTime();
        const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
        return { ...m, daysRemaining: isNaN(days) ? 0 : days, expiryDate: expiry };
      })
      .sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0))
      .slice(0, 5);
  }, [members]);

  const quickActions = [
    { href: '/members/add', label: 'Add member', description: 'Create a member profile', icon: UserPlus },
    { href: '/invoices/new', label: 'Create invoice', description: 'Record a payment', icon: FileText },
    { href: '/health/new', label: 'Health assessment', description: 'Capture fitness metrics', icon: Dumbbell },
    { href: '/parq/new', label: 'New PAR-Q form', description: 'Readiness screening', icon: ClipboardList },
  ];

  return (
    <div className="page page-enter">
      <header className="page-header">
        <div className="page-header-copy">
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Welcome back, Demo Admin. Here is your management view.</p>
        </div>
        <div className="page-actions">
          <Link href="/members/add" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Add member
          </Link>
        </div>
      </header>

      {/* Adaptive Stats Grid */}
      <div className="grid grid-cols-1 gap-4 lg:gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total members"
          value={total}
          icon={<Users className="h-5 w-5" />}
          subtitle="All registered members"
          accent
        />
        <StatCard
          title="Live occupancy"
          value={analytics.occupancy}
          icon={<Activity className="h-5 w-5 text-emerald-600 animate-pulse" />}
          subtitle="Members inside gym now"
        />
        <StatCard
          title="Today's check-ins"
          value={analytics.checkins}
          icon={<UserCheck className="h-5 w-5" />}
          subtitle="Biometric punches logged today"
        />
        <StatCard
          title="Monthly revenue"
          value={formatCurrency(monthlyRevenue)}
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle="Paid invoices (last 30 days)"
        />
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

      {/* Staff Stats Row */}
      {(() => {
        const staffStats = getStaffStats();
        const staffAttendanceToday = getStaffAttendanceTodayStats();
        return (
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="col-span-2 lg:col-span-4 flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">🏋️ Staff Overview</span>
            </div>
            <StatCard title="Total Staff" value={staffStats.total} icon={<Users className="h-5 w-5 text-violet-500" />} subtitle="All registered staff" />
            <StatCard title="Trainers" value={staffStats.trainers} icon={<Dumbbell className="h-5 w-5 text-amber-500" />} subtitle="Registered trainers" />
            <StatCard title="Janitors" value={staffStats.janitors} icon={<Users className="h-5 w-5 text-blue-500" />} subtitle="Maintenance staff" />
            <StatCard title="Active Staff" value={staffStats.active} icon={<UserCheck className="h-5 w-5 text-emerald-500" />} subtitle="Currently active employees" />

            {/* Staff Attendance Row */}
            <div className="mt-2 col-span-2 lg:col-span-4 flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Staff Attendance Today</span>
            </div>
            <StatCard title="Staff Present Today" value={staffAttendanceToday.present} icon={<UserCheck className="h-5 w-5 text-emerald-500" />} subtitle="Staff punched in today" />
            <StatCard title="Trainers Present" value={staffAttendanceToday.trainers} icon={<Users className="h-5 w-5 text-amber-500" />} subtitle="Trainers punched in today" />
            <StatCard title="Janitors Present" value={staffAttendanceToday.janitors} icon={<HardHat className="h-5 w-5 text-blue-500" />} subtitle="Janitors punched in today" />
            <StatCard title="Total Staff Attendance Today" value={`${staffAttendanceToday.present} / ${staffStats.total}`} icon={<Activity className="h-5 w-5 text-violet-500" />} subtitle="Punched in / Total active" />
          </div>
        );
      })()}

      {/* SMS Summary Card */}
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
            { label: 'SMS Sent Today', value: 3, color: 'text-emerald-700' },
            { label: 'Pending SMS', value: 2, color: 'text-amber-700' },
            { label: 'Sent This Month', value: 45, color: 'text-blue-700' },
            { label: 'Notification Queue', value: 2, color: 'text-violet-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white/70 backdrop-blur-sm rounded-xl p-3 border border-slate-200/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">{label}</span>
              <span className={cn('span font-extrabold block mt-1 tracking-tight', color)}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section className="mt-6">
        <div className="mb-4">
          <h2 className="section-title">Quick actions</h2>
          <p className="section-description">Common workflows, one click away</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Dynamic Visualizations & Expiring Alerts */}
      <DashboardChartsSection revenueData={revenueData} pieData={pieData} />

      {/* Attendance Trend Widget & Expiry warnings list */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Hourly distribution peak log */}
        <AttendancePeakSection hourlyDistribution={analytics.hourlyDistribution} />

        {/* Expiring memberships roster */}
        <ExpiringMembersList
          members={expiringMembersList as any}
          expiringSoon={expiringSoon}
          showAttendanceAnalytics={true}
        />
      </div>

      <div className="mt-6">
        <RecentMembers members={members.slice(0, 5) as any} />
      </div>
    </div>
  );
}
