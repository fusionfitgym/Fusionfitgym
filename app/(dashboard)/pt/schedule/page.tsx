'use client';

import { useEffect, useState } from 'react';
import { Plus, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, HardHat, X, Check, Dumbbell, AlertTriangle, FileText, Download, Printer } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTSessions, createPTSession, updatePTSession, deletePTSession, getPTClients, getPTTrainers, deduplicatePTSessions } from '@/lib/actions/pt';
import { PTSession, PTClient, PTTrainer } from '@/types/pt';
import { toLocalDateString } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTSchedulePage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [clients, setClients] = useState<PTClient[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isDeduplicating, setIsDeduplicating] = useState(false);

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

  // PDF Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportClientId, setExportClientId] = useState('');
  const [exportRange, setExportRange] = useState<'date' | 'month' | 'all'>('month');
  const [exportingPdf, setExportingPdf] = useState(false);

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
  const selectedDateStr = toLocalDateString(selectedDate);
  const activeSessionsForSelectedDate = sessions.filter(s => {
    // If trainer logs in, they only see their sessions
    if (isTrainer) {
      const isAssignedTrainer = s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer';
      if (!isAssignedTrainer) return false;
    }
    return s.session_date === selectedDateStr;
  });

  const getSessionsForDate = (date: Date) => {
    const dateStr = toLocalDateString(date);
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
    setSessionDate(toLocalDateString(date));
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
    if (isSavingSession) return;
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

    setIsSavingSession(true);

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
    } finally {
      setIsSavingSession(false);
    }
  };

  const handleCleanDuplicates = async () => {
    setIsDeduplicating(true);
    try {
      if (isDemo) {
        toast.success('Deduplicated schedule sessions (Demo)');
      } else {
        const res = await deduplicatePTSessions();
        if (res.error) throw new Error(res.error);
        if (res.count && res.count > 0) {
          toast.success(`Removed ${res.count} duplicate session record(s)!`);
        } else {
          toast.info('No duplicate sessions found.');
        }
      }
      loadData();
    } catch (err: any) {
      toast.error('Deduplication error: ' + err.message);
    } finally {
      setIsDeduplicating(false);
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

  const handleExportPDF = async (overrideClientId?: string) => {
    setExportingPdf(true);
    try {
      const targetClientId = overrideClientId !== undefined ? overrideClientId : exportClientId;
      const selectedExportClient = targetClientId ? clients.find(c => c.id === targetClientId) || null : null;

      let filteredSessions = [...sessions];

      if (isTrainer) {
        filteredSessions = filteredSessions.filter(s =>
          s.trainer?.auth_user_id === profile?.auth_user_id || s.trainer_id === 'rohan-trainer'
        );
      }

      if (selectedExportClient) {
        filteredSessions = filteredSessions.filter(s => s.client_id === selectedExportClient.id);
      }

      let dateLabel = '';
      if (exportRange === 'date') {
        const selectedStr = toLocalDateString(selectedDate);
        filteredSessions = filteredSessions.filter(s => s.session_date === selectedStr);
        dateLabel = selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      } else if (exportRange === 'month') {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        filteredSessions = filteredSessions.filter(s => {
          if (!s.session_date) return false;
          const [y, m] = s.session_date.split('-').map(Number);
          return y === year && (m - 1) === month;
        });
        dateLabel = currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      } else {
        dateLabel = 'All Scheduled Sessions';
      }

      let currentSettings = undefined;
      if (isDemo) {
        currentSettings = demo.getSettings();
      } else {
        const { getSettings } = await import('@/lib/actions/settings');
        currentSettings = await getSettings();
      }

      const { generatePTSchedulePDF } = await import('@/lib/pdf/generatePTSchedulePDF');
      await generatePTSchedulePDF({
        client: selectedExportClient,
        sessions: filteredSessions,
        subtitle: selectedExportClient
          ? `SCHEDULED WORKOUTS & ROUTINES FOR ${selectedExportClient.full_name.toUpperCase()}`
          : 'PERSONAL TRAINING WORKOUT SCHEDULE',
        dateLabel,
        settings: currentSettings,
      });

      toast.success(
        selectedExportClient
          ? `PDF schedule for ${selectedExportClient.full_name} downloaded!`
          : 'PT Schedule PDF downloaded successfully!'
      );
      setIsExportModalOpen(false);
    } catch (err: any) {
      toast.error('Failed to export PDF: ' + (err?.message || err));
    } finally {
      setExportingPdf(false);
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
        subtitle="Manage scheduled trainer sessions, track workout plans, and export client workout PDFs."
        action={
          <div className="flex gap-2.5 flex-wrap">
            <button
              onClick={handleCleanDuplicates}
              disabled={isDeduplicating}
              className="btn btn-secondary flex items-center gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm"
              title="Remove any duplicate session records"
            >
              {isDeduplicating ? 'Cleaning...' : 'Clean Duplicates'}
            </button>
            <button
              onClick={() => {
                setExportClientId('');
                setIsExportModalOpen(true);
              }}
              className="btn btn-secondary flex items-center gap-1.5 border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-sm"
            >
              <FileText className="h-4 w-4 text-amber-500" /> Export PDF
            </button>
            <button onClick={() => handleOpenAddModal(selectedDate)} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Schedule Session
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Column */}
        <Card className="bg-white border border-slate-200/80 shadow-sm p-5 lg:col-span-2 rounded-2xl">
          <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
            <h3 className="text-md font-bold text-slate-900 flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-amber-500" />
              {currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="btn btn-secondary btn-sm p-1.5"><ChevronLeft className="h-4 w-4" /></button>
              <button onClick={handleNextMonth} className="btn btn-secondary btn-sm p-1.5"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>

          {/* Weekdays */}
          <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs text-slate-500 uppercase tracking-wider mb-2">
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
                  key={`day-${toLocalDateString(day)}`}
                  onClick={() => setSelectedDate(day)}
                  className={`aspect-square rounded-xl p-1 flex flex-col justify-between items-center transition-all ${
                    isSelected
                      ? 'bg-amber-400 text-slate-950 font-extrabold shadow-md shadow-amber-200/60'
                      : isToday
                      ? 'border-2 border-amber-400 bg-amber-50/50 text-slate-900 font-bold'
                      : 'bg-slate-50/80 text-slate-700 hover:bg-slate-100 border border-slate-100'
                  }`}
                >
                  <span className="text-xs">{day.getDate()}</span>
                  {hasSessions && (
                    <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-slate-950' : 'bg-amber-500'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </Card>

        {/* Sessions Side Panel Column */}
        <Card className="bg-white border border-slate-200/80 shadow-sm p-5 flex flex-col justify-between min-h-[400px] rounded-2xl">
          <div>
            <div className="border-b border-slate-100 pb-3 mb-4 flex justify-between items-center flex-wrap gap-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Sessions for {selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long' })}
              </h3>
              
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full font-bold">
                  {activeSessionsForSelectedDate.length} Sessions
                </span>
                {activeSessionsForSelectedDate.length > 0 && (
                  <button
                    onClick={() => {
                      setExportClientId('');
                      setExportRange('date');
                      setIsExportModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all"
                    title="Export date schedule PDF"
                  >
                    <Download className="h-3 w-3" /> PDF
                  </button>
                )}
              </div>
            </div>

            {activeSessionsForSelectedDate.length === 0 ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center">
                <Dumbbell className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm font-medium text-slate-500">No personal training sessions scheduled for this date.</p>
                <button onClick={() => handleOpenAddModal(selectedDate)} className="btn btn-secondary btn-xs mt-4">
                  Schedule Now
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[360px]">
                {activeSessionsForSelectedDate.map((sess) => (
                  <div key={sess.id} className="bg-slate-50/80 border border-slate-200/70 rounded-xl p-3.5 space-y-3 relative hover:border-amber-300 transition-all">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-slate-900">{sess.client?.full_name}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusColor(sess.status)}`}>
                          {sess.status}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 mt-2 text-xs text-slate-600">
                        <span className="flex items-center gap-1"><HardHat className="h-3.5 w-3.5 text-slate-400" /> {sess.trainer?.full_name}</span>
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5 text-slate-400" /> {sess.session_time} ({sess.duration} mins)</span>
                      </div>
                    </div>

                    {sess.workout_plan && (
                      <p className="text-[11px] font-mono text-slate-600 bg-white p-2 rounded border border-slate-200/60 line-clamp-2">
                        {sess.workout_plan}
                      </p>
                    )}

                    <div className="flex gap-2 justify-end border-t border-slate-100 pt-2.5">
                      <button
                        onClick={() => handleExportPDF(sess.client_id)}
                        disabled={exportingPdf}
                        className="btn btn-secondary btn-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200"
                        title="Export Client Schedule PDF"
                      >
                        <FileText className="h-3 w-3" /> PDF
                      </button>
                      <button onClick={() => handleOpenEditModal(sess)} className="btn btn-secondary btn-xs">
                        Edit
                      </button>
                      <button onClick={() => handleDeleteSession(sess.id)} className="btn btn-ghost btn-xs text-rose-600 hover:text-rose-700">
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

      {/* Export Schedule PDF Modal */}
      {isExportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-enter">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" />
                Export PT Workout Schedule PDF
              </h3>
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <FormField label="Select PT Client (To Send To Client)">
                <select
                  className="select-field w-full"
                  value={exportClientId}
                  onChange={(e) => setExportClientId(e.target.value)}
                >
                  <option value="">-- All Active Clients (Master Schedule) --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </FormField>

              <FormField label="Schedule Time Period">
                <select
                  className="select-field w-full"
                  value={exportRange}
                  onChange={(e) => setExportRange(e.target.value as any)}
                >
                  <option value="month">Selected Month ({currentDate.toLocaleString('en-IN', { month: 'long', year: 'numeric' })})</option>
                  <option value="date">Selected Date ({selectedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })})</option>
                  <option value="all">All Scheduled & Upcoming Sessions</option>
                </select>
              </FormField>

              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 flex gap-2">
                <Download className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  Generates a styled PDF report complete with gym logo, trainer assignments, workout routines, session status, and client guidelines ready to print or send via WhatsApp/email.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-100 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsExportModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExportPDF()}
                disabled={exportingPdf}
                className="btn btn-primary"
              >
                {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <form
            onSubmit={handleSaveSession}
            style={{
              maxWidth: '1100px',
              maxHeight: '90vh',
            }}
            className="w-full rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col overflow-hidden animate-enter"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-lg font-bold text-slate-800">
                {selectedSession ? 'Edit PT Session' : 'Schedule PT Session'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div style={{ padding: '24px' }} className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-[32px] items-start h-full">
                {/* Left Preview Column */}
                <div style={{ height: '100%' }} className="flex flex-col justify-start">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="field-label mb-0">Session Preview</label>
                    {clientId && (
                      <button
                        type="button"
                        onClick={() => handleExportPDF(clientId)}
                        disabled={exportingPdf}
                        className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1 transition-all"
                        title="Export client schedule PDF"
                      >
                        <Download className="h-3 w-3" /> Export Client PDF
                      </button>
                    )}
                  </div>
                  <div className="border border-slate-200 bg-white p-6 flex flex-col justify-between shadow-sm rounded-xl flex-1 min-h-[300px]">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-sm font-bold text-slate-800">
                          {clientId ? (clients.find(c => c.id === clientId)?.full_name || 'Client Name') : 'Client Name'}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          sessionStatus === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200/50' :
                          sessionStatus === 'Scheduled' ? 'bg-amber-50 text-amber-700 border-amber-200/50' :
                          sessionStatus === 'Missed' ? 'bg-red-50 text-red-700 border-red-200/50' :
                          sessionStatus === 'Cancelled' ? 'bg-slate-50 text-slate-650 border-slate-200' :
                          'bg-blue-50 text-blue-700 border-blue-200/50'
                        }`}>
                          {sessionStatus}
                        </span>
                      </div>

                      <div className="mt-6 space-y-2.5 border-t border-slate-100 pt-4 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 flex items-center gap-1"><HardHat className="h-3.5 w-3.5" /> Trainer Assigned:</span>
                          <span className="font-semibold text-slate-700">
                            {trainerId ? (trainers.find(t => t.id === trainerId)?.full_name || 'Trainer Name') : 'Trainer Name'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" /> Date:</span>
                          <span className="font-semibold text-slate-700">{sessionDate || 'Not Set'}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Time:</span>
                          <span className="font-semibold text-slate-700">{sessionTime || 'Not Set'} ({duration} Mins)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Weekly Recurring:</span>
                          <span className={`font-semibold ${isRecurring ? 'text-amber-500 font-bold' : 'text-slate-500'}`}>
                            {isRecurring ? 'Yes' : 'No'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-6 border-t border-slate-100 pt-4">
                        <span className="text-xs text-slate-400 block mb-1">Workout Routine:</span>
                        <p className="text-slate-600 italic font-mono text-[11px] bg-slate-50 p-2.5 rounded border border-slate-200/50 line-clamp-4 min-h-[70px]">
                          {workoutPlan || 'No routine logged.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Form Column */}
                <div style={{ height: '100%' }} className="space-y-4">
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
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                padding: '20px 24px',
                borderTop: '1px solid #e5e7eb',
              }}
              className="sticky bottom-0 bg-white"
            >
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="btn btn-secondary"
                style={{ height: '42px', minWidth: '110px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingSession}
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '110px' }}
              >
                {isSavingSession ? 'Saving...' : 'Confirm Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
