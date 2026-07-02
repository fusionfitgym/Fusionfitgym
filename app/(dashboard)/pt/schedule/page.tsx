'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, HardHat, X, Check, Dumbbell, AlertTriangle } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTSessions, createPTSession, updatePTSession, deletePTSession, getPTClients, getPTTrainers } from '@/lib/actions/pt';
import { PTSession, PTClient, PTTrainer } from '@/types/pt';
import { toast } from 'sonner';

export default function PTSchedulePage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [clients, setClients] = useState<PTClient[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);

  // Calendar Date State
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<PTSession | null>(null);

  // Form Fields
  const [clientId, setClientId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('07:00');
  const [duration, setDuration] = useState(60);
  const [workoutPlan, setWorkoutPlan] = useState('');
  const [sessionStatus, setSessionStatus] = useState<'Scheduled' | 'Completed' | 'Missed' | 'Cancelled' | 'Rescheduled'>('Scheduled');
  const [isRecurring, setIsRecurring] = useState(false);

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';
  const isTrainer = profile?.role === 'Trainer';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setSessions(demo.getPTSessions());
        setClients(demo.getPTClients().filter(c => c.status === 'Active'));
        setTrainers(demo.getPTTrainers().filter(t => t.status === 'Active'));
      } else {
        const sessData = await getPTSessions();
        const clientsData = await getPTClients();
        const trainersData = await getPTTrainers();
        setSessions(sessData);
        setClients(clientsData.filter(c => c.status === 'Active'));
        setTrainers(trainersData.filter(t => t.status === 'Active'));
      }
    } catch (err: any) {
      toast.error('Failed to load schedule: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptSessions, demo.ptClients, demo.ptTrainers]);

  // Calendar Calculations
  const getDaysInMonth = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (d: Date) => {
    const year = d.getFullYear();
    const month = d.getMonth();
    return new Date(year, month, 1).getDay(); // 0 = Sunday, 1 = Monday etc
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDayIndex = getFirstDayOfMonth(currentDate);

  // Generate calendar days
  const calendarDays = [];
  // Fill previous month trailing days
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(null);
  }
  // Fill actual month days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  // Filter sessions for selected date
  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const activeSessionsForSelectedDate = sessions.filter(s => {
    // If trainer logs in, they only see their sessions
    if (isTrainer) {
      const isAssignedTrainer = s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer';
      if (!isAssignedTrainer) return false;
    }
    return s.session_date === selectedDateStr;
  });

  const getSessionsForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return sessions.filter(s => {
      if (isTrainer) {
        const isAssignedTrainer = s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer';
        if (!isAssignedTrainer) return false;
      }
      return s.session_date === dateStr;
    });
  };

  const handleOpenAddModal = (date: Date) => {
    setSelectedSession(null);
    setClientId('');
    setTrainerId('');
    setSessionDate(date.toISOString().split('T')[0]);
    setSessionTime('07:00');
    setDuration(60);
    setWorkoutPlan('');
    setSessionStatus('Scheduled');
    setIsRecurring(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sess: PTSession) => {
    setSelectedSession(sess);
    setClientId(sess.client_id);
    setTrainerId(sess.trainer_id);
    setSessionDate(sess.session_date);
    setSessionTime(sess.session_time);
    setDuration(sess.duration);
    setWorkoutPlan(sess.workout_plan || '');
    setSessionStatus(sess.status);
    setIsRecurring(sess.is_recurring);
    setIsModalOpen(true);
  };

  const handleSaveSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !trainerId || !sessionDate || !sessionTime) {
      toast.error('Client, Trainer, Date, and Time are required');
      return;
    }

    // Double check sessions remaining for the client before scheduling
    const clientSelected = clients.find(c => c.id === clientId);
    if (!selectedSession && clientSelected && clientSelected.sessions_remaining <= 0) {
      toast.error('This client has 0 remaining sessions! Purchase a new package first.');
      return;
    }

    const payload = {
      client_id: clientId,
      trainer_id: trainerId,
      session_date: sessionDate,
      session_time: sessionTime,
      duration: Number(duration),
      workout_plan: workoutPlan || undefined,
      status: sessionStatus,
      is_recurring: isRecurring,
      recurrence_rule: isRecurring ? 'Weekly' : undefined
    };

    try {
      if (selectedSession) {
        if (isDemo) {
          demo.updatePTSession(selectedSession.id, payload);
          toast.success('Session updated successfully (Demo)');
        } else {
          const res = await updatePTSession(selectedSession.id, payload);
          if (res.error) throw new Error(res.error);
          toast.success('Session updated successfully!');
        }
      } else {
        if (isDemo) {
          demo.createPTSession(payload);
          toast.success('Session scheduled successfully (Demo)');
        } else {
          const res = await createPTSession(payload);
          if (res.error) throw new Error(res.error);
          toast.success('Session scheduled successfully!');
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save session');
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (!confirm('Are you sure you want to delete/cancel this session?')) return;
    try {
      if (isDemo) {
        demo.deletePTSession(id);
        toast.success('Session deleted (Demo)');
      } else {
        const res = await deletePTSession(id);
        if (res.error) throw new Error(res.error);
        toast.success('Session deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete session');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
      case 'Scheduled': return 'bg-amber-500/10 text-amber-300 border border-amber-500/20';
      case 'Missed': return 'bg-red-500/10 text-red-400 border border-red-500/20';
      case 'Cancelled': return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
      case 'Rescheduled': return 'bg-blue-500/10 text-blue-400 border border-blue-500/20';
      default: return 'bg-zinc-900 text-zinc-300';
    }
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Schedule"
        subtitle="Manage scheduled trainer sessions, track workout plans, and register recurring routines."
        action={
          <button onClick={() => handleOpenAddModal(selectedDate)} className="btn btn-primary">
            <Plus className="h-4 w-4" /> Schedule Session
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Column */}
        <Card className="bg-zinc-950 border border-zinc-800 p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4 border-b border-zinc-900 pb-3">
            <h3 className="text-md font-bold text-zinc-100 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-amber-400" />
              {currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="btn btn-secondary btn-sm p-1.5"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={handleNextMonth} className="btn btn-secondary btn-sm p-1.5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-zinc-500 uppercase tracking-wider mb-2">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />;
              
              const isSelected = day.toDateString() === selectedDate.toDateString();
              const isToday = day.toDateString() === new Date().toDateString();
              const dateSessions = getSessionsForDate(day);
              const hasSessions = dateSessions.length > 0;

              return (
                <button
                  key={`day-${day.toISOString()}`}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-xl p-1 flex flex-col justify-between items-center transition-all ${isSelected ? 'bg-amber-300 text-zinc-950 font-bold shadow-md shadow-amber-400/10' : isToday ? 'border-2 border-amber-300/40 bg-zinc-900 text-amber-300' : 'bg-zinc-900/40 text-zinc-300 hover:bg-zinc-800/40'}`}
                >
                  <span className="text-xs">{day.getDate()}</span>
                  {hasSessions && (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-zinc-900' : 'bg-amber-400'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Sessions Side Panel Column */}
        <Card className="bg-zinc-950 border border-zinc-800 p-5 flex flex-col justify-between min-h-[400px]">
          <div>
            <div className="border-b border-zinc-900 pb-3 mb-4 flex justify-between items-center">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">
                Sessions for {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}
              </h3>
              
              <span className="text-xs text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded font-bold">
                {activeSessionsForSelectedDate.length} Sessions
              </span>
            </div>

            {activeSessionsForSelectedDate.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 flex flex-col items-center">
                <Dumbbell className="h-8 w-8 text-zinc-700 mb-2" />
                <p className="text-sm">No personal training sessions scheduled for this date.</p>
                <button onClick={() => handleOpenAddModal(selectedDate)} className="btn btn-secondary btn-xs mt-4">
                  Schedule Now
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[360px]">
                {activeSessionsForSelectedDate.map((sess) => (
                  <div key={sess.id} className="bg-zinc-900/40 border border-zinc-900 rounded-xl p-3.5 space-y-3 relative hover:border-zinc-800 transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-zinc-100">{sess.client?.full_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(sess.status)}`}>
                          {sess.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 mt-2 text-xs text-zinc-400">
                        <span className="flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-zinc-500" /> {sess.trainer?.full_name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-zinc-500" /> {sess.session_time} ({sess.duration} mins)</span>
                      </div>
                    </div>

                    {sess.workout_plan && (
                      <p className="text-[11px] font-mono text-zinc-400 bg-zinc-950 p-2 rounded border border-zinc-900 line-clamp-2">
                        {sess.workout_plan}
                      </p>
                    )}

                    <div className="flex gap-2 justify-end border-t border-zinc-900/80 pt-2.5">
                      <button onClick={() => handleOpenEditModal(sess)} className="btn btn-secondary btn-xs">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteSession(sess.id)} className="btn btn-ghost btn-xs text-red-400 hover:text-red-300">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Schedule Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedSession ? 'Edit PT Session' : 'Schedule PT Session'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSession} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="PT Client" required>
                  <select
                    className="select-field w-full"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.full_name} ({c.sessions_remaining} left)</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Personal Trainer" required>
                  <select
                    className="select-field w-full"
                    value={trainerId}
                    onChange={(e) => setTrainerId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Trainer --</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Session Date" required>
                  <input
                    type="date"
                    className="input-field w-full"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Session Time" required>
                  <input
                    type="time"
                    className="input-field w-full"
                    value={sessionTime}
                    onChange={(e) => setSessionTime(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Duration (Mins)" required>
                  <input
                    type="number"
                    min="15"
                    className="input-field w-full"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    required
                  />
                </FormField>
              </div>

              <FormField label="Workout Plan / Routine">
                <textarea
                  className="textarea-field w-full min-h-[60px]"
                  placeholder="Chest focus: bench press, dumbbell flys, dips..."
                  value={workoutPlan}
                  onChange={(e) => setWorkoutPlan(e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Session Status">
                  <select
                    className="select-field w-full"
                    value={sessionStatus}
                    onChange={(e) => setSessionStatus(e.target.value as any)}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Completed">Completed</option>
                    <option value="Missed">Missed</option>
                    <option value="Cancelled">Cancelled</option>
                    <option value="Rescheduled">Rescheduled</option>
                  </select>
                </FormField>

                <div className="flex items-center mt-6 gap-2">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    className="checkbox"
                    checked={isRecurring}
                    onChange={(e) => setIsRecurring(e.target.checked)}
                  />
                  <label htmlFor="isRecurring" className="text-sm font-semibold text-slate-600">
                    Recurring Weekly Routine
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
