'use client';

import { useEffect, useState } from 'react';
import { Clock, Dumbbell, Fingerprint, ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMemberById } from '@/lib/actions/members';
import { getTodayAttendanceLogs } from '@/lib/actions/attendance';
import { Avatar } from '@/components/ui/Avatar';
import { LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { getMembershipExpiry, formatDate } from '@/lib/utils';
import { Member } from '@/types';

interface LiveMonitorLog {
  id: string;
  member_id: string;
  member_name: string;
  device_user_id: string;
  punch_time: string;
  punch_type: string;
  member?: Member | null;
}

export default function CheckinMonitorPage() {
  const [logs, setLogs] = useState<LiveMonitorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheckin, setLastCheckin] = useState<LiveMonitorLog | null>(null);

  // Load initial logs on mount
  useEffect(() => {
    async function loadInitialData() {
      try {
        const todayLogs = await getTodayAttendanceLogs();
        
        // Fetch detailed member info for today's logs to show photo/expiry info
        const logsWithMembers = await Promise.all(
          todayLogs.slice(0, 10).map(async (log) => {
            const memberInfo = await getMemberById(log.member_id);
            return { ...log, member: memberInfo };
          })
        );
        
        setLogs(logsWithMembers);
        if (logsWithMembers.length > 0) {
          setLastCheckin(logsWithMembers[0]);
        }
      } catch (err) {
        console.error('Failed to load check-in monitor logs:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
  }, []);

  // Listen to live database changes via Supabase Realtime
  useEffect(() => {
    const supabase = createClient();
    
    const channel = supabase
      .channel('realtime:attendance_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'attendance_logs' },
        async (payload) => {
          const newLog = payload.new as any;
          try {
            const memberInfo = await getMemberById(newLog.member_id);
            const enrichedLog = { ...newLog, member: memberInfo };
            
            // Push to the logs history and update the focal card
            setLogs((prev) => [enrichedLog, ...prev.slice(0, 19)]); // keep last 20
            setLastCheckin(enrichedLog);

            // Optional: Play a short checkin sound if supported
            if (typeof window !== 'undefined') {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(memberInfo?.status === 'Active' ? 880 : 330, audioCtx.currentTime); // high tone for active, low for expired/risk
              gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.15);
            }
          } catch (err) {
            console.error('Error handling realtime log payload:', err);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <LoadingSpinner size={40} />;

  // Calculate days remaining helper
  const getDaysInfo = (member?: Member | null) => {
    if (!member) return null;
    const expiry = getMembershipExpiry(member.join_date, member.membership_plan);
    const now = new Date();
    const diff = expiry.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    const isExpired = days < 0;
    return { days: Math.abs(days), isExpired, expiryDate: expiry };
  };

  const focusDaysInfo = getDaysInfo(lastCheckin?.member);

  return (
    <div className="page page-enter">
      <PageHeader
        title="Check-in monitor"
        subtitle="Live fullscreen monitor for front-desk attendance verification and status audits."
        action={
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-emerald-600 animate-ping" />
            Live biometric sync online
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Check-In Focal Card */}
        <div className="lg:col-span-2">
          {lastCheckin ? (
            <div
              className={`card flex flex-col items-center justify-center p-6 text-center border-2 transition-all duration-300 ${
                lastCheckin.member?.status === 'Active'
                  ? 'border-emerald-500 bg-emerald-50/20'
                  : 'border-rose-500 bg-rose-50/20'
              }`}
            >
              <div className="relative">
                <Avatar
                  src={lastCheckin.member?.profile_photo}
                  name={lastCheckin.member_name}
                  size="xl"
                  className={`h-40 w-40 border-4 ${
                    lastCheckin.member?.status === 'Active' ? 'border-emerald-500' : 'border-rose-500'
                  }`}
                />
                <div className="absolute -bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-amber-300 shadow">
                  <Fingerprint className="h-5 w-5" />
                </div>
              </div>

              <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950">
                {lastCheckin.member_name}
              </h2>
              <p className="mt-1 font-mono text-sm text-slate-500">
                Device user ID: {lastCheckin.device_user_id}
              </p>

              {/* Status Alert Area */}
              <div className="mt-6 flex flex-col items-center">
                {lastCheckin.member?.status === 'Active' ? (
                  <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-800">
                    <ShieldCheck className="h-5 w-5" /> MEMBER ACTIVE
                  </div>
                ) : (
                  <div className="flex items-center gap-2 rounded-full bg-rose-100 px-5 py-2 text-sm font-bold text-rose-800">
                    <ShieldAlert className="h-5 w-5" /> DANGER: MEMBER {lastCheckin.member?.status?.toUpperCase() || 'EXPIRED'}
                  </div>
                )}

                <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4 text-left min-w-[280px]">
                  <div>
                    <p className="metric-label">Membership plan</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {lastCheckin.member?.membership_plan || '—'}
                    </p>
                  </div>
                  <div>
                    <p className="metric-label">Check-in time</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {new Date(lastCheckin.punch_time).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </p>
                  </div>
                </div>

                {/* Expiry Details */}
                {focusDaysInfo && (
                  <div className="mt-4 rounded-xl bg-white/60 border border-slate-100 p-3 text-center w-full">
                    {focusDaysInfo.isExpired ? (
                      <p className="text-xs font-semibold text-rose-700">
                        Expired by {focusDaysInfo.days} day(s) on {formatDate(focusDaysInfo.expiryDate)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-slate-700">
                        {focusDaysInfo.days} day(s) remaining (Expires {formatDate(focusDaysInfo.expiryDate)})
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center p-20 text-center text-slate-400">
              <Dumbbell className="h-12 w-12 text-slate-300 animate-bounce mb-4" />
              <p className="card-title">Waiting for biometric punch...</p>
              <p className="small-text mt-1">Please check in members at the biometric gate.</p>
            </div>
          )}
        </div>

        {/* Live Scroll Sidebar List */}
        <div>
          <div className="mb-4">
            <h2 className="section-title">Live entries scroll</h2>
            <p className="section-description">Chronological order of check-ins</p>
          </div>

          <div className="page-stack max-h-[500px] overflow-y-auto pr-1">
            {logs.map((log) => (
              <div
                key={log.id}
                onClick={() => setLastCheckin(log)}
                className={`card p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors duration-150 hover:bg-slate-50 ${
                  lastCheckin?.id === log.id ? 'border-amber-300 bg-amber-50/10' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <Avatar src={log.member?.profile_photo} name={log.member_name} size="md" />
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                      {log.member_name}
                    </h4>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <Clock className="h-3 w-3" />
                      {new Date(log.punch_time).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
                <div>
                  <span
                    className={`badge text-[10px] ${
                      log.member?.status === 'Active' ? 'badge-active' : 'badge-inactive'
                    }`}
                  >
                    {log.member?.status || 'Expired'}
                  </span>
                </div>
              </div>
            ))}

            {logs.length === 0 && (
              <div className="card p-8 text-center text-xs text-slate-400">
                No entries recorded today yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
