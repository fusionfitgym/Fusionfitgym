'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTSessions, markPTSessionAttendance } from '@/lib/actions/pt';
import { PTSession } from '@/types/pt';
import { toast } from 'sonner';
import { Dumbbell, Clock, HardHat, Check, X, Calendar, UserCheck } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export default function PTAttendancePage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [loading, setLoading] = useState(true);

  const isTrainer = profile?.role === 'Trainer';

  const loadData = async () => {
    setLoading(true);
    try {
      let allSessions: PTSession[] = [];
      if (isDemo) {
        allSessions = demo.getPTSessions();
      } else {
        allSessions = await getPTSessions();
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const filtered = allSessions.filter(s => {
        if (isTrainer) {
          const isAssignedTrainer = s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer';
          if (!isAssignedTrainer) return false;
        }
        
        return s.session_date === todayStr || (s.session_date < todayStr && s.status === 'Scheduled');
      });

      setSessions(filtered);
    } catch (err: any) {
      toast.error('Failed to load sessions: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptSessions]);

  const handleMarkAttendance = async (
    sessId: string, 
    clientId: string, 
    trainerId: string, 
    date: string,
    status: 'Present' | 'Absent' | 'Cancelled' | 'Late'
  ) => {
    try {
      if (isDemo) {
        demo.markPTSessionAttendance(sessId, clientId, trainerId, date, status);
        toast.success(`Marked client attendance as ${status} (Demo)`);
      } else {
        const res = await markPTSessionAttendance(sessId, clientId, trainerId, date, status);
        if (res.error) throw new Error(res.error);
        toast.success(`Marked client attendance as ${status}!`);
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to mark attendance');
    }
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="PT Client Attendance"
        subtitle="Mark check-in attendance for scheduled personal sessions. Remaining package sessions decrease automatically."
      />

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200/80 rounded-2xl shadow-sm">
          <UserCheck className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-bold text-slate-800">All caught up!</h3>
          <p className="mt-1.5 text-sm text-slate-500">No personal sessions scheduled for today require marking.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((sess) => (
            <div key={sess.id} className="bg-white border border-slate-200/80 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm hover:border-amber-300 transition-all">
              <div className="flex items-start gap-3.5">
                <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800 font-bold">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-base">{sess.client?.full_name}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs font-medium text-slate-600">
                    <span className="flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-slate-400" /> Trainer: <strong className="text-slate-800">{sess.trainer?.full_name}</strong></span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> Time: <strong className="text-slate-800">{sess.session_time}</strong> ({sess.duration} mins)</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-slate-400" /> Date: <strong className="text-slate-800">{formatDate(sess.session_date)}</strong></span>
                  </div>
                  {sess.workout_plan && (
                    <p className="text-xs font-mono text-slate-700 bg-slate-50 border border-slate-200/70 p-2.5 rounded-xl mt-2.5 max-w-xl">
                      Plan: {sess.workout_plan}
                    </p>
                  )}
                </div>
              </div>

              {/* Attendance Marking Buttons */}
              <div className="flex flex-wrap gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Present')}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 shadow-md shadow-amber-200/50"
                >
                  <Check className="h-3.5 w-3.5" /> Present
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Late')}
                  className="btn btn-secondary btn-sm text-amber-700 hover:text-amber-800 flex items-center gap-1.5"
                >
                  Late
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Absent')}
                  className="btn btn-secondary btn-sm text-rose-600 hover:text-rose-700 flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" /> Absent
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Cancelled')}
                  className="btn btn-secondary btn-sm text-slate-500 hover:text-slate-700"
                >
                  Cancelled
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
