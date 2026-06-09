'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { healthSchema, HealthFormValues } from '@/types';
import { createHealthAssessment } from '@/lib/actions/health';
import { getMembers } from '@/lib/actions/members';
import { Member } from '@/types';
import { calculateBMI, getBMICategory } from '@/lib/utils';

function BMIIndicator({ bmi }: { bmi: number | null }) {
  if (!bmi) return null;
  const { label, color } = getBMICategory(bmi);
  const percent = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
  return (
    <div className="p-4 rounded-xl border border-gray-100 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-500">BMI</span>
        <span className="font-bold text-gray-900" style={{ color }}>{bmi} — {label}</span>
      </div>
      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
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

  const { register, handleSubmit, control, formState: { errors } } = useForm<HealthFormValues>({
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
    <div className="page-enter max-w-2xl mx-auto">
      <PageHeader
        title="New Health Assessment"
        subtitle="Record member fitness metrics"
        action={
          <Link href="/health" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Member <span className="text-red-500">*</span>
          </label>
          <select {...register('member_id')} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
            <option value="">Select a member...</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>)}
          </select>
          {errors.member_id && <p className="text-xs text-red-500 mt-1">{errors.member_id.message}</p>}
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Body Measurements</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { name: 'height' as const, label: 'Height (cm)', placeholder: '175' },
              { name: 'weight' as const, label: 'Weight (kg)', placeholder: '70' },
              { name: 'body_fat' as const, label: 'Body Fat (%)', placeholder: '20' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                <input
                  {...register(f.name)}
                  type="number"
                  step="0.1"
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                />
                {errors[f.name] && <p className="text-xs text-red-500 mt-1">{String(errors[f.name]?.message)}</p>}
              </div>
            ))}
          </div>

          {/* Live BMI Preview */}
          <div className="mt-4">
            <BMIIndicator bmi={bmi} />
          </div>
        </Card>

        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Medical History</h3>
          <div className="space-y-4">
            {[
              { name: 'injuries' as const, label: 'Injury History', placeholder: 'Describe any past injuries...' },
              { name: 'medical_conditions' as const, label: 'Medical Conditions', placeholder: 'Describe any medical conditions...' },
              { name: 'notes' as const, label: 'Additional Notes', placeholder: 'Any other relevant notes...' },
            ].map(f => (
              <div key={f.name}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">{f.label}</label>
                <textarea
                  {...register(f.name)}
                  rows={2}
                  placeholder={f.placeholder}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
                />
              </div>
            ))}
          </div>
        </Card>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-yellow">
            {submitting ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save Assessment'}
          </button>
          <Link href="/health" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

export default function NewHealthPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <NewHealthForm />
    </Suspense>
  );
}
