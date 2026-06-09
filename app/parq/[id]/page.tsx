'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer, CheckCircle, XCircle, User } from 'lucide-react';
import { getParqById } from '@/lib/actions/parq';
import { ParqResponse, PARQ_QUESTIONS } from '@/types';
import { Card, LoadingSpinner } from '@/components/ui/Primitives';
import { formatDate } from '@/lib/utils';

export default function ParqDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [response, setResponse] = useState<ParqResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getParqById(id).then(setResponse).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner size={36} />;
  if (!response) return <div className="text-gray-500 text-center py-16">PAR-Q form not found.</div>;

  const member = response.member as { full_name: string; phone: string } | undefined;
  const hasRisk = Object.values(response.answers).some(v => v === 'yes');

  return (
    <div className="page-enter max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6 print:hidden">
        <Link href="/parq" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">PAR-Q Form</h1>
          <p className="text-sm text-gray-400">{formatDate(response.created_at)}</p>
        </div>
        <button onClick={() => window.print()} className="btn-yellow text-sm print:hidden">
          <Printer className="w-4 h-4" /> Print
        </button>
      </div>

      {/* Printable PAR-Q Report */}
      <div id="parq-report" className="space-y-6">
        {/* Header */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif', letterSpacing: '0.05em' }}>
                FusionFit Gym
              </div>
              <p className="text-xs text-gray-400">Physical Activity Readiness Questionnaire</p>
              <p className="text-xs text-gray-400">Date: {formatDate(response.created_at)}</p>
            </div>
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                hasRisk ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
              }`}
            >
              {hasRisk ? <><XCircle className="w-3.5 h-3.5" /> Medical Clearance Required</> : <><CheckCircle className="w-3.5 h-3.5" /> Cleared for Exercise</>}
            </div>
          </div>

          {member && (
            <div className="mt-4 pt-4 border-t border-gray-50 flex items-center gap-2">
              <User className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-semibold text-gray-900">{member.full_name}</p>
                <p className="text-xs text-gray-400">{member.phone}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Questions */}
        <Card>
          <h3 className="font-bold text-gray-900 mb-4">Health Screening Responses</h3>
          <div className="space-y-4">
            {PARQ_QUESTIONS.map((q, i) => {
              const answer = response.answers[q.id];
              const isYes = answer === 'yes';
              return (
                <div key={q.id} className={`p-3 rounded-xl border ${isYes ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-gray-400 mt-0.5 w-4 flex-shrink-0">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{q.text}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${isYes ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {isYes ? <><XCircle className="w-3 h-3" />YES</> : <><CheckCircle className="w-3 h-3" />NO</>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Notes */}
        {response.notes && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-2">Additional Notes</h3>
            <p className="text-sm text-gray-600">{response.notes}</p>
          </Card>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-gray-400 p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="font-semibold mb-1">Important Notice</p>
          <p>
            If you answered YES to any of the above questions, consult your doctor before starting physical activity.
            This PAR-Q is valid for 12 months from the date of completion.
          </p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #parq-report, #parq-report * { visibility: visible; }
          #parq-report { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
