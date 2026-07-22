'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  Activity, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  Cpu, 
  Terminal, 
  Play, 
  TrendingUp, 
  Settings, 
  ArrowRight,
  ShieldAlert,
  Loader2
} from 'lucide-react';
import { PageHeader, SectionCard } from '@/components/ui/Primitives';
import { getBiometricMetrics, BiometricMetrics } from '@/lib/actions/biometric-commands';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function BiometricCommandCenterPage() {
  const [metrics, setMetrics] = useState<BiometricMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async (showToast = false) => {
    try {
      if (showToast) setRefreshing(true);
      const data = await getBiometricMetrics();
      setMetrics(data);
      if (showToast) {
        toast.success('Metrics updated successfully');
      }
    } catch (err: any) {
      console.error('Error loading metrics:', err);
      toast.error('Failed to load biometric metrics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();

    // Subscribe to realtime database changes on biometric_actions
    const supabase = createClient();
    const channel = supabase
      .channel('biometric_actions_command_center')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'biometric_actions' },
        (payload: any) => {
          console.log('Realtime change in biometric_actions:', payload);
          // Re-fetch metrics immediately when status changes
          fetchMetrics();
          
          // Trigger browser notification / toast
          if (payload.eventType === 'UPDATE') {
            const oldStatus = payload.old?.status;
            const newStatus = payload.new?.status;
            const actionType = payload.new?.action;
            
            if (oldStatus !== newStatus) {
              const msgMap: Record<string, string> = {
                sent: `Command Sent to device`,
                executing: `Device Executing command`,
                verifying: `Verification Started...`,
                completed: `Verification Passed!`,
                failed: `Verification Failed: ${payload.new?.error_message || 'Device error'}`
              };

              const toastMsg = msgMap[newStatus];
              if (toastMsg) {
                if (newStatus === 'completed') {
                  toast.success(toastMsg);
                } else if (newStatus === 'failed') {
                  toast.error(toastMsg);
                } else {
                  toast.info(toastMsg);
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const formatAbsoluteTime = (isoString: string | null | undefined): string => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 text-amber-500 animate-spin" />
        <p className="text-sm font-semibold text-slate-600">Loading Command Center data...</p>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Pending Commands',
      value: metrics?.pendingCount ?? 0,
      desc: 'Sent/waiting for Sync Agent',
      icon: <Clock className="h-5 w-5 text-amber-600 animate-pulse" />,
      colorClass: 'border-amber-100 bg-amber-50/10 text-amber-950',
    },
    {
      title: 'Executing',
      value: metrics?.executingCount ?? 0,
      desc: 'Running physically on device',
      icon: <Activity className="h-5 w-5 text-blue-600 animate-spin" style={{ animationDuration: '3s' }} />,
      colorClass: 'border-blue-100 bg-blue-50/10 text-blue-955',
    },
    {
      title: 'Verifying State',
      value: metrics?.verifyingCount ?? 0,
      desc: 'Awaiting push state query confirmation',
      icon: <TrendingUp className="h-5 w-5 text-purple-600" />,
      colorClass: 'border-purple-100 bg-purple-50/10 text-purple-955',
    },
    {
      title: 'Completed (Verified)',
      value: metrics?.completedCount ?? 0,
      desc: 'Successfully verified on terminal',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
      colorClass: 'border-emerald-100 bg-emerald-50/10 text-emerald-955',
    },
    {
      title: 'Failed Commands',
      value: metrics?.failedCount ?? 0,
      desc: 'Failed verification checks',
      icon: <XCircle className="h-5 w-5 text-rose-600" />,
      colorClass: 'border-rose-100 bg-rose-50/10 text-rose-955',
    },
  ];

  return (
    <div className="page page-wide page-enter select-none">
      
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 select-none">
            <Link href="/devices" className="hover:text-slate-655 transition-colors">
              Device Management
            </Link>
            <span>/</span>
            <span className="text-amber-500">Command Center</span>
          </div>
          <h1 className="page-title text-slate-900 font-extrabold text-2xl tracking-tight">Biometric Command Center</h1>
          <p className="page-subtitle text-slate-500 text-sm mt-0.5">Real-time terminal execution log, active command state flow, and latency metrics dashboard.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing}
            className="btn btn-secondary flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh Data
          </button>
          <Link href="/devices/inspector" className="btn btn-primary flex items-center gap-2 text-xs font-bold shadow-md shadow-amber-500/10">
            <Terminal className="h-3.5 w-3.5" /> Open Command Inspector <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      {/* Sync Status Info Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
            <RefreshCw className="h-5.5 w-5.5 animate-pulse" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sync Agent Last Heartbeat</span>
            <p className="font-extrabold text-slate-900 text-sm mt-1 select-text">
              {metrics?.lastSyncTime ? formatAbsoluteTime(metrics.lastSyncTime) : 'Offline / Never'}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
            <Cpu className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Connected Terminals</span>
            <p className="font-extrabold text-slate-900 text-sm mt-1 select-text">
              {metrics?.connectedDevicesCount ?? 0} active device(s) online
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-sm flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-500">
            <Clock className="h-5.5 w-5.5" />
          </div>
          <div>
            <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average Latency</span>
            <p className="font-extrabold text-slate-900 text-sm mt-1 select-text">
              {metrics?.avgExecutionTimeMs ? `${(metrics.avgExecutionTimeMs / 1000).toFixed(2)} seconds` : 'No metrics yet'}
            </p>
          </div>
        </div>
      </div>

      {/* Core Command Status Grid */}
      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3.5 pl-1">Live Command Queues</h3>
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-6">
        {statCards.map((card, i) => (
          <div key={i} className={cn("card p-4.5 border transition-all flex flex-col justify-between shadow-sm hover:border-slate-300", card.colorClass)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{card.title}</span>
              {card.icon}
            </div>
            <div className="mt-4">
              <p className="text-3xl font-black tracking-tight">{card.value}</p>
              <span className="block text-[9px] text-slate-400 font-medium mt-1 leading-snug">{card.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Latency & Last Response */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <SectionCard
            title="Biometric Sync Flow Metrics"
            description="Real-time terminal execution stats analysis."
            icon={<TrendingUp className="h-5 w-5" />}
          >
            <div className="py-8 text-center text-slate-400">
              <Cpu className="h-10 w-10 mx-auto text-slate-300 mb-3" />
              <p className="text-xs font-semibold text-slate-600">Verification Engine Running</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                Commands are pushed using eSSL push SDK protocols. Latency monitors queue speed through polling cycles.
              </p>
            </div>
          </SectionCard>
        </div>

        <div className="lg:col-span-1">
          <SectionCard
            title="Last Device Response"
            description="Incoming payload logs from terminals."
            icon={<Terminal className="h-5 w-5" />}
          >
            {metrics?.lastDeviceResponse ? (
              <div className="rounded-xl border border-slate-200/60 bg-slate-50/50 p-4.5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Live Stream Data</span>
                </div>
                <pre className="font-mono text-[10.5px] leading-relaxed text-slate-700 bg-slate-900 text-zinc-100 p-3.5 rounded-lg overflow-x-auto shadow-inner select-text">
                  {metrics.lastDeviceResponse}
                </pre>
              </div>
            ) : (
              <div className="py-12 border border-dashed border-slate-200 rounded-xl text-center text-slate-400 bg-slate-50/20">
                <Terminal className="h-8 w-8 mx-auto text-slate-300 mb-2.5" />
                <p className="text-xs font-semibold text-slate-600">No responses recorded yet</p>
                <p className="text-[10px] text-slate-400 mt-1">Verify agent is online and attendance punches or sync requests are active.</p>
              </div>
            )}
          </SectionCard>
        </div>
      </div>

    </div>
  );
}
