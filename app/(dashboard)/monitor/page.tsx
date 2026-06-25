'use client';

import { useEffect, useState } from 'react';
import { Clock, Dumbbell, Fingerprint, ShieldAlert, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { getMemberById, getMemberByBiometricId } from '@/lib/actions/members';
import { getTodayMonitorLogs } from '@/lib/actions/attendance';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/Primitives';
import { getMembershipExpiry, formatDate } from '@/lib/utils';
import { Member } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';

interface LiveMonitorLog {
  id: string;
  member_id: string;
  member_name: string;
  biometric_user_id: string;
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
        const logsWithMembers = await getTodayMonitorLogs();
        setLogs(logsWithMembers as any);
        if (logsWithMembers.length > 0) {
          setLastCheckin(logsWithMembers[0] as any);
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
        async (payload: any) => {
          const newLog = payload.new as any;
          try {
            const memberInfo = await getMemberByBiometricId(newLog.member_id);
            const cleanId = newLog.member_id ? newLog.member_id.replace(/[^0-9]/g, '') : '';
            
            // Play checkin status tone (high for active, low for expired/unmatched)
            if (typeof window !== 'undefined') {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(memberInfo?.status === 'Active' ? 880 : 330, audioCtx.currentTime);
              gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.15);
            }

            setLogs((prev) => {
              const punch_type = prev.filter(l => l.biometric_user_id === cleanId).length % 2 === 0 ? 'checkin' : 'checkout';
              const enrichedLog = {
                id: newLog.id,
                member_id: memberInfo ? memberInfo.id : newLog.member_id,
                member_name: memberInfo ? memberInfo.full_name : `Unknown Member (${newLog.member_id})`,
                biometric_user_id: cleanId,
                punch_time: newLog.created_at || newLog.punch_time,
                punch_type,
                member: memberInfo
              };
              
              setLastCheckin(enrichedLog as any);
              return [enrichedLog as any, ...prev.slice(0, 19)];
            });
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

  // Calculate days remaining helper
  const getDaysInfo = (member?: Member | null) => {
    if (!member || !member.package_end_date) return null;
    const expiry = new Date(member.package_end_date);
    if (isNaN(expiry.getTime())) return null;
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

      {loading ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Card Skeleton */}
          <div className="lg:col-span-2">
            <div className="card flex flex-col items-center justify-center p-8 text-center min-h-[380px] bg-white border-slate-200">
              <Skeleton className="h-40 w-40 rounded-full" />
              <Skeleton className="h-8 w-48 mt-6" />
              <Skeleton className="h-4 w-32 mt-2" />
              <Skeleton className="h-10 w-44 rounded-full mt-6" />
              <div className="mt-8 border-t border-slate-200 pt-4 w-full grid grid-cols-2 gap-4 max-w-sm">
                <div>
                  <Skeleton className="h-3 w-16 mx-auto" />
                  <Skeleton className="h-4.5 w-24 mt-1.5 mx-auto" />
                </div>
                <div>
                  <Skeleton className="h-3 w-16 mx-auto" />
                  <Skeleton className="h-4.5 w-24 mt-1.5 mx-auto" />
                </div>
              </div>
            </div>
          </div>
          {/* Scroll List Skeletons */}
          <div>
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="card p-4 flex items-center justify-between gap-3 bg-white border-slate-200">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-14 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Main Check-In Focal Card */}
          <div className="lg:col-span-2">
            {lastCheckin ? (
              (() => {
                const memberName =
                  (lastCheckin?.member as any)?.name ||
                  lastCheckin?.member?.full_name ||
                  lastCheckin?.member_name ||
                  "Unknown Member";
                const isMemberActive = lastCheckin?.member?.status === 'Active';
                const memberStatus = lastCheckin?.member?.status || 'Expired';

                return (
                  <div
                    className={`card flex flex-col items-center justify-center p-6 text-center border-2 transition-all duration-300 ${
                      isMemberActive
                        ? 'border-emerald-500 bg-emerald-50/20'
                        : 'border-rose-500 bg-rose-50/20'
                    }`}
                  >
                    <div className="relative">
                      <Avatar
                        src={lastCheckin?.member?.profile_photo}
                        name={memberName}
                        size="xl"
                        className={`h-40 w-40 border-4 ${
                          isMemberActive ? 'border-emerald-500' : 'border-rose-500'
                        }`}
                      />
                      <div className="absolute -bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-amber-300 shadow">
                        <Fingerprint className="h-5 w-5" />
                      </div>
                    </div>

                    <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-slate-950">
                      {memberName}
                    </h2>
                    <p className="mt-1 font-mono text-sm text-slate-500">
                      Biometric User ID: {lastCheckin?.biometric_user_id || "—"}
                    </p>

                    {/* Status Alert Area */}
                    <div className="mt-6 flex flex-col items-center">
                      {isMemberActive ? (
                        <div className="flex items-center gap-2 rounded-full bg-emerald-100 px-5 py-2 text-sm font-bold text-emerald-800">
                          <ShieldCheck className="h-5 w-5" /> MEMBER ACTIVE
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 rounded-full bg-rose-100 px-5 py-2 text-sm font-bold text-rose-800">
                          <ShieldAlert className="h-5 w-5" /> DANGER: MEMBER {(memberStatus || 'EXPIRED').toUpperCase()}
                        </div>
                      )}

                      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-4 text-left min-w-[280px]">
                        <div>
                          <p className="metric-label">Package</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {lastCheckin?.member?.package_name || '—'}
                          </p>
                        </div>
                        <div>
                          <p className="metric-label">Check-in time</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {lastCheckin?.punch_time ? new Date(lastCheckin.punch_time).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            }) : '—'}
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
                );
              })()
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
              {(logs || []).map((log) => {
                const memberName =
                  (log?.member as any)?.name ||
                  log?.member?.full_name ||
                  log?.member_name ||
                  "Unknown Member";
                const isMemberActive = log?.member?.status === 'Active';
                const memberStatus = log?.member?.status || 'Expired';
                
                return (
                  <div
                    key={log?.id || Math.random().toString()}
                    onClick={() => setLastCheckin(log)}
                    className={`card p-4 flex items-center justify-between gap-3 cursor-pointer transition-colors duration-150 hover:bg-slate-50 ${
                      lastCheckin?.id === log?.id ? 'border-amber-300 bg-amber-50/10' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar src={log?.member?.profile_photo} name={memberName} size="md" />
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                          {memberName}
                        </h4>
                        <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                          <Clock className="h-3.5 w-3.5" />
                          {log?.punch_time ? new Date(log.punch_time).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          }) : '—'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <span
                        className={`badge text-[10px] ${
                          isMemberActive ? 'badge-active' : 'badge-inactive'
                        }`}
                      >
                        {memberStatus}
                      </span>
                    </div>
                  </div>
                );
              })}

              {logs.length === 0 && (
                <div className="card p-8 text-center text-xs text-slate-400">
                  No entries recorded today yet.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
