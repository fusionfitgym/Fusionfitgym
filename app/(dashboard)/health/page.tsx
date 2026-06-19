'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, HeartPulse, Plus } from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { getHealthAssessments } from '@/lib/actions/health';
import { HealthAssessment } from '@/types';
import { formatDate, getBMICategory } from '@/lib/utils';

export default function HealthPage() {
  const [assessments, setAssessments] = useState<HealthAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthAssessments()
      .then(setAssessments)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page page-enter">
      <PageHeader
        title="Health assessments"
        subtitle="Track body measurements, BMI, medical history, and fitness progress."
        action={
          <Link href="/health/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> New assessment
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon={<HeartPulse className="h-5 w-5" />}
          title="No assessments yet"
          description="Record the first health assessment to begin tracking member metrics."
          action={
            <Link href="/health/new" className="btn btn-primary">
              <Plus className="h-4 w-4" /> New assessment
            </Link>
          }
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="hidden sm:table-cell">Height</th>
                  <th className="hidden sm:table-cell">Weight</th>
                  <th>BMI</th>
                  <th className="hidden md:table-cell">Date</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((assessment) => {
                  const bmiInfo = assessment.bmi ? getBMICategory(assessment.bmi) : null;
                  const member = assessment.member as { full_name: string } | undefined;
                  return (
                    <tr key={assessment.id}>
                      <td><p className="table-primary">{member?.full_name ?? 'Unknown member'}</p></td>
                      <td className="hidden sm:table-cell">{assessment.height ? `${assessment.height} cm` : '-'}</td>
                      <td className="hidden sm:table-cell">{assessment.weight ? `${assessment.weight} kg` : '-'}</td>
                      <td>
                        {assessment.bmi && bmiInfo ? (
                          <span
                            className="badge"
                            style={{ background: `${bmiInfo.color}18`, color: bmiInfo.color }}
                          >
                            {assessment.bmi} {bmiInfo.label}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="hidden md:table-cell">{formatDate(assessment.created_at)}</td>
                      <td className="text-right">
                        <Link href={`/health/${assessment.id}`} className="btn btn-ghost btn-sm">
                          View <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="data-cards">
            {assessments.map((assessment) => {
              const bmiInfo = assessment.bmi ? getBMICategory(assessment.bmi) : null;
              const member = assessment.member as { full_name: string } | undefined;
              return (
                <article key={assessment.id} className="mobile-record">
                  <div className="mobile-record-header">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{member?.full_name ?? 'Unknown member'}</p>
                      <p className="mt-1 text-xs text-slate-500">{formatDate(assessment.created_at)}</p>
                    </div>
                    {assessment.bmi && bmiInfo && (
                      <span className="badge" style={{ background: `${bmiInfo.color}18`, color: bmiInfo.color }}>
                        BMI {assessment.bmi}
                      </span>
                    )}
                  </div>
                  <div className="mobile-record-meta">
                    <div>
                      <p className="metric-label">Height</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{assessment.height ? `${assessment.height} cm` : '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="metric-label">Weight</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{assessment.weight ? `${assessment.weight} kg` : '-'}</p>
                    </div>
                  </div>
                  <div className="mobile-record-actions">
                    <Link href={`/health/${assessment.id}`} className="btn btn-secondary btn-sm">
                      View details
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
