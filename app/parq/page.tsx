'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { getParqResponses } from '@/lib/actions/parq';
import { ParqResponse } from '@/types';
import { formatDate } from '@/lib/utils';

export default function ParqPage() {
  const [responses, setResponses] = useState<ParqResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParqResponses().then(setResponses).finally(() => setLoading(false));
  }, []);

  const hasRisk = (r: ParqResponse) =>
    Object.values(r.answers).some(v => v === 'yes');

  return (
    <div className="page-enter">
      <PageHeader
        title="PAR-Q Forms"
        subtitle="Physical Activity Readiness Questionnaires"
        action={
          <Link href="/parq/new" className="btn-yellow text-sm">
            <Plus className="w-4 h-4" /> New PAR-Q
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner size={36} />
      ) : responses.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No PAR-Q forms yet"
          description="Start by completing a PAR-Q health screening for a member."
          action={
            <Link href="/parq/new" className="btn-yellow text-sm">
              <Plus className="w-4 h-4" /> New PAR-Q Form
            </Link>
          }
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Risk Level</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {responses.map(r => {
                  const risk = hasRisk(r);
                  return (
                    <tr key={r.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-gray-900">{(r.member as { full_name: string } | undefined)?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-gray-400 sm:hidden">{formatDate(r.created_at)}</p>
                      </td>
                      <td className="px-4 py-4 text-gray-500 hidden sm:table-cell">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-4">
                        {risk ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3 h-3" /> At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-0.5 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Cleared
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/parq/${r.id}`}
                          className="text-xs font-semibold text-[#E6C200] hover:underline"
                        >
                          View →
                        </Link>
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
