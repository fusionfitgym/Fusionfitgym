'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Activity, Dumbbell, FileText, Flame, Loader2, Save, UserRound, Zap } from 'lucide-react';
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
import {
  calculateAge,
  calculateBMI,
  calculateBMR,
  getBMICategory,
  getBodyFatCategory,
  getSkeletalMuscleCategory,
  getSubcutaneousFatCategory,
} from '@/lib/utils';

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

  const memberId = useWatch({ control, name: 'member_id' });
  const height = useWatch({ control, name: 'height' });
  const weight = useWatch({ control, name: 'weight' });
  const bodyFat = useWatch({ control, name: 'body_fat' });

  // Subcutaneous Fat watches
  const subFatWhole = useWatch({ control, name: 'subcutaneous_fat_whole_body' });
  const subFatTrunk = useWatch({ control, name: 'subcutaneous_fat_trunk' });
  const subFatArms = useWatch({ control, name: 'subcutaneous_fat_arms' });
  const subFatLegs = useWatch({ control, name: 'subcutaneous_fat_legs' });

  // Resting Metabolism watch
  const restingMetabolism = useWatch({ control, name: 'resting_metabolism' });

  // Skeletal Muscle watches
  const muscleWhole = useWatch({ control, name: 'skeletal_muscle_whole_body' });
  const muscleTrunk = useWatch({ control, name: 'skeletal_muscle_trunk' });
  const muscleArms = useWatch({ control, name: 'skeletal_muscle_arms' });
  const muscleLegs = useWatch({ control, name: 'skeletal_muscle_legs' });

  const selectedMember = members.find((m) => m.id === memberId);
  const gender = selectedMember?.gender ?? 'Gents';
  const memberAge = calculateAge(selectedMember?.dob) ?? 30;

  const bmi = height && weight ? calculateBMI(Number(weight), Number(height)) : null;
  const estimatedBMR = height && weight ? calculateBMR(Number(weight), Number(height), memberAge, gender) : null;

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
        subtitle="Record body measurements, subcutaneous fat, resting metabolism, and skeletal muscle breakdown."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        {/* Section 1: Member Selection */}
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
                <option key={member.id} value={member.id}>{member.full_name} - {member.phone} ({member.gender})</option>
              ))}
            </select>
          </FormField>
        </SectionCard>

        {/* Section 2: General Body Measurements */}
        <SectionCard
          title="Body measurements"
          description="Basic metrics: height, weight, overall body fat percentage, and BMI."
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
                <div className="relative">
                  <input
                    id={field.name}
                    type="number"
                    step="0.1"
                    placeholder={field.placeholder}
                    className="input-field"
                    aria-invalid={Boolean(errors[field.name])}
                    {...register(field.name)}
                  />
                </div>
              </FormField>
            ))}
          </div>

          {/* Body Fat Category & BMI Indicator */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <BMIIndicator bmi={bmi} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-500">Body Fat Assessment</span>
              {bodyFat ? (() => {
                const cat = getBodyFatCategory(Number(bodyFat), gender);
                return (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-2xl font-bold text-slate-900">{bodyFat}%</span>
                    <span className="badge font-bold px-3 py-1 text-sm rounded-full" style={{ background: `${cat.color}18`, color: cat.color }}>
                      {cat.label}
                    </span>
                  </div>
                );
              })() : (
                <p className="mt-2 text-xs text-slate-400">Enter overall body fat percentage to see health evaluation level.</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Section 3: Subcutaneous Fat (%) Card */}
        <SectionCard
          title="Subcutaneous Fat (%)"
          description="Track subcutaneous fat percentages across body segments (Whole body, Trunk, Arms, Leg)."
          icon={<Flame className="h-5 w-5 text-amber-500" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'subcutaneous_fat_whole_body' as const, region: 'whole_body' as const, label: 'Whole Body Fat (%)', val: subFatWhole },
              { name: 'subcutaneous_fat_trunk' as const, region: 'trunk' as const, label: 'Trunk Fat (%)', val: subFatTrunk },
              { name: 'subcutaneous_fat_arms' as const, region: 'arms' as const, label: 'Arms Fat (%)', val: subFatArms },
              { name: 'subcutaneous_fat_legs' as const, region: 'legs' as const, label: 'Leg Fat (%)', val: subFatLegs },
            ].map((field) => {
              const cat = field.val !== undefined && field.val !== null && field.val !== '' && !Number.isNaN(Number(field.val))
                ? getSubcutaneousFatCategory(Number(field.val), field.region, gender)
                : null;
              return (
                <div key={field.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={field.name} className="text-xs font-bold text-slate-700">{field.label}</label>
                    {cat && (
                      <span className="badge text-[10px] px-2 py-0.5 font-bold" style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <input
                    id={field.name}
                    type="number"
                    step="0.1"
                    placeholder="e.g. 15.2"
                    className="input-field bg-white"
                    aria-invalid={Boolean(errors[field.name])}
                    {...register(field.name)}
                  />
                  {errors[field.name]?.message && (
                    <p className="text-[11px] text-red-500">{String(errors[field.name]?.message)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Section 4: RM (Resting Metabolism) Card */}
        <SectionCard
          title="RM (Resting Metabolism)"
          description="Record Resting Metabolism (kcal) and compare against estimated BMR benchmark."
          icon={<Zap className="h-5 w-5 text-orange-500" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField
              label="Resting Metabolism (RM kcal/day)"
              htmlFor="resting_metabolism"
              error={errors.resting_metabolism?.message ? String(errors.resting_metabolism?.message) : undefined}
            >
              <input
                id="resting_metabolism"
                type="number"
                step="1"
                placeholder={estimatedBMR ? `e.g. ${estimatedBMR}` : 'e.g. 1650'}
                className="input-field"
                aria-invalid={Boolean(errors.resting_metabolism)}
                {...register('resting_metabolism')}
              />
            </FormField>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <span className="text-xs font-semibold text-slate-500">Estimated BMR Benchmark</span>
              {estimatedBMR ? (
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-slate-900">{estimatedBMR}</span>
                    <span className="text-xs text-slate-500 ml-1">kcal/day</span>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                    {gender} • {memberAge} yrs
                  </span>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">Enter height and weight above to compute estimated Basal Metabolic Rate.</p>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Section 5: Skeletal Muscle (%) Card */}
        <SectionCard
          title="RM Skeletal Muscle (%)"
          description="Track skeletal muscle percentages across body segments (Whole body, Trunk, Arms, Leg)."
          icon={<Dumbbell className="h-5 w-5 text-indigo-500" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'skeletal_muscle_whole_body' as const, region: 'whole_body' as const, label: 'Whole Body Muscle (%)', val: muscleWhole },
              { name: 'skeletal_muscle_trunk' as const, region: 'trunk' as const, label: 'Trunk Muscle (%)', val: muscleTrunk },
              { name: 'skeletal_muscle_arms' as const, region: 'arms' as const, label: 'Arms Muscle (%)', val: muscleArms },
              { name: 'skeletal_muscle_legs' as const, region: 'legs' as const, label: 'Leg Muscle (%)', val: muscleLegs },
            ].map((field) => {
              const cat = field.val !== undefined && field.val !== null && field.val !== '' && !Number.isNaN(Number(field.val))
                ? getSkeletalMuscleCategory(Number(field.val), field.region, gender)
                : null;
              return (
                <div key={field.name} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor={field.name} className="text-xs font-bold text-slate-700">{field.label}</label>
                    {cat && (
                      <span className="badge text-[10px] px-2 py-0.5 font-bold" style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.label}
                      </span>
                    )}
                  </div>
                  <input
                    id={field.name}
                    type="number"
                    step="0.1"
                    placeholder="e.g. 36.5"
                    className="input-field bg-white"
                    aria-invalid={Boolean(errors[field.name])}
                    {...register(field.name)}
                  />
                  {errors[field.name]?.message && (
                    <p className="text-[11px] text-red-500">{String(errors[field.name]?.message)}</p>
                  )}
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Section 6: Medical Notes */}
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
