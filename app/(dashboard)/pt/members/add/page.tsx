'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { createPTClient, getPTPackages, getPTTrainers } from '@/lib/actions/pt';
import { getMembers } from '@/lib/actions/members';
import { Member } from '@/types';
import { PTPackage, PTTrainer } from '@/types/pt';
import { toast } from 'sonner';

export default function AddPTClientPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [packages, setPackages] = useState<PTPackage[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [gymMembers, setGymMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [sessionsPurchased, setSessionsPurchased] = useState(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState('');
  
  // Biometrics
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [bodyFat, setBodyFat] = useState('');
  const [goal, setGoal] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (isDemo) {
          setPackages(demo.getPTPackages());
          setTrainers(demo.getPTTrainers());
          setGymMembers(demo.members);
        } else {
          const pkgs = await getPTPackages();
          const trs = await getPTTrainers();
          const mems = await getMembers();
          setPackages(pkgs);
          setTrainers(trs);
          setGymMembers(mems);
        }
      } catch (err: any) {
        toast.error('Error loading registration dependencies: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isDemo, demo.ptPackages, demo.ptTrainers, demo.members]);

  // Handle Gym Member link
  const handleMemberChange = (memberId: string) => {
    setSelectedMemberId(memberId);
    if (!memberId) {
      setFullName('');
      setPhone('');
      setEmail('');
      setEmergencyContact('');
      return;
    }
    const mem = gymMembers.find(m => m.id === memberId);
    if (mem) {
      setFullName(mem.full_name);
      setPhone(mem.phone);
      setEmail(mem.email || '');
      setEmergencyContact(mem.emergency_contact || '');
    }
  };

  // Handle Package Selection
  const handlePackageChange = (pkgId: string) => {
    setPackageId(pkgId);
    if (!pkgId) return;
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      setSessionsPurchased(pkg.number_of_sessions);
      if (pkg.trainer_id) {
        setTrainerId(pkg.trainer_id);
      }
      
      const start = new Date(startDate);
      start.setDate(start.getDate() + pkg.duration);
      setExpiryDate(start.toISOString().split('T')[0]);
    }
  };

  // Handle Start Date change
  const handleStartDateChange = (date: string) => {
    setStartDate(date);
    if (packageId) {
      const pkg = packages.find(p => p.id === packageId);
      if (pkg) {
        const start = new Date(date);
        start.setDate(start.getDate() + pkg.duration);
        setExpiryDate(start.toISOString().split('T')[0]);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone || !startDate || !expiryDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    const payload = {
      member_id: selectedMemberId || undefined,
      full_name: fullName,
      phone,
      email: email || undefined,
      emergency_contact: emergencyContact || undefined,
      trainer_id: trainerId || undefined,
      package_id: packageId || undefined,
      sessions_purchased: Number(sessionsPurchased),
      sessions_remaining: Number(sessionsPurchased),
      package_start_date: startDate,
      expiry_date: expiryDate,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      body_fat: bodyFat ? Number(bodyFat) : undefined,
      goal: goal || undefined,
      medical_notes: medicalNotes || undefined,
      status: status as any
    };

    try {
      if (isDemo) {
        const res = demo.createPTClient(payload);
        
        if (packageId && res.data) {
          const pkg = packages.find(p => p.id === packageId);
          if (pkg) {
            demo.createPTInvoice({
              client_id: res.data.id,
              invoice_date: startDate,
              trainer_id: trainerId || null,
              package_id: packageId,
              package_name: pkg.package_name,
              sessions_included: pkg.number_of_sessions,
              sessions_remaining_at_invoice: pkg.number_of_sessions,
              price: pkg.price,
              discount: pkg.discount,
              gst_amount: 0,
              tax_amount: 0,
              final_amount: pkg.final_price,
              payment_method: null,
              paid_amount: 0,
              balance_due: pkg.final_price,
              due_date: startDate,
              status: 'Pending'
            });
          }
        }
        
        if (res.data && (height || weight || bodyFat)) {
          demo.createPTProgress({
            client_id: res.data.id,
            date: startDate,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
            body_fat: bodyFat ? Number(bodyFat) : null,
            notes: 'Initial metrics collected upon registration.'
          });
        }
        
        toast.success('PT Client registered successfully! (Demo Mode)');
        router.push(`/pt/members/${res.data?.id}`);
      } else {
        const res = await createPTClient(payload);
        if (res.error || !res.data) throw new Error(res.error || 'Failed to create client');

        if (packageId) {
          const pkg = packages.find(p => p.id === packageId);
          if (pkg) {
            const { createPTInvoice } = await import('@/lib/actions/pt');
            await createPTInvoice({
              client_id: res.data.id,
              invoice_date: startDate,
              trainer_id: trainerId || null,
              package_id: packageId,
              package_name: pkg.package_name,
              sessions_included: pkg.number_of_sessions,
              sessions_remaining_at_invoice: pkg.number_of_sessions,
              price: pkg.price,
              discount: pkg.discount,
              gst_amount: 0,
              tax_amount: 0,
              final_amount: pkg.final_price,
              payment_method: null,
              paid_amount: 0,
              balance_due: pkg.final_price,
              due_date: startDate,
              status: 'Pending'
            });
          }
        }

        if (height || weight || bodyFat) {
          const { createPTProgress } = await import('@/lib/actions/pt');
          await createPTProgress({
            client_id: res.data.id,
            date: startDate,
            height: height ? Number(height) : null,
            weight: weight ? Number(weight) : null,
            body_fat: bodyFat ? Number(bodyFat) : null,
            notes: 'Initial metrics collected upon registration.'
          });
        }

        toast.success('PT Client registered successfully!');
        router.push(`/pt/members/${res.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Registration failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-enter">
      <div className="mb-4">
        <Link href="/pt/members" className="btn btn-ghost btn-sm pl-0 gap-1.5 text-slate-600 hover:text-slate-900 font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to clients list
        </Link>
      </div>

      <PageHeader
        title="PT Client Registration"
        subtitle="Register new clients under Personal Training module and configure trainer package assignments."
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Primary Details Card */}
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Primary Client Details</h3>

                <FormField label="Link Existing Gym Member (Optional)">
                  <select
                    className="select-field w-full font-semibold text-slate-800"
                    value={selectedMemberId}
                    onChange={(e) => handleMemberChange(e.target.value)}
                  >
                    <option value="">-- Create Standalone PT Client --</option>
                    {gymMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({m.phone})</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Full Name" required>
                  <input
                    type="text"
                    className="input-field w-full font-semibold text-slate-800"
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
                      className="input-field w-full font-semibold text-slate-800"
                      placeholder="10-digit phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Email Address">
                    <input
                      type="email"
                      className="input-field w-full font-semibold text-slate-800"
                      placeholder="email@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField label="Emergency Contact Info">
                  <input
                    type="text"
                    className="input-field w-full font-semibold text-slate-800"
                    placeholder="Name and number of contact person"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                  />
                </FormField>
              </div>

              {/* PT Package Settings */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Training Package Config</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Select PT Package">
                    <select
                      className="select-field w-full font-semibold text-slate-800"
                      value={packageId}
                      onChange={(e) => handlePackageChange(e.target.value)}
                    >
                      <option value="">-- Custom Package (Enter sessions manually) --</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.package_name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Assigned Personal Trainer">
                    <select
                      className="select-field w-full font-semibold text-slate-800"
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Sessions Purchased">
                    <input
                      type="number"
                      min="1"
                      className="input-field w-full font-semibold text-slate-800"
                      value={sessionsPurchased}
                      onChange={(e) => setSessionsPurchased(Number(e.target.value))}
                    />
                  </FormField>

                  <FormField label="Status">
                    <select
                      className="select-field w-full font-semibold text-slate-800"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as any)}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Package Start Date" required>
                    <input
                      type="date"
                      className="input-field w-full font-semibold text-slate-800"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Expiry Date" required>
                    <input
                      type="date"
                      className="input-field w-full font-semibold text-slate-800"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      required
                    />
                  </FormField>
                </div>
              </div>
            </div>

            {/* Metrics and Assessment */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-6 space-y-4 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3">Physical Metrics & Goals</h3>

                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Height (cm)">
                    <input
                      type="number"
                      step="0.1"
                      className="input-field w-full text-center font-semibold text-slate-800"
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Weight (kg)">
                    <input
                      type="number"
                      step="0.1"
                      className="input-field w-full text-center font-semibold text-slate-800"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </FormField>

                  <FormField label="Body Fat %">
                    <input
                      type="number"
                      step="0.1"
                      className="input-field w-full text-center font-semibold text-slate-800"
                      value={bodyFat}
                      onChange={(e) => setBodyFat(e.target.value)}
                    />
                  </FormField>
                </div>

                <FormField label="Fitness Goal">
                  <textarea
                    className="textarea-field w-full min-h-[80px] font-medium text-slate-800"
                    placeholder="e.g. Lose 5kg body fat, build endurance"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </FormField>

                <FormField label="Medical Notes / Injuries">
                  <textarea
                    className="textarea-field w-full min-h-[80px] font-medium text-slate-800"
                    placeholder="e.g. Back pain, diabetic history, knee stiffness"
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                  />
                </FormField>
              </div>

              {/* Action Button */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary w-full py-3 text-md font-bold flex items-center justify-center gap-2 shadow-md shadow-amber-200/50"
                >
                  <UserPlus className="h-5 w-5" />
                  {submitting ? 'Registering...' : 'Register PT Client'}
                </button>
                <Link href="/pt/members" className="btn btn-secondary w-full py-3 text-center">
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