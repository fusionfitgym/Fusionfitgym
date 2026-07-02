'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTClientById, updatePTClient, getPTPackages, getPTTrainers } from '@/lib/actions/pt';
import { PTClient, PTPackage, PTTrainer } from '@/types/pt';
import { toast } from 'sonner';

export default function EditPTClientPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [packages, setPackages] = useState<PTPackage[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [sessionsPurchased, setSessionsPurchased] = useState(0);
  const [sessionsRemaining, setSessionsRemaining] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [goal, setGoal] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive' | 'Expired'>('Active');

  useEffect(() => {
    const loadData = async () => {
      try {
        let clientData: PTClient | null = null;
        let pkgs: PTPackage[] = [];
        let trs: PTTrainer[] = [];

        if (isDemo) {
          clientData = demo.getPTClientById(id);
          pkgs = demo.getPTPackages();
          trs = demo.getPTTrainers();
        } else {
          clientData = await getPTClientById(id);
          pkgs = await getPTPackages();
          trs = await getPTTrainers();
        }

        setPackages(pkgs);
        setTrainers(trs);

        if (clientData) {
          setFullName(clientData.full_name);
          setPhone(clientData.phone);
          setEmail(clientData.email || '');
          setEmergencyContact(clientData.emergency_contact || '');
          setTrainerId(clientData.trainer_id || '');
          setPackageId(clientData.package_id || '');
          setSessionsPurchased(clientData.sessions_purchased);
          setSessionsRemaining(clientData.sessions_remaining);
          setStartDate(clientData.package_start_date);
          setExpiryDate(clientData.expiry_date);
          setHeight(clientData.height ? String(clientData.height) : '');
          setWeight(clientData.weight ? String(clientData.weight) : '');
          setBodyFat(clientData.body_fat ? String(clientData.body_fat) : '');
          setGoal(clientData.goal || '');
          setMedicalNotes(clientData.medical_notes || '');
          setStatus(clientData.status);
        }
      } catch (err: any) {
        toast.error('Error loading client profile: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id, isDemo, demo.ptClients]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !startDate || !expiryDate) {
      toast.error('Name, Phone, Start Date, and Expiry Date are required');
      return;
    }

    setSubmitting(true);
    const payload = {
      full_name: fullName,
      phone,
      email: email || undefined,
      emergency_contact: emergencyContact || undefined,
      trainer_id: trainerId || undefined,
      package_id: packageId || undefined,
      sessions_purchased: Number(sessionsPurchased),
      sessions_remaining: Number(sessionsRemaining),
      package_start_date: startDate,
      expiry_date: expiryDate,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      body_fat: bodyFat ? Number(bodyFat) : undefined,
      goal: goal || undefined,
      medical_notes: medicalNotes || undefined,
      status
    };

    try {
      if (isDemo) {
        demo.updatePTClient(id, payload);
        toast.success('PT Client details updated successfully (Demo Mode)');
        router.push(`/pt/members/${id}`);
      } else {
        const res = await updatePTClient(id, payload);
        if (res.error) throw new Error(res.error);
        toast.success('PT Client details updated successfully!');
        router.push(`/pt/members/${id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-enter">
      <div className="mb-4">
        <Link href={`/pt/members/${id}`} className="btn btn-ghost btn-sm pl-0 gap-1 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Cancel and go back
        </Link>
      </div>

      <PageHeader
        title="Edit PT Client Details"
        subtitle="Modify profile fields, metrics, package limits, or personal trainer assignments."
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Primary Details Card */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Client Details</h3>

                <FormField label="Full Name" required>
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Enter full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Phone Number" required>
                    <input
                      type="tel"
                      className="input w-full"
                      placeholder="10-digit phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Email Address">
                    <input
                      type="email"
                      className="input w-full"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField label="Emergency Contact Info">
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="Name and number of contact person"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </FormField>
              </Card>

              {/* PT Package Settings */}
              <Card className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Training Package Configuration</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Select PT Package">
                    <select
                      className="input w-full"
                      value={packageId}
                      onChange={(e) => setPackageId(e.target.value)}
                    >
                      <option value="">-- Custom Package --</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.package_name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Assigned Personal Trainer">
                    <select
                      className="input w-full"
                      value={trainerId}
                      onChange={(e) => setTrainerId(e.target.value)}
                    >
                      <option value="">-- Choose Trainer --</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label="Sessions Purchased">
                    <input
                      type="number"
                      min="1"
                      className="input w-full"
                      value={sessionsPurchased}
                      onChange={(e) => setSessionsPurchased(Number(e.target.value))}
                    />
                  </FormField>

                  <FormField label="Sessions Remaining">
                    <input
                      type="number"
                      min="0"
                      className="input w-full font-bold text-amber-300"
                      value={sessionsRemaining}
                      onChange={(e) => setSessionsRemaining(Number(e.target.value))}
                    />
                  </FormField>

                  <FormField label="Status">
                    <select
                      className="input w-full"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Package Start Date" required>
                    <input
                      type="date"
                      className="input w-full"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Expiry Date" required>
                    <input
                      type="date"
                      className="input w-full"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required
                    />
                  </FormField>
                </div>
              </Card>
            </div>

            {/* Metrics and Assessment */}
            <div className="space-y-6">
              <Card className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Physical Metrics & Goals</h3>

                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Height (cm)">
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full text-center"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Weight (kg)">
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full text-center"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Body Fat %">
                    <input
                      type="number"
                      step="0.1"
                      className="input w-full text-center"
                      value={bodyFat}
                      onChange={(e) => setBodyFat(e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField label="Fitness Goal">
                  <textarea
                    className="input w-full min-h-[80px]"
                    placeholder="Fitness goal details"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </FormField>

                <FormField label="Medical Notes / Injuries">
                  <textarea
                    className="input w-full min-h-[80px]"
                    placeholder="Medical history details"
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                  />
                </FormField>
              </Card>

              {/* Action Button */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full py-3 text-md font-bold flex items-center justify-center gap-2"
                >
                  <Save className="h-5 w-5" />
                  {submitting ? 'Saving...' : 'Save Profile Changes'}
                </button>
                <Link href={`/pt/members/${id}`} className="btn btn-secondary w-full py-3 text-center">
                  Cancel
                </Link>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
