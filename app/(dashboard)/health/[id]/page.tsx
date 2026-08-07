'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, Dumbbell, FileText, Flame, UserRound, Zap } from 'lucide-react';
import {
  Breadcrumb,
  Card,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { getHealthById } from '@/lib/actions/health';
import { HealthAssessment } from '@/types';
import {
  calculateAge,
  calculateBMR,
  formatDate,
  getBMICategory,
  getBodyFatCategory,
  getSkeletalMuscleCategory,
  getSubcutaneousFatCategory,
} from '@/lib/utils';

function BMIGauge({ bmi }: { bmi: number }) {
  const { label, color } = getBMICategory(bmi);
  const percent = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
  const angle = (percent / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center py-2">
      <div className="relative h-24 w-48 overflow-hidden">
        <div
          className="absolute inset-0 rounded-t-full"
          style={{ background: 'conic-gradient(from 180deg, #60a5fa 0deg, #4ade80 36deg, #fb923c 72deg, #f87171 108deg, #f87171 180deg)' }}
        />
        <div className="absolute bottom-0 left-1/2 h-16 w-32 -translate-x-1/2 rounded-t-full bg-white" />
        <div
          className="absolute bottom-0 left-1/2 h-14 w-0.5 origin-bottom rounded-full bg-slate-800"
          style={{ transform: `translateX(-50%) rotate(${angle}deg)` }}
        />
        <div className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-slate-800" />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight" style={{ color }}>{bmi}</p>
      <p className="mt-1 text-sm font-semibold text-slate-600">{label}</p>
    </div>
  );
}

export default function HealthDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthById(id)
      .then(setAssessment)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!assessment) return <div className="empty-state"><p className="card-title">Assessment not found</p></div>;

  const member = assessment.member as { full_name: string; gender?: 'Gents' | 'Ladies'; dob?: string } | undefined;
  const gender = member?.gender ?? 'Gents';
  const age = calculateAge(member?.dob) ?? 30;

  const hasSubFat = Boolean(
    assessment.subcutaneous_fat_whole_body ||
    assessment.subcutaneous_fat_trunk ||
    assessment.subcutaneous_fat_arms ||
    assessment.subcutaneous_fat_legs
  );

  const hasMuscle = Boolean(
    assessment.skeletal_muscle_whole_body ||
    assessment.skeletal_muscle_trunk ||
    assessment.skeletal_muscle_arms ||
    assessment.skeletal_muscle_legs
  );

  const estimatedBMR = assessment.weight && assessment.height
    ? calculateBMR(Number(assessment.weight), Number(assessment.height), age, gender)
    : null;

  const fatMassKg = assessment.weight && assessment.body_fat
    ? ((Number(assessment.weight) * Number(assessment.body_fat)) / 100).toFixed(1)
    : null;

  const muscleMassKg = assessment.weight && assessment.skeletal_muscle_whole_body
    ? ((Number(assessment.weight) * Number(assessment.skeletal_muscle_whole_body)) / 100).toFixed(1)
    : null;

  return (
    <div className="page-narrow page-enter">
      <Breadcrumb
        items={[
          { label: 'Health assessments', href: '/health' },
          { label: formatDate(assessment.created_at) },
        ]}
      />
      <PageHeader
        title="Health assessment"
        subtitle={`Recorded ${formatDate(assessment.created_at)}`}
        action={
          <Link href="/health" className="btn btn-secondary">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
        }
      />

      <div className="page-stack">
        <Card>
          <div className="flex items-center gap-3">
            <span className="icon-box"><UserRound className="h-5 w-5" /></span>
            <div>
              <p className="text-sm font-semibold text-slate-950">{member?.full_name ?? 'Unknown member'}</p>
              <p className="mt-1 text-xs text-slate-500">
                Assessment date: {formatDate(assessment.created_at)} • Gender: {gender}
              </p>
            </div>
          </div>
        </Card>

        {/* Basic Body Metrics */}
        <SectionCard
          title="Body metrics & fat evaluation"
          description="Basic measurements captured during this assessment."
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="metric-grid">
            {[
              { label: 'Height', value: assessment.height ? `${assessment.height} cm` : '-' },
              { label: 'Weight', value: assessment.weight ? `${assessment.weight} kg` : '-' },
              { label: 'Body fat', value: assessment.body_fat ? `${assessment.body_fat}%` : '-' },
              { label: 'BMI', value: assessment.bmi ? String(assessment.bmi) : '-' },
              { label: 'Fat Mass (Est.)', value: fatMassKg ? `${fatMassKg} kg` : '-' },
              { label: 'Muscle Mass (Est.)', value: muscleMassKg ? `${muscleMassKg} kg` : '-' },
            ].map(({ label, value }) => (
              <div key={label} className="metric-tile">
                <p className="metric-label">{label}</p>
                <p className="metric-value">{value}</p>
              </div>
            ))}
          </div>

          {assessment.body_fat && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Body Fat Classification</p>
                <p className="text-xl font-bold text-slate-900 mt-1">{assessment.body_fat}%</p>
              </div>
              {(() => {
                const cat = getBodyFatCategory(Number(assessment.body_fat), gender);
                return (
                  <span className="badge font-bold px-3 py-1 text.sm rounded-full" style={{ background: `${cat.color}20`, color: cat.color }}>
                    {cat.label} Fat Level
                  </span>
                );
              })()}
            </div>
          )}

          {assessment.bmi && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">BMI Index</p>
              <BMIGauge bmi={assessment.bmi} />
            </div>
          )}
        </SectionCard>

        {/* Subcutaneous Fat Breakdown */}
        {hasSubFat && (
          <SectionCard
            title="Subcutaneous Fat Breakdown (%)"
            description="Segmental subcutaneous fat measurements (Whole Body, Trunk, Arms, Leg)."
            icon={<Flame className="h-5 w-5 text-amber-500" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Whole Body', value: assessment.subcutaneous_fat_whole_body, region: 'whole_body' as const },
                { label: 'Trunk', value: assessment.subcutaneous_fat_trunk, region: 'trunk' as const },
                { label: 'Arms', value: assessment.subcutaneous_fat_arms, region: 'arms' as const },
                { label: 'Leg', value: assessment.subcutaneous_fat_legs, region: 'legs' as const },
              ].map(({ label, value, region }) => {
                if (value === undefined || value === null) return null;
                const cat = getSubcutaneousFatCategory(Number(value), region, gender);
                const percent = Math.min(100, Math.max(0, Number(value)));
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{label}</span>
                      <span className="badge text-[11px] font-bold px-2 py-0.5" style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-slate-900">{value}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Resting Metabolism (RM) */}
        {(assessment.resting_metabolism || estimatedBMR) && (
          <SectionCard
            title="Resting Metabolism (RM)"
            description="Metabolic rate and daily energy baseline."
            icon={<Zap className="h-5 w-5 text-orange-500" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <span className="text-xs font-semibold text-slate-500">Recorded Resting Metabolism (RM)</span>
                <p className="mt-2 text-3xl font-black text-slate-900">
                  {assessment.resting_metabolism ? `${assessment.resting_metabolism} kcal` : 'Not recorded'}
                </p>
              </div>
              {estimatedBMR && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <span className="text-xs font-semibold text-slate-500">Calculated BMR Benchmark</span>
                  <p className="mt-2 text-3xl font-bold text-emerald-700">{estimatedBMR} kcal</p>
                  <p className="mt-1 text-xs text-slate-500">Mifflin-St Jeor formula based on height, weight, and age.</p>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Skeletal Muscle Breakdown */}
        {hasMuscle && (
          <SectionCard
            title="RM Skeletal Muscle Breakdown (%)"
            description="Segmental skeletal muscle measurements (Whole Body, Trunk, Arms, Leg)."
            icon={<Dumbbell className="h-5 w-5 text-indigo-500" />}
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: 'Whole Body', value: assessment.skeletal_muscle_whole_body, region: 'whole_body' as const },
                { label: 'Trunk', value: assessment.skeletal_muscle_trunk, region: 'trunk' as const },
                { label: 'Arms', value: assessment.skeletal_muscle_arms, region: 'arms' as const },
                { label: 'Leg', value: assessment.skeletal_muscle_legs, region: 'legs' as const },
              ].map(({ label, value, region }) => {
                if (value === undefined || value === null) return null;
                const cat = getSkeletalMuscleCategory(Number(value), region, gender);
                const percent = Math.min(100, Math.max(0, Number(value)));
                return (
                  <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">{label}</span>
                      <span className="badge text-[11px] font-bold px-2 py-0.5" style={{ background: `${cat.color}20`, color: cat.color }}>
                        {cat.label}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-slate-900">{value}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, backgroundColor: cat.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {(assessment.injuries || assessment.medical_conditions || assessment.notes) && (
          <SectionCard
            title="Medical information"
            description="Notes relevant to training and member care."
            icon={<FileText className="h-5 w-5" />}
          >
            <div className="space-y-4">
              {[
                { label: 'Injury history', value: assessment.injuries },
                { label: 'Medical conditions', value: assessment.medical_conditions },
                { label: 'Additional notes', value: assessment.notes },
              ].map(({ label, value }) => value ? (
                <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="metric-label">{label}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{value}</p>
                </div>
              ) : null)}
            </div>
          </SectionCard>
        )}
      </div>
    </div>
  );
}
