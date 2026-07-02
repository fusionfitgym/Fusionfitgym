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

      // Filter: display scheduled sessions for today or past un-marked sessions
      const todayStr = new Date().toISOString().split('T')[0];
      const filtered = allSessions.filter(s => {
        // If trainer logs in, they only see their sessions
        if (isTrainer) {
          const isAssignedTrainer = s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer';
          if (!isAssignedTrainer) return false;
        }
        
        // Show today's sessions OR older sessions that are still pending 'Scheduled' status
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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950 border border-zinc-800">
          <UserCheck className="mx-auto h-12 w-12 text-zinc-600" />
          <h3 className="mt-4 text-lg font-bold text-zinc-100">All caught up!</h3>
          <p className="mt-2 text-zinc-400">No personal sessions scheduled for today require marking.</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((sess) => (
            <Card key={sess.id} className="bg-zinc-950 border border-zinc-800 p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300">
                  <Dumbbell className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-zinc-100">{sess.client?.full_name}</h4>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-zinc-400">
                    <span className="flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-zinc-500" /> Trainer: {sess.trainer?.full_name}</span>
                    <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-zinc-500" /> Time: {sess.session_time} ({sess.duration} mins)</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5 text-zinc-500" /> Date: {formatDate(sess.session_date)}</span>
                  </div>
                  {sess.workout_plan && (
                    <p className="text-xs font-mono text-zinc-400 bg-zinc-900/40 border border-zinc-900 p-2.5 rounded-lg mt-2.5 max-w-xl">
                      Plan: {sess.workout_plan}
                    </p>
                  )}
                </div>
              </div>

              {/* Attendance Marking Buttons */}
              <div className="flex flex-wrap gap-2 shrink-0 self-end md:self-center">
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Present')}
                  className="btn btn-primary btn-sm flex items-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" /> Present
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Late')}
                  className="btn btn-secondary btn-sm text-amber-400 hover:text-amber-300 flex items-center gap-1.5"
                >
                  Late
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Absent')}
                  className="btn btn-secondary btn-sm text-red-400 hover:text-red-300 flex items-center gap-1.5"
                >
                  <X className="h-3.5 w-3.5" /> Absent
                </button>
                <button
                  onClick={() => handleMarkAttendance(sess.id, sess.client_id, sess.trainer_id, sess.session_date, 'Cancelled')}
                  className="btn btn-secondary btn-sm text-zinc-400 hover:text-zinc-300"
                >
                  Cancelled
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
