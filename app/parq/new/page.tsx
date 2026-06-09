'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { parqSchema, ParqFormValues, PARQ_QUESTIONS } from '@/types';
import { createParqResponse } from '@/lib/actions/parq';
import { getMembers } from '@/lib/actions/members';
import { Member } from '@/types';

function NewParqForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMember = searchParams.get('member');
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<ParqFormValues>({
    resolver: zodResolver(parqSchema),
    defaultValues: {
      member_id: preselectedMember ?? '',
      q1: 'no', q2: 'no', q3: 'no', q4: 'no', q5: 'no', q6: 'no', q7: 'no',
    },
  });

  useEffect(() => {
    getMembers().then(setMembers);
  }, []);

  async function onSubmit(data: ParqFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      const response = await createParqResponse(data);
      router.push(`/parq/${response.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save PAR-Q');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter max-w-3xl mx-auto">
      <PageHeader
        title="New PAR-Q Form"
        subtitle="Physical Activity Readiness Questionnaire"
        action={
          <Link href="/parq" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Member Select */}
        <Card>
          <label className="block text-xs font-semibold text-gray-600 mb-1">
            Member <span className="text-red-500">*</span>
          </label>
          <select
            {...register('member_id')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="">Select a member...</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.full_name} — {m.phone}</option>
            ))}
          </select>
          {errors.member_id && <p className="text-xs text-red-500 mt-1">{errors.member_id.message}</p>}
        </Card>

        {/* PAR-Q Questions */}
        <Card>
          <div className="mb-4">
            <h3 className="font-bold text-gray-900">Health Screening Questions</h3>
            <p className="text-xs text-gray-500 mt-1">
              Please answer YES or NO honestly to each question below. This form should be completed before starting any new physical activity program.
            </p>
          </div>

          <div className="space-y-4">
            {PARQ_QUESTIONS.map((q, i) => (
              <div key={q.id} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-800 font-medium mb-3">
                  <span className="inline-flex w-6 h-6 rounded-full items-center justify-center text-xs font-bold mr-2 text-black" style={{ background: 'var(--gym-yellow)' }}>
                    {i + 1}
                  </span>
                  {q.text}
                </p>
                <div className="flex gap-4">
                  {['yes', 'no'].map(ans => (
                    <label key={ans} className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        value={ans}
                        {...register(q.id as keyof ParqFormValues)}
                        className="w-4 h-4 accent-yellow-400"
                      />
                      <span className="text-sm font-medium capitalize text-gray-700 group-hover:text-gray-900">
                        {ans === 'yes' ? '✅ Yes' : '❌ No'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Notes */}
        <Card>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Additional Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Any additional notes about the member's health..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
          />
        </Card>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-yellow">
            {submitting ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save PAR-Q'}
          </button>
          <Link href="/parq" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function NewParqPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading...</div>}>
      <NewParqForm />
    </Suspense>
  );
}
