'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, FileText, Loader2, Save, UserRound } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Breadcrumb,
  FormActions,
  FormError,
  FormField,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { createHealthAssessment } from '@/lib/actions/health';
import { getMembers } from '@/lib/actions/members';
import { HealthFormInput, HealthFormValues, healthSchema, Member } from '@/types';
import { calculateBMI, getBMICategory } from '@/lib/utils';

function BMIIndicator({ bmi }: { bmi: number | null }) {
  if (!bmi) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
        Enter height and weight to calculate BMI automatically.
      </div>
    );
  }

  const { label, color } = getBMICategory(bmi);
  const percent = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-semibold text-slate-500">Calculated BMI</span>
        <span className="text-sm font-bold" style={{ color }}>{bmi} - {label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${percent}%`, background: color }} />
      </div>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
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

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<HealthFormInput, unknown, HealthFormValues>({
    resolver: zodResolver(healthSchema),
    defaultValues: { member_id: preselectedMember ?? '' },
  });

  const height = useWatch({ control, name: 'height' });
  const weight = useWatch({ control, name: 'weight' });
  const bmi = height && weight ? calculateBMI(Number(weight), Number(height)) : null;

  useEffect(() => {
    getMembers().then(setMembers);
  }, []);

  async function onSubmit(data: HealthFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const assessment = await createHealthAssessment(data);
      router.push(`/health/${assessment.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save assessment.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow page-enter">
      <Breadcrumb
        items={[
          { label: 'Health assessments', href: '/health' },
          { label: 'New assessment' },
        ]}
      />
      <PageHeader
        title="New health assessment"
        subtitle="Record body metrics and relevant medical notes for a member."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        <SectionCard
          title="Member"
          description="Choose the profile this assessment belongs to."
          icon={<UserRound className="h-5 w-5" />}
        >
          <FormField
            label="Member"
            htmlFor="member_id"
            required
            error={errors.member_id?.message}
          >
            <select
              id="member_id"
              className="select-field"
              aria-invalid={Boolean(errors.member_id)}
              {...register('member_id')}
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name} - {member.phone}</option>
              ))}
            </select>
          </FormField>
        </SectionCard>

        <SectionCard
          title="Body measurements"
          description="Use metric units for consistent tracking."
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="field-grid field-grid-3">
            {[
              { name: 'height' as const, label: 'Height (cm)', placeholder: '175' },
              { name: 'weight' as const, label: 'Weight (kg)', placeholder: '70' },
              { name: 'body_fat' as const, label: 'Body fat (%)', placeholder: '20' },
            ].map((field) => (
              <FormField
                key={field.name}
                label={field.label}
                htmlFor={field.name}
                error={errors[field.name]?.message ? String(errors[field.name]?.message) : undefined}
              >
                <input
                  id={field.name}
                  type="number"
                  step="0.1"
                  placeholder={field.placeholder}
                  className="input-field"
                  aria-invalid={Boolean(errors[field.name])}
                  {...register(field.name)}
                />
              </FormField>
            ))}
          </div>
          <div className="mt-4"><BMIIndicator bmi={bmi} /></div>
        </SectionCard>

        <SectionCard
          title="Medical notes"
          description="Capture information that may affect training recommendations."
          icon={<FileText className="h-5 w-5" />}
        >
          <div className="field-grid">
            {[
              { name: 'injuries' as const, label: 'Injury history', placeholder: 'Describe previous or current injuries' },
              { name: 'medical_conditions' as const, label: 'Medical conditions', placeholder: 'Describe known medical conditions' },
              { name: 'notes' as const, label: 'Additional notes', placeholder: 'Add any other relevant context' },
            ].map((field) => (
              <FormField key={field.name} label={field.label} htmlFor={field.name}>
                <textarea
                  id={field.name}
                  rows={3}
                  placeholder={field.placeholder}
                  className="textarea-field"
                  {...register(field.name)}
                />
              </FormField>
            ))}
          </div>
        </SectionCard>

        {error && <FormError>{error}</FormError>}

        <FormActions sticky>
          <Link href="/health" className="btn btn-secondary w-full sm:w-auto">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Saving...' : 'Save assessment'}
          </button>
        </FormActions>
      </form>
    </div>
  );
}

export default function NewHealthPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewHealthForm />
    </Suspense>
  );
}
