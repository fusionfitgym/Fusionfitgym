'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  ClipboardCheck,
  FileText,
  Printer,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  Breadcrumb,
  Card,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { getParqById } from '@/lib/actions/parq';
import { PARQ_QUESTIONS, ParqResponse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function ParqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [response, setResponse] = useState<ParqResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParqById(id)
      .then(setResponse)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;
  if (!response) return <div className="empty-state"><p className="card-title">PAR-Q form not found</p></div>;

  const member = response.member as { full_name: string; phone: string } | undefined;
  const hasRisk = Object.values(response.answers).some((value) => value === 'yes');

  return (
    <div className="page-narrow page-enter">
      <div className="print-hidden">
        <Breadcrumb
          items={[
            { label: 'PAR-Q forms', href: '/parq' },
            { label: formatDate(response.created_at) },
          ]}
        />
        <PageHeader
          title="PAR-Q form"
          subtitle={`Completed ${formatDate(response.created_at)}`}
          action={
            <>
              <Link href="/parq" className="btn btn-secondary">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
              <button type="button" onClick={() => window.print()} className="btn btn-primary">
                <Printer className="h-4 w-4" /> Print
              </button>
            </>
          }
        />
      </div>

      <div id="parq-report" className="page-stack">
        <Card>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xl font-bold tracking-tight text-slate-950">FusionFit Gym</p>
              <p className="mt-1 text-xs text-slate-500">Physical Activity Readiness Questionnaire</p>
              <p className="mt-1 text-xs text-slate-500">Date: {formatDate(response.created_at)}</p>
            </div>
            <span className={hasRisk ? 'badge badge-risk self-start' : 'badge badge-cleared self-start'}>
              {hasRisk ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle className="h-3.5 w-3.5" />}
              {hasRisk ? 'Medical clearance required' : 'Cleared for exercise'}
            </span>
          </div>

          {member && (
            <div className="mt-5 flex items-center gap-3 border-t border-slate-200 pt-4">
              <span className="icon-box"><UserRound className="h-5 w-5" /></span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{member.full_name}</p>
                <p className="mt-1 text-xs text-slate-500">{member.phone}</p>
              </div>
            </div>
          )}
        </Card>

        <SectionCard
          title="Health screening responses"
          description="Answers recorded for the seven standard readiness questions."
          icon={<ClipboardCheck className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {PARQ_QUESTIONS.map((question, index) => {
              const isYes = response.answers[question.id] === 'yes';
              return (
                <div
                  key={question.id}
                  className={isYes
                    ? 'rounded-xl border border-red-200 bg-red-50 p-4'
                    : 'rounded-xl border border-slate-200 bg-slate-50 p-4'}
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-500 shadow-sm">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 text-sm leading-6 text-slate-700">{question.text}</p>
                    <span className={isYes ? 'badge badge-risk' : 'badge badge-cleared'}>
                      {isYes ? <XCircle className="h-3 w-3" /> : <CheckCircle className="h-3 w-3" />}
                      {isYes ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {response.notes && (
          <SectionCard
            title="Additional notes"
            icon={<FileText className="h-5 w-5" />}
          >
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{response.notes}</p>
          </SectionCard>
        )}

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
          <p className="font-semibold">Important notice</p>
          <p className="mt-1">
            A yes response should be reviewed with a medical professional before the member starts a new physical activity program.
            This PAR-Q is valid for 12 months from completion.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #parq-report, #parq-report * { visibility: visible; }
          #parq-report { position: absolute; inset: 0 auto auto 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
