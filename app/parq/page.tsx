'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CheckCircle, ClipboardList, Plus, XCircle } from 'lucide-react';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { getParqResponses } from '@/lib/actions/parq';
import { ParqResponse } from '@/types';
import { formatDate } from '@/lib/utils';

function RiskBadge({ risk }: { risk: boolean }) {
  return risk ? (
    <span className="badge badge-risk"><XCircle className="h-3.5 w-3.5" /> At risk</span>
  ) : (
    <span className="badge badge-cleared"><CheckCircle className="h-3.5 w-3.5" /> Cleared</span>
  );
}

export default function ParqPage() {
  const [responses, setResponses] = useState<ParqResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParqResponses()
      .then(setResponses)
      .finally(() => setLoading(false));
  }, []);

  const hasRisk = (response: ParqResponse) =>
    Object.values(response.answers).some((value) => value === 'yes');

  return (
    <div className="page page-enter">
      <PageHeader
        title="PAR-Q forms"
        subtitle="Review physical activity readiness questionnaires and flagged health risks."
        action={
          <Link href="/parq/new" className="btn btn-primary">
            <Plus className="h-4 w-4" /> New PAR-Q
          </Link>
        }
      />

      {loading ? (
        <LoadingSpinner />
      ) : responses.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No PAR-Q forms yet"
          description="Complete a readiness screening before a member begins a new activity program."
          action={
            <Link href="/parq/new" className="btn btn-primary">
              <Plus className="h-4 w-4" /> New PAR-Q
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
                  <th className="hidden sm:table-cell">Date</th>
                  <th>Risk level</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {responses.map((response) => (
                  <tr key={response.id}>
                    <td>
                      <p className="table-primary">
                        {(response.member as { full_name: string } | undefined)?.full_name ?? 'Unknown member'}
                      </p>
                      <p className="table-secondary sm:hidden">{formatDate(response.created_at)}</p>
                    </td>
                    <td className="hidden sm:table-cell">{formatDate(response.created_at)}</td>
                    <td><RiskBadge risk={hasRisk(response)} /></td>
                    <td className="text-right">
                      <Link href={`/parq/${response.id}`} className="btn btn-ghost btn-sm">
                        View <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="data-cards">
            {responses.map((response) => (
              <article key={response.id} className="mobile-record">
                <div className="mobile-record-header">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {(response.member as { full_name: string } | undefined)?.full_name ?? 'Unknown member'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{formatDate(response.created_at)}</p>
                  </div>
                  <RiskBadge risk={hasRisk(response)} />
                </div>
                <div className="mobile-record-actions">
                  <Link href={`/parq/${response.id}`} className="btn btn-secondary btn-sm">View PAR-Q</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
