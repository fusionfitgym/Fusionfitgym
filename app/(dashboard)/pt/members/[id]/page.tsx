'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit, Plus, Calendar, Dumbbell, ClipboardCheck, TrendingUp, History, Image as ImageIcon, Sparkles, X, Target, Trash2 } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTClientById, getPTProgress, createPTProgress, deletePTProgress, getPTSessions, getPTTrainers } from '@/lib/actions/pt';
import { PTClient, PTProgress, PTSession, PTTrainer } from '@/types/pt';
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
  const [loading, setLoading] = useState(true);

  // Tab State
  const [activeTab, setActiveTab] = useState<'progress' | 'history'>('progress');

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

  // Edit fields
  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';
  const isTrainer = profile?.role === 'Trainer';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        const clientData = demo.getPTClientById(id);
        const progressData = demo.getPTProgress(id);
        const allSessions = demo.getPTSessions();
        const clientSessions = allSessions.filter(s => s.client_id === id);

        setClient(clientData);
        setProgressLogs(progressData);
        setSessions(clientSessions);
      } else {
        const clientData = await getPTClientById(id);
        const progressData = await getPTProgress(id);
        const allSessions = await getPTSessions();
        const clientSessions = allSessions.filter(s => s.client_id === id);

        setClient(clientData);
        setProgressLogs(progressData);
        setSessions(clientSessions);
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
      
      // Clear forms
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
        const { deletePTProgress } = await import('@/lib/actions/pt');
        const res = await deletePTProgress(progId);
        if (res.error) throw new Error(res.error);
        toast.success('Progress log deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete record');
    }
  };

  // Recharts Chart Data (needs to be ascending by date)
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="page p-12 text-center">
        <h3 className="text-xl font-bold text-red-400">Client profile not found.</h3>
        <Link href="/pt/members" className="btn btn-secondary mt-4">
          Back to clients list
        </Link>
      </div>
    );
  }

  const latestWeight = progressLogs[0]?.weight || client.weight || 'N/A';
  const latestBodyFat = progressLogs[0]?.body_fat || client.body_fat || 'N/A';
  const latestBMI = progressLogs[0]?.bmi || 'N/A';

  return (
    <div className="page page-enter">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/pt/members" className="btn btn-ghost btn-sm pl-0 gap-1 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to clients list
        </Link>
        
        {(isAdmin || isReceptionist) && (
          <Link href={`/pt/members/${id}/edit`} className="btn btn-secondary btn-sm">
            <Edit className="h-3.5 w-3.5 mr-1" /> Edit Profile Details
          </Link>
        )}
      </div>

      {/* Header Profile Info Summary */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Card: General Details */}
        <Card className="bg-zinc-950 border border-zinc-800 p-6 flex flex-col justify-between lg:col-span-2">
          <div>
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 font-black text-xl">
                {client.full_name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-black text-zinc-100 leading-tight">{client.full_name}</h1>
                <p className="text-sm text-zinc-400 mt-1">{client.phone} &bull; {client.email || 'No email registered'}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 text-sm">
              <div className="rounded-xl bg-zinc-900/40 p-3 border border-zinc-900">
                <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">Assigned Trainer</span>
                <span className="text-zinc-200 font-bold block mt-1">{client.trainer?.full_name || 'Not Assigned'}</span>
              </div>
              <div className="rounded-xl bg-zinc-900/40 p-3 border border-zinc-900">
                <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">Package Selected</span>
                <span className="text-zinc-200 font-bold block mt-1 text-sm">{client.package?.package_name || 'Custom Package'}</span>
              </div>
              <div className="rounded-xl bg-zinc-900/40 p-3 border border-zinc-900 col-span-2 sm:col-span-1">
                <span className="text-zinc-500 text-xs uppercase tracking-wider block font-semibold">Expiry Date</span>
                <span className="text-zinc-200 font-bold block mt-1">{formatDate(client.expiry_date)}</span>
              </div>
            </div>

            {/* Goals & Medical Notes */}
            <div className="mt-6 space-y-3">
              {client.goal && (
                <div className="flex gap-2.5 items-start text-sm">
                  <Target className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-500 font-semibold block">Fitness Goal:</span>
                    <p className="text-zinc-300 mt-0.5">{client.goal}</p>
                  </div>
                </div>
              )}
              {client.medical_notes && (
                <div className="flex gap-2.5 items-start text-sm">
                  <X className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-zinc-500 font-semibold block">Medical Notes:</span>
                    <p className="text-zinc-300 mt-0.5">{client.medical_notes}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Right Card: Session Gauge */}
        <Card className="bg-zinc-950 border border-zinc-800 p-6 flex flex-col justify-between text-center relative overflow-hidden">
          <div className="absolute top-2 right-2">
            <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              Active Client
            </span>
          </div>

          <div>
            <span className="text-zinc-500 text-xs uppercase tracking-wider font-semibold">Remaining PT Sessions</span>
            <div className="mt-4 flex items-baseline justify-center">
              <span className="text-6xl font-black text-amber-300">{client.sessions_remaining}</span>
              <span className="text-zinc-500 text-lg ml-1">/ {client.sessions_purchased}</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-zinc-900 rounded-full h-2 mt-6 overflow-hidden">
              <div 
                className="bg-amber-300 h-full rounded-full transition-all duration-300"
                style={{ width: `${(client.sessions_remaining / client.sessions_purchased) * 100}%` }}
              />
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-2 border-t border-zinc-900 pt-4 text-center">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Weight</span>
              <span className="text-md font-bold text-zinc-200">{latestWeight} kg</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Body Fat</span>
              <span className="text-md font-bold text-zinc-200">{latestBodyFat}%</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">BMI</span>
              <span className="text-md font-bold text-zinc-200">{latestBMI}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="segmented-control mb-6" aria-label="Profile Tabs">
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
          <History className="h-4 w-4 mr-1.5 inline" /> Session History
        </button>
      </div>

      {/* Tab 1: Progress Tracking */}
      {activeTab === 'progress' ? (
        <div className="space-y-6">
          {/* Charts Row */}
          {progressLogs.length > 1 ? (
            <Card className="bg-zinc-950 border border-zinc-800 p-6">
              <h3 className="text-md font-bold text-zinc-200 mb-4">Body weight & fat progress metrics</h3>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="date" stroke="#71717a" fontSize={11} />
                    <YAxis yAxisId="left" stroke="#d97706" fontSize={11} label={{ value: 'Weight (kg)', angle: -90, position: 'insideLeft', fill: '#d97706', style: { textAnchor: 'middle', fontSize: 10 } }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={11} label={{ value: 'Body Fat (%)', angle: 90, position: 'insideRight', fill: '#10b981', style: { textAnchor: 'middle', fontSize: 10 } }} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', color: '#f4f4f5' }} />
                    <Legend verticalAlign="top" height={36} />
                    <Line yAxisId="left" type="monotone" dataKey="weight" name="Weight (kg)" stroke="#f59e0b" strokeWidth={2.5} activeDot={{ r: 8 }} />
                    <Line yAxisId="right" type="monotone" dataKey="bodyFat" name="Body Fat (%)" stroke="#10b981" strokeWidth={2.5} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          ) : (
            <Card className="bg-zinc-950 border border-zinc-800 p-8 text-center text-zinc-400">
              <TrendingUp className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              Add at least 2 progress records to generate chart tracking.
            </Card>
          )}

          {/* Progress Log Table */}
          <div className="card overflow-hidden bg-zinc-950 border border-zinc-800">
            <div className="p-4 sm:p-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/20">
              <h3 className="text-md font-bold text-zinc-200">Biometric progress timeline</h3>
              
              <button onClick={() => setIsProgressModalOpen(true)} className="btn btn-primary btn-sm">
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Progress Log
              </button>
            </div>

            {progressLogs.length === 0 ? (
              <p className="p-8 text-center text-zinc-500">No logs saved. Record initial metrics to start tracking.</p>
            ) : (
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Weight</th>
                      <th>BMI</th>
                      <th>Body Fat %</th>
                      <th className="hidden sm:table-cell">Chest</th>
                      <th className="hidden sm:table-cell">Waist</th>
                      <th className="hidden sm:table-cell">Arms</th>
                      <th className="hidden sm:table-cell">Legs</th>
                      <th className="hidden md:table-cell">Notes</th>
                      <th className="text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {progressLogs.map((log) => (
                      <tr key={log.id}>
                        <td><p className="font-semibold text-zinc-200">{formatDate(log.date)}</p></td>
                        <td><p className="text-zinc-300 font-mono">{log.weight ? `${log.weight} kg` : '-'}</p></td>
                        <td><p className="text-zinc-300 font-mono">{log.bmi || '-'}</p></td>
                        <td><p className="text-zinc-300 font-mono">{log.body_fat ? `${log.body_fat}%` : '-'}</p></td>
                        <td className="hidden sm:table-cell text-zinc-400 font-mono">{log.chest ? `${log.chest} cm` : '-'}</td>
                        <td className="hidden sm:table-cell text-zinc-400 font-mono">{log.waist ? `${log.waist} cm` : '-'}</td>
                        <td className="hidden sm:table-cell text-zinc-400 font-mono">{log.arms ? `${log.arms} cm` : '-'}</td>
                        <td className="hidden sm:table-cell text-zinc-400 font-mono">{log.legs ? `${log.legs} cm` : '-'}</td>
                        <td className="hidden md:table-cell"><p className="text-xs text-zinc-400 max-w-xs truncate">{log.notes || '-'}</p></td>
                        <td className="text-right">
                          <button onClick={() => handleDeleteProgress(log.id)} className="text-red-400 hover:text-red-300 btn btn-ghost btn-sm p-1">
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
          <Card className="bg-zinc-950 border border-zinc-800 p-6">
            <h3 className="text-md font-bold text-zinc-200 mb-4 flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-amber-400" /> Before & After Visuals
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Before Profile Photo</span>
                {progressLogs.find(p => p.photo_before) ? (
                  <img 
                    src={progressLogs.find(p => p.photo_before)?.photo_before!} 
                    alt="Before personal training" 
                    className="w-full max-w-xs aspect-square object-cover rounded-xl border border-zinc-800"
                  />
                ) : (
                  <div className="w-full max-w-xs aspect-square rounded-xl bg-zinc-900 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600">
                    <ImageIcon className="h-10 w-10 mb-2" />
                    <span className="text-xs">No Before Photo Uploaded</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-center">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Current/After Profile Photo</span>
                {progressLogs.find(p => p.photo_after) ? (
                  <img 
                    src={progressLogs.find(p => p.photo_after)?.photo_after!} 
                    alt="After personal training" 
                    className="w-full max-w-xs aspect-square object-cover rounded-xl border border-zinc-800"
                  />
                ) : (
                  <div className="w-full max-w-xs aspect-square rounded-xl bg-zinc-900 border border-dashed border-zinc-800 flex flex-col items-center justify-center text-zinc-600">
                    <Sparkles className="h-10 w-10 mb-2" />
                    <span className="text-xs">No Current Photo Uploaded</span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      ) : (
        // Tab 2: Session History
        <div className="space-y-4">
          {sessions.length === 0 ? (
            <Card className="bg-zinc-950 border border-zinc-800 p-8 text-center text-zinc-400">
              No sessions scheduled for this client yet.
            </Card>
          ) : (
            sessions.map((sess) => (
              <Card key={sess.id} className="bg-zinc-950 border border-zinc-800 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300">
                    <Dumbbell className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-100">PT Workout Session</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Trainer: <span className="font-semibold text-zinc-300">{sess.trainer?.full_name}</span> &bull; {formatDate(sess.session_date)} at {sess.session_time} ({sess.duration} mins)
                    </p>
                    {sess.workout_plan && (
                      <p className="text-sm text-zinc-300 mt-2 bg-zinc-900/40 p-2.5 rounded-lg border border-zinc-900/60 max-w-2xl font-mono text-xs">
                        {sess.workout_plan}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${sess.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : sess.status === 'Scheduled' ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                    {sess.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Progress Log Modal */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-enter">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-zinc-100">Add Biometric Progress Log</h3>
              <button onClick={() => setIsProgressModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddProgress} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Body Weight (kg)" required>
                  <input
                    type="number"
                    step="0.1"
                    className="input w-full"
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
                    className="input w-full"
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
                    className="input w-full"
                    placeholder="e.g. 98"
                    value={chest}
                    onChange={(e) => setChest(e.target.value)}
                  />
                </FormField>

                <FormField label="Waist (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input w-full"
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
                    className="input w-full"
                    placeholder="e.g. 34.5"
                    value={arms}
                    onChange={(e) => setArms(e.target.value)}
                  />
                </FormField>

                <FormField label="Legs (cm)">
                  <input
                    type="number"
                    step="0.1"
                    className="input w-full"
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
                    className="input w-full text-xs"
                    placeholder="https://example.com/before.jpg"
                    value={photoBefore}
                    onChange={(e) => setPhotoBefore(e.target.value)}
                  />
                </FormField>

                <FormField label="After/Current Photo URL">
                  <input
                    type="text"
                    className="input w-full text-xs"
                    placeholder="https://example.com/after.jpg"
                    value={photoAfter}
                    onChange={(e) => setPhotoAfter(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Progress Log Notes">
                <textarea
                  className="input w-full min-h-[60px]"
                  placeholder="Notes on performance improvements, workout notes, cardiovascular endurance"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
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
    </div>
  );
}
