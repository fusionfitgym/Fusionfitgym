'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowLeft, FileText, UserRound } from 'lucide-react';
import {
  Breadcrumb,
  Card,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { getHealthById } from '@/lib/actions/health';
import { HealthAssessment } from '@/types';
import { formatDate, getBMICategory } from '@/lib/utils';

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

  const member = assessment.member as { full_name: string } | undefined;

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
              <p className="mt-1 text-xs text-slate-500">Assessment date: {formatDate(assessment.created_at)}</p>
            </div>
          </div>
        </Card>

        <SectionCard
          title="Body metrics"
          description="Measurements captured during this assessment."
          icon={<Activity className="h-5 w-5" />}
        >
          <div className="metric-grid">
            {[
              { label: 'Height', value: assessment.height ? `${assessment.height} cm` : '-' },
              { label: 'Weight', value: assessment.weight ? `${assessment.weight} kg` : '-' },
              { label: 'Body fat', value: assessment.body_fat ? `${assessment.body_fat}%` : '-' },
              { label: 'BMI', value: assessment.bmi ? String(assessment.bmi) : '-' },
            ].map(({ label, value }) => (
              <div key={label} className="metric-tile">
                <p className="metric-label">{label}</p>
                <p className="metric-value">{value}</p>
              </div>
            ))}
          </div>

          {assessment.bmi && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">BMI index</p>
              <BMIGauge bmi={assessment.bmi} />
            </div>
          )}
        </SectionCard>

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
