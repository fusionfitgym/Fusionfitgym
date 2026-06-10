'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
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
          <div className="data-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden sm:table-cell">Date</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Risk Level</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {responses.map(r => {
                  const risk = hasRisk(r);
                  return (
                    <tr key={r.id} className="table-row-hover">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{(r.member as { full_name: string } | undefined)?.full_name ?? 'Unknown'}</p>
                        <p className="text-xs text-slate-400 sm:hidden">{formatDate(r.created_at)}</p>
                      </td>
                      <td className="px-4 py-4 text-slate-500 hidden sm:table-cell">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-4">
                        {risk ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3.5 h-3.5" /> At Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                            <CheckCircle className="w-3.5 h-3.5" /> Cleared
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/parq/${r.id}`}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline transition-colors"
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

          <div className="data-cards flex-col divide-y divide-slate-100 hidden">
            {responses.map(r => {
              const risk = hasRisk(r);
              return (
                <div key={r.id} className="p-4 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{(r.member as { full_name: string } | undefined)?.full_name ?? 'Unknown'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(r.created_at)}</p>
                    </div>
                    {risk ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                        <XCircle className="w-3.5 h-3.5" /> At Risk
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                        <CheckCircle className="w-3.5 h-3.5" /> Cleared
                      </span>
                    )}
                  </div>

                  <div className="mt-2 pt-3 border-t border-slate-50">
                    <Link
                      href={`/parq/${r.id}`}
                      className="block w-full py-2 text-center rounded-lg bg-amber-50 text-amber-600 text-sm font-medium hover:bg-amber-100 transition-colors"
                    >
                      View PAR-Q
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </motion.div>
  );
}
