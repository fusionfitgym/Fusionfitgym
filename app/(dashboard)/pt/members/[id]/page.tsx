'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Plus, Calendar, Dumbbell, ClipboardCheck, TrendingUp, History, Image as ImageIcon, Sparkles, X, Target, Trash2, Clock, Activity, AlertCircle, Flame, FlameKindling, HardHat, CheckCircle2, Download, FileText } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTClientById, getPTProgress, createPTProgress, deletePTProgress, getPTSessions, getPTDailyWorkouts, createPTDailyWorkout, deletePTDailyWorkout, getPTTrainers } from '@/lib/actions/pt';
import { getSettings } from '@/lib/actions/settings';
import { generatePTProgressPDF } from '@/lib/pdf/generatePTProgressPDF';
import { PTClient, PTProgress, PTSession, PTDailyWorkout, PTTrainer } from '@/types/pt';
import { GymSettings } from '@/types';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function PTClientProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [client, setClient] = useState<PTClient | null>(null);
  const [progressLogs, setProgressLogs] = useState<PTProgress[]>([]);
  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [dailyWorkouts, setDailyWorkouts] = useState<PTDailyWorkout[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [gymSettings, setGymSettings] = useState<GymSettings | undefined>(undefined);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Tab State: progress | workouts | history
  const [activeTab, setActiveTab] = useState<'progress' | 'workouts' | 'history'>('workouts');

  // Modal State for Progress
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState('');
  const [waist, setWaist] = useState('');
  const [arms, setArms] = useState('');
  const [legs, setLegs] = useState('');
  const [notes, setNotes] = useState('');
  const [photoBefore, setPhotoBefore] = useState('');
  const [photoAfter, setPhotoAfter] = useState('');

  // Modal State for Daily Workout
  const [isWorkoutModalOpen, setIsWorkoutModalOpen] = useState(false);
  const [workoutDate, setWorkoutDate] = useState(new Date().toISOString().split('T')[0]);
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [muscleGroup, setMuscleGroup] = useState('Full Body');
  const [workoutTrainerId, setWorkoutTrainerId] = useState('');
  const [exercises, setExercises] = useState('');
  const [workoutDuration, setWorkoutDuration] = useState('45');
  const [caloriesBurned, setCaloriesBurned] = useState('');
  const [intensity, setIntensity] = useState<'Low' | 'Moderate' | 'High' | 'Extreme'>('Moderate');
  const [workoutNotes, setWorkoutNotes] = useState('');

  // Role checks
  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';

  const handleExportPDF = async () => {
    if (!client) return;
    setIsExportingPDF(true);
    toast.info('Generating PT Progress PDF Report...');
    try {
      let currentSettings = gymSettings;
      if (!currentSettings) {
        if (isDemo) {
          currentSettings = demo.getSettings();
        } else {
          currentSettings = await getSettings();
        }
        setGymSettings(currentSettings);
      }
      await generatePTProgressPDF({
        client,
        progressLogs,
        dailyWorkouts,
        sessions,
        settings: currentSettings
      });
      toast.success('PT Progress PDF exported successfully!');
    } catch (err: any) {
      toast.error('Failed to export PDF: ' + (err?.message || err));
    } finally {
      setIsExportingPDF(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        const clientData = demo.getPTClientById(id);
        const progressData = demo.getPTProgress(id);
        const allSessions = demo.getPTSessions();
        const clientSessions = allSessions.filter(s => s.client_id === id);
        const workoutsData = demo.getPTDailyWorkouts(id);
        const trainersList = demo.getPTTrainers();

        setClient(clientData);
        setProgressLogs(progressData);
        setSessions(clientSessions);
        setDailyWorkouts(workoutsData);
        setTrainers(trainersList);
      } else {
        const clientData = await getPTClientById(id);
        const progressData = await getPTProgress(id);
        const allSessions = await getPTSessions();
        const clientSessions = allSessions.filter(s => s.client_id === id);
        const workoutsData = await getPTDailyWorkouts(id);
        const trainersList = await getPTTrainers();

        setClient(clientData);
        setProgressLogs(progressData);
        setSessions(clientSessions);
        setDailyWorkouts(workoutsData);
        setTrainers(trainersList);
      }
    } catch (err: any) {
      toast.error('Failed to load profile data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, isDemo, demo.ptClients, demo.ptProgress, demo.ptSessions]);

  const handleAddProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const wVal = Number(weight);
    const hVal = Number(height || client?.height || 0);
    let bmiVal: number | null = null;
    
    if (wVal && hVal) {
      const heightInMeters = hVal / 100;
      bmiVal = Number((wVal / (heightInMeters * heightInMeters)).toFixed(1));
    }

    const payload = {
      client_id: id,
      date: new Date().toISOString().split('T')[0],
      weight: wVal || null,
      height: hVal || null,
      bmi: bmiVal,
      body_fat: bodyFat ? Number(bodyFat) : null,
      chest: chest ? Number(chest) : null,
      waist: waist ? Number(waist) : null,
      arms: arms ? Number(arms) : null,
      legs: legs ? Number(legs) : null,
      photo_before: photoBefore || null,
      photo_after: photoAfter || null,
      notes: notes || undefined
    };

    try {
      if (isDemo) {
        demo.createPTProgress(payload);
        toast.success('Progress log recorded successfully! (Demo)');
      } else {
        const res = await createPTProgress(payload);
        if (res.error) throw new Error(res.error);
        toast.success('Progress log recorded successfully!');
      }
      setIsProgressModalOpen(false);
      
      setWeight('');
      setHeight('');
      setBodyFat('');
      setChest('');
      setWaist('');
      setArms('');
      setLegs('');
      setNotes('');
      setPhotoBefore('');
      setPhotoAfter('');

      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record progress');
    }
  };

  const handleDeleteProgress = async (progId: string) => {
    if (!confirm('Are you sure you want to delete this progress log?')) return;
    try {
      if (isDemo) {
        demo.deletePTProgress(progId);
        toast.success('Progress log deleted (Demo)');
      } else {
        const res = await deletePTProgress(progId);
        if (res.error) throw new Error(res.error);
        toast.success('Progress log deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  const handleAddWorkout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workoutTitle || !workoutDate) {
      toast.error('Workout Title and Date are required');
      return;
    }

    const isValidUUID = (str?: string | null) => Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));
    const selectedTrainerId = workoutTrainerId || client?.trainer_id || null;

    const payload = {
      client_id: id,
      trainer_id: isValidUUID(selectedTrainerId) ? selectedTrainerId : null,
      workout_date: workoutDate,
      title: workoutTitle,
      muscle_group: muscleGroup || 'Full Body',
      exercises: exercises || undefined,
      duration: workoutDuration ? Number(workoutDuration) : null,
      calories_burned: caloriesBurned ? Number(caloriesBurned) : null,
      intensity,
      notes: workoutNotes || undefined
    };

    try {
      if (isDemo) {
        demo.createPTDailyWorkout(payload);
        toast.success('Daily workout logged successfully! (Demo)');
      } else {
        const res = await createPTDailyWorkout(payload);
        if (res.error) throw new Error(res.error);
        toast.success('Daily workout logged successfully!');
      }
      setIsWorkoutModalOpen(false);

      // Reset form
      setWorkoutTitle('');
      setMuscleGroup('Full Body');
      setExercises('');
      setWorkoutDuration('45');
      setCaloriesBurned('');
      setIntensity('Moderate');
      setWorkoutNotes('');

      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to log workout');
    }
  };

  const handleDeleteWorkout = async (workoutId: string) => {
    if (!confirm('Are you sure you want to delete this workout log?')) return;
    try {
      if (isDemo) {
        demo.deletePTDailyWorkout(workoutId);
        toast.success('Workout log deleted (Demo)');
      } else {
        const res = await deletePTDailyWorkout(workoutId);
        if (res.error) throw new Error(res.error);
        toast.success('Workout log deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete workout');
    }
  };

  // Recharts Chart Data (ascending by date)
  const chartData = [...progressLogs]
    .reverse()
    .map(log => ({
      date: new Date(log.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      weight: log.weight,
      bodyFat: log.body_fat,
      bmi: log.bmi
    }));

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page p-12 text-center">
        <h3 className="text-xl font-bold text-rose-600">Client profile not found.</h3>
        <Link href="/pt/members" className="btn btn-secondary mt-4">
          Back to clients list
        </Link>
      </div>
    );
  }

  const latestWeight = progressLogs[0]?.weight || client.weight || 'N/A';
  const latestBodyFat = progressLogs[0]?.body_fat || client.body_fat || 'N/A';
  const latestBMI = progressLogs[0]?.bmi || 'N/A';
  const initials = (client.full_name || 'PT').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  const sessionsRemainingPercent = client.sessions_purchased > 0
    ? Math.round((client.sessions_remaining / client.sessions_purchased) * 100)
    : 0;

  return (
    <div className="page page-enter">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/pt/members" className="btn btn-ghost btn-sm pl-0 gap-1.5 text-slate-600 hover:text-slate-900 font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to clients list
        </Link>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={isExportingPDF}
            className="btn btn-secondary btn-sm shadow-xs flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            {isExportingPDF ? 'Exporting...' : 'Export Progress PDF'}
          </button>

          {(isAdmin || isReceptionist) && (
            <Link href={`/pt/members/${id}/edit`} className="btn btn-secondary btn-sm shadow-xs">
              <Edit className="h-3.5 w-3.5 mr-1.5" /> Edit Profile Details
            </Link>
          )}
        </div>
      </div>

      {/* Header Profile Info Summary */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Card: General Details */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 shrink-0 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-500 text-white font-black text-2xl flex items-center justify-center shadow-lg shadow-amber-200/60">
                {initials}
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 leading-tight">{client.full_name}</h1>
                <p className="text-sm font-semibold text-slate-600 mt-0.5">
                  📞 {client.phone} {client.email ? `• ✉️ ${client.email}` : '• No email registered'}
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50/90 p-3.5 border border-slate-200/70">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Assigned Trainer</span>
                <span className="text-slate-900 font-extrabold block mt-1 text-sm">{client.trainer?.full_name || 'Not Assigned'}</span>
              </div>
              <div className="rounded-xl bg-slate-50/90 p-3.5 border border-slate-200/70">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Package Selected</span>
                <span className="text-slate-900 font-extrabold block mt-1 text-sm">{client.package?.package_name || 'Custom Package'}</span>
              </div>
              <div className="rounded-xl bg-slate-50/90 p-3.5 border border-slate-200/70">
                <span className="text-slate-500 text-xs font-bold uppercase tracking-wider block">Expiry Date</span>
                <span className="text-slate-900 font-extrabold block mt-1 text-sm">{formatDate(client.expiry_date)}</span>
              </div>
            </div>

            {/* Goals & Medical Notes */}
            <div className="mt-5 space-y-2.5">
              {client.goal && (
                <div className="rounded-xl bg-amber-50/60 border border-amber-200/60 p-3 text-amber-900 text-sm flex items-start gap-2.5">
                  <Target className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block text-xs uppercase tracking-wider text-amber-800">Fitness Goal</span>
                    <p className="font-semibold mt-0.5">{client.goal}</p>
                  </div>
                </div>
              )}
              {client.medical_notes && (
                <div className="rounded-xl bg-rose-50/60 border border-rose-200/60 p-3 text-rose-900 text-sm flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold block text-xs uppercase tracking-wider text-rose-800">Medical Notes</span>
                    <p className="font-semibold mt-0.5">{client.medical_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Card: Session Gauge */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm flex flex-col justify-between text-center relative">
          <div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Remaining PT Sessions</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${
                client.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {client.status} Client
              </span>
            </div>

            <div className="mt-4 flex items-baseline justify-center">
              <span className="text-5xl font-black text-amber-500">{client.sessions_remaining}</span>
              <span className="text-slate-400 text-base font-bold ml-1.5">/ {client.sessions_purchased} sessions</span>
            </div>
            
            {/* Visual Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-3 mt-5 overflow-hidden p-0.5 border border-slate-200/50">
              <div 
                className="bg-gradient-to-r from-amber-400 to-amber-500 h-full rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(0, sessionsRemainingPercent))}%` }}
              />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-100 pt-4 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Weight</span>
              <span className="text-sm font-black text-slate-900">{latestWeight} {latestWeight !== 'N/A' && 'kg'}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Body Fat</span>
              <span className="text-sm font-black text-slate-900">{latestBodyFat} {latestBodyFat !== 'N/A' && '%'}</span>
            </div>
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">BMI</span>
              <span className="text-sm font-black text-slate-900">{latestBMI}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="segmented-control mb-6" aria-label="Profile Tabs">
        <button
          onClick={() => setActiveTab('workouts')}
          className={`segment ${activeTab === 'workouts' && 'segment-active'}`}
        >
          <Dumbbell className="h-4 w-4 mr-1.5 inline text-amber-500" /> Daily Workout Log ({dailyWorkouts.length})
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`segment ${activeTab === 'progress' && 'segment-active'}`}
        >
          <TrendingUp className="h-4 w-4 mr-1.5 inline" /> Progress Tracking
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`segment ${activeTab === 'history' && 'segment-active'}`}
        >
          <History className="h-4 w-4 mr-1.5 inline" /> Session History ({sessions.length})
        </button>
      </div>

      {/* Tab 1: Daily Workout Log */}
      {activeTab === 'workouts' ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-md font-extrabold text-slate-900 flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-amber-500" /> Member Daily Workout Log
              </h3>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">Record daily workout routines, exercises, sets/reps, intensity, and trainer notes for {client.full_name}.</p>
            </div>
            
            <button onClick={() => setIsWorkoutModalOpen(true)} className="btn btn-primary shadow-md shadow-amber-200/50 shrink-0">
              <Plus className="h-4 w-4 mr-1.5" /> Log Daily Workout
            </button>
          </div>

          {dailyWorkouts.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
              <Dumbbell className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-800">No Daily Workouts Logged</h3>
              <p className="mt-1.5 text-sm text-slate-500">Record {client.full_name}&apos;s workout routine to track daily training volume and progress.</p>
              <button onClick={() => setIsWorkoutModalOpen(true)} className="btn btn-primary mt-6">
                Log First Daily Workout
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {dailyWorkouts.map((workout) => {
                const intensityColor = 
                  workout.intensity === 'Extreme' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                  workout.intensity === 'High' ? 'bg-amber-50 text-amber-800 border-amber-200' :
                  workout.intensity === 'Moderate' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  'bg-blue-50 text-blue-700 border-blue-200';

                return (
                  <div key={workout.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:border-amber-300 transition-all">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3.5 mb-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-800 font-black flex items-center justify-center text-sm shadow-inner">
                          <Dumbbell className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-base font-extrabold text-slate-900">{workout.title}</h4>
                            {workout.muscle_group && (
                              <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                                {workout.muscle_group}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-semibold text-slate-500 mt-0.5">
                            📅 {formatDate(workout.workout_date)} {workout.trainer?.full_name ? `• 🏋️ Trainer: ${workout.trainer.full_name}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        {workout.intensity && (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${intensityColor}`}>
                            🔥 {workout.intensity} Intensity
                          </span>
                        )}
                        <button
                          onClick={() => handleDeleteWorkout(workout.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors ml-1"
                          title="Delete workout log"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stats badges */}
                    <div className="flex flex-wrap gap-4 text-xs font-semibold text-slate-600 mb-3 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                      {workout.duration && (
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" /> Duration: <strong className="text-slate-900">{workout.duration} mins</strong>
                        </span>
                      )}
                      {workout.calories_burned && (
                        <span className="flex items-center gap-1.5">
                          <Flame className="h-3.5 w-3.5 text-amber-500" /> Burned: <strong className="text-slate-900">{workout.calories_burned} kcal</strong>
                        </span>
                      )}
                    </div>

                    {/* Exercises breakdown */}
                    {workout.exercises && (
                      <div className="mt-3">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">Exercises & Routine</span>
                        <pre className="whitespace-pre-wrap text-xs font-mono text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 leading-relaxed">
                          {workout.exercises}
                        </pre>
                      </div>
                    )}

                    {/* Trainer Notes */}
                    {workout.notes && (
                      <div className="mt-3 text-xs text-slate-700 bg-amber-50/50 border border-amber-200/50 p-3 rounded-xl">
                        <span className="font-extrabold text-amber-800 block text-[11px] uppercase tracking-wider mb-0.5">Trainer Notes & Feedback</span>
                        <p className="font-medium text-slate-800">{workout.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : activeTab === 'progress' ? (
        <div className="space-y-6">
          {/* Chart Card */}
          {progressLogs.length > 1 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4">Body Weight & Fat Metric Progress</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#d97706" fontSize={11} label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: '#d97706', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 700 } }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} label={{ value: 'Body Fat (%)', angle: 90, position: 'insideRight', fill: '#10b981', style: { textAnchor: 'middle', fontSize: 10, fontWeight: 700 } }} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', borderColor: '#e2e8f0', color: '#0f172a', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#f59e0b" strokeWidth={2.5} activeDot={{ r: 7 }} />
                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="Body Fat (%)" stroke="#10b981" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-sm">
              <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium">Add at least 2 progress logs to generate visual trend charts.</p>
            </div>
          )}

          {/* Progress Log Table */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">Biometric Progress Timeline</h3>
                <p className="text-xs text-slate-500 mt-0.5">Track body composition history and physical measurements.</p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportPDF}
                  disabled={isExportingPDF}
                  className="btn btn-secondary btn-sm shadow-xs flex items-center gap-1"
                >
                  <FileText className="h-3.5 w-3.5" /> Export PDF Report
                </button>

                <button onClick={() => setIsProgressModalOpen(true)} className="btn btn-primary btn-sm shadow-md shadow-amber-200/50">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Progress Log
                </button>
              </div>
            </div>

            {progressLogs.length === 0 ? (
              <p className="p-8 text-center text-slate-500 text-sm">No logs saved. Record initial metrics to start tracking progress.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-500">
                      <th className="py-3.5 px-4">Date</th>
                      <th className="py-3.5 px-4">Weight</th>
                      <th className="py-3.5 px-4">BMI</th>
                      <th className="py-3.5 px-4">Body Fat %</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Chest</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Waist</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Arms</th>
                      <th className="py-3.5 px-4 hidden sm:table-cell">Legs</th>
                      <th className="py-3.5 px-4 hidden md:table-cell">Notes</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {progressLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3.5 px-4"><p className="font-bold text-slate-900">{formatDate(log.date)}</p></td>
                        <td className="py-3.5 px-4"><p className="text-slate-900 font-extrabold font-mono">{log.weight ? `${log.weight} kg` : '-'}</p></td>
                        <td className="py-3.5 px-4"><p className="text-slate-700 font-bold font-mono">{log.bmi || '-'}</p></td>
                        <td className="py-3.5 px-4"><p className="text-slate-900 font-extrabold font-mono">{log.body_fat ? `${log.body_fat}%` : '-'}</p></td>
                        <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 font-mono">{log.chest ? `${log.chest} cm` : '-'}</td>
                        <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 font-mono">{log.waist ? `${log.waist} cm` : '-'}</td>
                        <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 font-mono">{log.arms ? `${log.arms} cm` : '-'}</td>
                        <td className="py-3.5 px-4 hidden sm:table-cell text-slate-600 font-mono">{log.legs ? `${log.legs} cm` : '-'}</td>
                        <td className="py-3.5 px-4 hidden md:table-cell"><p className="text-xs text-slate-500 max-w-xs truncate">{log.notes || '-'}</p></td>
                        <td className="py-3.5 px-4 text-right">
                          <button onClick={() => handleDeleteProgress(log.id)} className="text-slate-400 hover:text-rose-600 transition-colors rounded-lg p-1.5 hover:bg-rose-50" title="Delete Log">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Photo Timeline BEFORE / AFTER */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800 mb-4 flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-amber-500" /> Before & After Visuals
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Before Profile Photo</span>
                {progressLogs.find(p => p.photo_before) ? (
                  <img 
                    src={progressLogs.find(p => p.photo_before)?.photo_before!} 
                    alt="Before personal training" 
                    className="w-full max-w-xs aspect-square object-cover rounded-xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-full max-w-xs aspect-square rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <ImageIcon className="h-10 w-10 mb-2 text-slate-300" />
                    <span className="text-xs font-semibold">No Before Photo Uploaded</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Current / After Photo</span>
                {progressLogs.find(p => p.photo_after) ? (
                  <img 
                    src={progressLogs.find(p => p.photo_after)?.photo_after!} 
                    alt="After personal training" 
                    className="w-full max-w-xs aspect-square object-cover rounded-xl border border-slate-200 shadow-sm"
                  />
                ) : (
                  <div className="w-full max-w-xs aspect-square rounded-2xl bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <Sparkles className="h-10 w-10 mb-2 text-amber-400" />
                    <span className="text-xs font-semibold">No Current Photo Uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Tab 3: Session History
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-8 text-center text-slate-500 shadow-sm">
              <Dumbbell className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              No sessions scheduled for this client yet.
            </div>
          ) : (
            sessions.map((sess) => (
              <div key={sess.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-amber-300 transition-all">
                <div className="flex items-start gap-3.5">
                  <div className="h-11 w-11 shrink-0 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 font-bold">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">PT Workout Session</h4>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5">
                      Trainer: <span className="text-slate-900 font-bold">{sess.trainer?.full_name}</span> &bull; {formatDate(sess.session_date)} at {sess.session_time} ({sess.duration} mins)
                    </p>
                    {sess.workout_plan && (
                      <p className="text-xs text-slate-700 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 max-w-2xl font-mono">
                        {sess.workout_plan}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold border ${
                    sess.status === 'Completed'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : sess.status === 'Scheduled'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {sess.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Progress Log Modal */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-900">Add Biometric Progress Log</h3>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddProgress} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Body Weight (kg)" required>
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 78.5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Body Fat %">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 18.4"
                    value={bodyFat}
                    onChange={(e) => setBodyFat(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Chest Circumference (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 98"
                    value={chest}
                    onChange={(e) => setChest(e.target.value)}
                  />
                </FormField>

                <FormField label="Waist (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 84"
                    value={waist}
                    onChange={(e) => setWaist(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Arms (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 34.5"
                    value={arms}
                    onChange={(e) => setArms(e.target.value)}
                  />
                </FormField>

                <FormField label="Legs (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 54"
                    value={legs}
                    onChange={(e) => setLegs(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Before Photo URL">
                  <input
                    type="text"
                    className="input-field w-full text-xs font-semibold text-slate-800"
                    placeholder="https://example.com/before.jpg"
                    value={photoBefore}
                    onChange={(e) => setPhotoBefore(e.target.value)}
                  />
                </FormField>

                <FormField label="After/Current Photo URL">
                  <input
                    type="text"
                    className="input-field w-full text-xs font-semibold text-slate-800"
                    placeholder="https://example.com/after.jpg"
                    value={photoAfter}
                    onChange={(e) => setPhotoAfter(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Progress Log Notes">
                <textarea
                  className="textarea-field w-full min-h-[60px] font-medium text-slate-800"
                  placeholder="Notes on performance improvements, workout notes, cardiovascular endurance"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsProgressModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Progress Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Daily Workout Modal */}
      {isWorkoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-5 w-5 text-amber-500" />
                <h3 className="text-lg font-bold text-slate-900">Log Daily Workout for {client.full_name}</h3>
              </div>
              <button onClick={() => setIsWorkoutModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddWorkout} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Workout Date" required>
                  <input
                    type="date"
                    className="input-field w-full font-semibold text-slate-800"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Target Muscle Group(s)">
                  <select
                    className="select-field w-full font-semibold text-slate-800"
                    value={muscleGroup}
                    onChange={(e) => setMuscleGroup(e.target.value)}
                  >
                    <option value="Full Body">Full Body</option>
                    <option value="Chest & Triceps">Chest & Triceps</option>
                    <option value="Back & Biceps">Back & Biceps</option>
                    <option value="Legs & Glutes">Legs & Glutes</option>
                    <option value="Shoulders & Arms">Shoulders & Arms</option>
                    <option value="Core & Abs">Core & Abs</option>
                    <option value="Cardio & Conditioning">Cardio & Conditioning</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Workout Title" required>
                <input
                  type="text"
                  className="input-field w-full font-semibold text-slate-800"
                  placeholder="e.g. Chest & Triceps Hypertrophy, Leg Strength Session"
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Conducting Trainer">
                  <select
                    className="select-field w-full font-semibold text-slate-800"
                    value={workoutTrainerId}
                    onChange={(e) => setWorkoutTrainerId(e.target.value)}
                  >
                    <option value="">-- {client.trainer?.full_name ? `Assigned (${client.trainer.full_name})` : 'Select Trainer'} --</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Intensity Level">
                  <select
                    className="select-field w-full font-semibold text-slate-800"
                    value={intensity}
                    onChange={(e) => setIntensity(e.target.value as any)}
                  >
                    <option value="Low">Low</option>
                    <option value="Moderate">Moderate</option>
                    <option value="High">High</option>
                    <option value="Extreme">Extreme 🔥</option>
                  </select>
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Duration (Minutes)">
                  <input
                    type="number"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 45"
                    value={workoutDuration}
                    onChange={(e) => setWorkoutDuration(e.target.value)}
                  />
                </FormField>

                <FormField label="Calories Burned (Est.)">
                  <input
                    type="number"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="e.g. 400"
                    value={caloriesBurned}
                    onChange={(e) => setCaloriesBurned(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Exercises & Routine Breakdown">
                <textarea
                  className="textarea-field w-full min-h-[100px] font-mono text-xs text-slate-800"
                  placeholder={`1. Barbell Bench Press: 4 sets x 10 reps @ 70kg\n2. Incline Dumbbell Press: 3 sets x 12 reps @ 24kg\n3. Tricep Rope Pushdown: 4 sets x 15 reps`}
                  value={exercises}
                  onChange={(e) => setExercises(e.target.value)}
                />
              </FormField>

              <FormField label="Trainer Remarks / Client Feedback">
                <textarea
                  className="textarea-field w-full min-h-[60px] font-medium text-slate-800"
                  placeholder="Form feedback, performance improvements, energy levels..."
                  value={workoutNotes}
                  onChange={(e) => setWorkoutNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsWorkoutModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary shadow-md shadow-amber-200/50">
                  <Dumbbell className="h-4 w-4 mr-1.5" /> Save Workout Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
