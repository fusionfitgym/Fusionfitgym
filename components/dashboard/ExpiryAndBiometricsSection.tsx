'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { 
  Calendar, 
  Clock, 
  Fingerprint, 
  ShieldAlert, 
  ExternalLink,
  Phone
} from 'lucide-react';
import { Member } from '@/types';
import { formatDate } from '@/lib/utils';

interface ExpiryAndBiometricsSectionProps {
  expiringToday: Member[];
  expiringIn3Days: Member[];
  expiredMembers: Member[];
  disabledBiometrics: Member[];
}

export function ExpiryAndBiometricsSection({
  expiringToday,
  expiringIn3Days,
  expiredMembers,
  disabledBiometrics
}: ExpiryAndBiometricsSectionProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'today' | '3days' | 'expired' | 'biometrics'>('today');

  // Real-time subscription to update the dashboard immediately when a biometric action is completed or updated
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('dashboard_realtime_expiry_biometrics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biometric_actions' },
        () => {
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const tabs = [
    {
      id: 'today',
      label: 'Expiring Today',
      count: expiringToday.length,
      icon: Clock,
      color: 'border-amber-500 text-amber-600 bg-amber-50/30',
      activeColor: 'bg-amber-500 text-white shadow-amber-200',
      data: expiringToday
    },
    {
      id: '3days',
      label: 'Expiring in 3 Days',
      count: expiringIn3Days.length,
      icon: Calendar,
      color: 'border-yellow-500 text-yellow-600 bg-yellow-50/30',
      activeColor: 'bg-yellow-500 text-white shadow-yellow-200',
      data: expiringIn3Days
    },
    {
      id: 'expired',
      label: 'Expired Members',
      count: expiredMembers.length,
      icon: ShieldAlert,
      color: 'border-rose-500 text-rose-600 bg-rose-50/30',
      activeColor: 'bg-rose-500 text-white shadow-rose-200',
      data: expiredMembers
    },
    {
      id: 'biometrics',
      label: 'Disabled Biometrics',
      count: disabledBiometrics.length,
      icon: Fingerprint,
      color: 'border-slate-500 text-slate-600 bg-slate-50/30',
      activeColor: 'bg-slate-800 text-white shadow-slate-200',
      data: disabledBiometrics
    }
  ];

  const currentTab = tabs.find(t => t.id === activeTab) || tabs[0];

  return (
    <section className="card p-5 sm:p-6 border border-slate-200 bg-white rounded-2xl shadow-sm mt-6">
      <div className="border-b border-slate-100 pb-4 mb-5">
        <h2 className="text-base font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
          <span>🔒</span> Membership Expiry & Biometric Access Status
        </h2>
        <p className="text-xs text-slate-500 mt-1">Real-time status overview and access controls for gym memberships</p>
      </div>

      {/* Tabs list */}
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:gap-4 mb-6">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-xs font-bold transition-all duration-200 text-left sm:flex-1 min-w-[160px] cursor-pointer ${
                isActive 
                  ? `${tab.activeColor} border-transparent shadow-md transform scale-[1.02]` 
                  : `border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50/50`
              }`}
            >
              <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <div className="min-w-0 flex-1">
                <span className="block text-[10px] uppercase font-bold tracking-wider opacity-90">{tab.label}</span>
                <span className="block text-base font-black mt-0.5">{tab.count}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Tab Panel Content */}
      <div className="bg-slate-50/40 border border-slate-150 rounded-xl p-4 min-h-[220px]">
        {currentTab.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="text-2xl mb-2">🎉</span>
            <h4 className="text-sm font-bold text-slate-800">All clear!</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">No members found matching {currentTab.label.toLowerCase()} at this moment.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200/80 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5 px-2">Member</th>
                  <th className="py-2.5 px-2">Phone</th>
                  <th className="py-2.5 px-2">Plan</th>
                  <th className="py-2.5 px-2">Expiry Date</th>
                  <th className="py-2.5 px-2">Biometric Status</th>
                  <th className="py-2.5 px-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentTab.data.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3 px-2 font-bold text-slate-900 flex items-center gap-2">
                      <div className="h-6 w-6 rounded-full bg-slate-200 text-[10px] font-black flex items-center justify-center text-slate-600 shrink-0">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[140px]" title={member.full_name}>{member.full_name}</span>
                    </td>
                    <td className="py-3 px-2 text-slate-600">
                      <a href={`tel:${member.phone}`} className="flex items-center gap-1 hover:text-amber-600 font-medium transition-colors">
                        <Phone className="h-3 w-3 shrink-0 text-slate-400" />
                        {member.phone}
                      </a>
                    </td>
                    <td className="py-3 px-2 text-slate-700 font-semibold truncate max-w-[150px]" title={member.package_name}>
                      {member.package_name}
                    </td>
                    <td className="py-3 px-2 text-slate-600 font-medium">
                      {formatDate(member.package_end_date)}
                    </td>
                    <td className="py-3 px-2">
                      <span className={`badge py-0.5 px-2 text-[10px] font-bold rounded-full border ${
                        member.biometric_status === 'DISABLED'
                          ? 'bg-rose-50 text-rose-700 border-rose-100'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                      }`}>
                        {member.biometric_status || 'ENABLED'}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Link href={`/members/${member.id}`} className="btn btn-secondary py-1 px-2.5 text-[10px] font-bold inline-flex items-center gap-1 hover:bg-slate-100 cursor-pointer">
                        View Profile <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
