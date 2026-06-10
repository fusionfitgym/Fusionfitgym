'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { PageHeader } from '@/components/ui/Primitives';
import { healthSchema, HealthFormValues, HealthFormInput } from '@/types';
import { createHealthAssessment } from '@/lib/actions/health';
import { getMembers } from '@/lib/actions/members';
import { Member } from '@/types';
import { calculateBMI, getBMICategory } from '@/lib/utils';

function BMIIndicator({ bmi }: { bmi: number | null }) {
  if (!bmi) return null;
  const { label, color } = getBMICategory(bmi);
  const percent = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
  return (
    <div className="p-4 rounded-xl border border-slate-100 bg-slate-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500">BMI</span>
        <span className="font-bold text-slate-900" style={{ color }}>{bmi} — {label}</span>
      </div>
      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>10</span><span>18.5</span><span>25</span><span>30</span><span>40+</span>
      </div>
    </div>
  );
}

function NewHealthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMember = searchParams.get('member');
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, control, formState: { errors } } = useForm<HealthFormInput, any, HealthFormValues>({
    resolver: zodResolver(healthSchema),
    defaultValues: { member_id: preselectedMember ?? '' },
  });

  const height = useWatch({ control, name: 'height' });
  const weight = useWatch({ control, name: 'weight' });
  const bmi = height && weight ? calculateBMI(Number(weight), Number(height)) : null;

  useEffect(() => { getMembers().then(setMembers); }, []);

  async function onSubmit(data: HealthFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const assessment = await createHealthAssessment(data);
      router.push(`/health/${assessment.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save assessment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto"
    >
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center text-sm text-slate-400 gap-1.5 font-medium">
        <Link href="/health" className="hover:text-slate-600 transition-colors">Health Assessments</Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900">New Assessment</span>
      </div>

      <PageHeader
        title="New Health Assessment"
        subtitle="Record member fitness metrics"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Member Selection */}
        <div className="card p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-section-title text-lg">Select Member</h3>
            <p className="text-sm text-slate-400 mt-1">Choose the member for this assessment</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <label className="text-label block mb-2">Member <span className="text-red-500">*</span></label>
            <select {...register('member_id')} className="select-field">
              <option value="">Select a member...</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>)}
            </select>
            {errors.member_id && <p className="text-xs text-red-500 mt-1.5 font-medium">{errors.member_id.message}</p>}
          </div>
        </div>

        {/* Body Measurements */}
        <div className="card p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-section-title text-lg">Body Measurements</h3>
            <p className="text-sm text-slate-400 mt-1">Height, weight, and body composition</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                { name: 'height' as const, label: 'Height (cm)', placeholder: '175' },
                { name: 'weight' as const, label: 'Weight (kg)', placeholder: '70' },
                { name: 'body_fat' as const, label: 'Body Fat (%)', placeholder: '20' },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-label block mb-2">{f.label}</label>
                  <input {...register(f.name)} type="number" step="0.1" placeholder={f.placeholder} className="input-field" />
                  {errors[f.name] && <p className="text-xs text-red-500 mt-1.5 font-medium">{String(errors[f.name]?.message)}</p>}
                </div>
              ))}
            </div>
            <div className="mt-5">
              <BMIIndicator bmi={bmi} />
            </div>
          </div>
        </div>

        {/* Medical History */}
        <div className="card p-6 mb-6">
          <div className="mb-4">
            <h3 className="text-section-title text-lg">Medical History</h3>
            <p className="text-sm text-slate-400 mt-1">Past injuries, conditions, and notes</p>
          </div>
          <div className="border-t border-slate-100 pt-6 space-y-5">
            {[
              { name: 'injuries' as const, label: 'Injury History', placeholder: 'Describe any past injuries...' },
              { name: 'medical_conditions' as const, label: 'Medical Conditions', placeholder: 'Describe any medical conditions...' },
              { name: 'notes' as const, label: 'Additional Notes', placeholder: 'Any other relevant notes...' },
            ].map(f => (
              <div key={f.name}>
                <label className="text-label block mb-2">{f.label}</label>
                <textarea {...register(f.name)} rows={3} placeholder={f.placeholder} className="textarea-field" />
              </div>
            ))}
          </div>
        </div>

        {error && <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-600 mb-6 font-medium">{error}</div>}

        {/* Sticky Footer */}
        <div className="sticky bottom-0 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-lg border-t border-slate-200 z-10">
          <div className="flex flex-col sm:flex-row gap-3 justify-end max-w-3xl mx-auto">
            <Link href="/health" className="btn-outline w-full sm:w-auto">Cancel</Link>
            <button type="submit" disabled={submitting} className="btn-gold-gradient w-full sm:w-auto">
              {submitting ? <Loader2 className="w-5 h-5 spin" /> : <Save className="w-5 h-5" />}
              {submitting ? 'Saving...' : 'Save Assessment'}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}

export default function NewHealthPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-slate-400">Loading...</div>}>
      <NewHealthForm />
    </Suspense>
  );
}
