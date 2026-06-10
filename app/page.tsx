'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, UserCheck, AlertTriangle, TrendingUp, Dumbbell, UserPlus, FileText, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatCard } from '@/components/dashboard/StatCard';
import { RecentMembers } from '@/components/dashboard/RecentMembers';
import { LoadingSpinner } from '@/components/ui/Primitives';
import { getMembers } from '@/lib/actions/members';
import { getInvoices } from '@/lib/actions/invoices';
import { Member, Invoice } from '@/types';
import { formatCurrency, isExpiringSoon } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const PLAN_COLORS: Record<string, string> = {
  Monthly:   '#FFD700',
  Quarterly: '#FFA500',
  Biannual:  '#FF8C00',
  Annual:    '#E6C200',
};

export default function DashboardPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getMembers(), getInvoices()])
      .then(([m, i]) => { setMembers(m); setInvoices(i); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner size={40} />;

  const total = members.length;
  const active = members.filter(m => m.status === 'Active').length;
  const expiringSoon = members.filter(m => m.status === 'Active' && isExpiringSoon(m.join_date, m.membership_plan)).length;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyRevenue = invoices
    .filter(i => i.status === 'Paid' && new Date(i.created_at) >= monthStart)
    .reduce((sum, i) => sum + Number(i.amount), 0);

  // Plan distribution
  const planCounts: Record<string, number> = {};
  members.forEach(m => { planCounts[m.membership_plan] = (planCounts[m.membership_plan] ?? 0) + 1; });
  const pieData = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

  // Monthly revenue bar chart (last 6 months)
  const barData = Array.from({ length: 6 }).map((_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    const label = d.toLocaleString('en-IN', { month: 'short' });
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const rev = invoices
      .filter(inv => inv.status === 'Paid' && new Date(inv.created_at) >= start && new Date(inv.created_at) <= end)
      .reduce((sum, inv) => sum + Number(inv.amount), 0);
    return { month: label, revenue: rev };
  });

  const quickActions = [
    { href: '/members/add',  label: 'Add Member',         icon: UserPlus,     bg: 'bg-amber-50',   iconColor: 'text-amber-500' },
    { href: '/invoices/new', label: 'Create Invoice',     icon: FileText,     bg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
    { href: '/health/new',   label: 'Health Assessment',  icon: Dumbbell,     bg: 'bg-blue-50',    iconColor: 'text-blue-500'  },
    { href: '/parq/new',     label: 'New PAR-Q Form',     icon: ClipboardList,bg: 'bg-purple-50',  iconColor: 'text-purple-500'},
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-page-title">Dashboard</h1>
        <p className="text-slate-500 mt-1 text-base font-medium">Welcome back — here&apos;s what&apos;s happening at FusionFit Gym.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Members"
          value={total}
          icon={<Users className="w-6 h-6" />}
          subtitle="All registered"
          accent
          index={0}
        />
        <StatCard
          title="Active Members"
          value={active}
          icon={<UserCheck className="w-6 h-6" />}
          subtitle={`${total > 0 ? Math.round((active / total) * 100) : 0}% of total`}
          index={1}
        />
        <StatCard
          title="Expiring Soon"
          value={expiringSoon}
          icon={<AlertTriangle className="w-6 h-6" />}
          subtitle="Within 7 days"
          index={2}
        />
        <StatCard
          title="Monthly Revenue"
          value={formatCurrency(monthlyRevenue)}
          icon={<TrendingUp className="w-6 h-6" />}
          subtitle="Paid invoices"
          index={3}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {quickActions.map(({ href, label, icon: Icon, bg, iconColor }, i) => (
          <motion.div
            key={href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + i * 0.06 }}
          >
            <Link
              href={href}
              className="flex flex-col items-center gap-3 p-5 card card-hover transition-all duration-200"
            >
              <div className={`w-11 h-11 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${iconColor}`} />
              </div>
              <span className="text-xs font-semibold text-slate-700 text-center">{label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Charts + Recent Members */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="lg:col-span-2 card p-6"
        >
          <h2 className="font-bold text-slate-900 text-lg mb-6">Revenue (Last 6 Months)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94A3B8' }} />
              <YAxis tick={{ fontSize: 12, fill: '#94A3B8' }} />
              <Tooltip
                formatter={(value) => {
                  const numVal = typeof value === 'number' ? value : Number(value || 0);
                  return [formatCurrency(numVal), 'Revenue'];
                }}
                contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13, boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
              />
              <Bar dataKey="revenue" fill="#FFD700" radius={[6, 6, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="card p-6"
        >
          <h2 className="font-bold text-slate-900 text-lg mb-6">Membership Plans</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={PLAN_COLORS[entry.name] ?? '#FFD700'} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E5E7EB', fontSize: 13 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">No data yet</div>
          )}
        </motion.div>
      </div>

      {/* Recent Members */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.55 }}
      >
        <RecentMembers members={members} />
      </motion.div>
    </motion.div>
  );
}
