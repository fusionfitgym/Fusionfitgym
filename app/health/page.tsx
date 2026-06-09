'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, HeartPulse } from 'lucide-react';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { getHealthAssessments } from '@/lib/actions/health';
import { HealthAssessment } from '@/types';
import { formatDate, getBMICategory } from '@/lib/utils';

export default function HealthPage() {
  const [assessments, setAssessments] = useState<HealthAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthAssessments().then(setAssessments).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-enter">
      <PageHeader
        title="Health Assessments"
        subtitle="Track member fitness and health metrics"
        action={
          <Link href="/health/new" className="btn-yellow text-sm">
            <Plus className="w-4 h-4" /> New Assessment
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner size={36} />
      ) : assessments.length === 0 ? (
        <EmptyState
          icon="💪"
          title="No assessments yet"
          description="Start tracking member health metrics."
          action={<Link href="/health/new" className="btn-yellow text-sm"><Plus className="w-4 h-4" /> New Assessment</Link>}
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Height</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Weight</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">BMI</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Date</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {assessments.map(a => {
                  const bmiInfo = a.bmi ? getBMICategory(a.bmi) : null;
                  const member = a.member as { full_name: string } | undefined;
                  return (
                    <tr key={a.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{member?.full_name ?? 'Unknown'}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-600 hidden sm:table-cell">{a.height ? `${a.height} cm` : '—'}</td>
                      <td className="px-4 py-4 text-gray-600 hidden sm:table-cell">{a.weight ? `${a.weight} kg` : '—'}</td>
                      <td className="px-4 py-4">
                        {a.bmi && bmiInfo ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                            style={{ background: bmiInfo.color + '22', color: bmiInfo.color }}
                          >
                            {a.bmi} — {bmiInfo.label}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden md:table-cell">{formatDate(a.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        <Link href={`/health/${a.id}`} className="text-xs font-semibold text-[#E6C200] hover:underline">View →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
