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

  // Handle Package Selection (Pre-fill sessions and duration)
  const handlePackageChange = (pkgId: string) => {
    setPackageId(pkgId);
    if (!pkgId) return;
    const pkg = packages.find(p => p.id === pkgId);
    if (pkg) {
      setSessionsPurchased(pkg.number_of_sessions);
      if (pkg.trainer_id) {
        setTrainerId(pkg.trainer_id);
      }
      
      // Calculate expiry date automatically based on package duration
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
        
        // Also create a demo invoice automatically for the package purchased
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
        
        // Create initial progress record as well
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

        // Create invoice for new registration
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

        // Create progress record
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
        <Link href="/pt/members" className="btn btn-ghost btn-sm pl-0 gap-1 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to clients list
        </Link>
      </div>

      <PageHeader
        title="PT Client Registration"
        subtitle="Register new clients under Personal Training module and configure trainer package assignments."
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
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Primary Client Details</h3>

                <FormField label="Link Existing Gym Member (Optional)">
                  <select
                    className="input w-full"
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
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Training package config</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Select PT Package">
                    <select
                      className="input w-full"
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

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Sessions Purchased">
                    <input
                      type="number"
                      min="1"
                      className="input w-full"
                      value={sessionsPurchased}
                      onChange={(e) => setSessionsPurchased(Number(e.target.value))}
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
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Package Start Date" required>
                    <input
                      type="date"
                      className="input w-full"
                      value={startDate}
                      onChange={(e) => handleStartDateChange(e.target.value)}
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
                    placeholder="e.g. Lose 5kg body fat, build endurance"
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                  />
                </FormField>

                <FormField label="Medical Notes / Injuries">
                  <textarea
                    className="input w-full min-h-[80px]"
                    placeholder="e.g. Back pain, diabetic history, knee stiffness"
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