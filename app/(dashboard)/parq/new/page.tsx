'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ClipboardCheck, FileText, Loader2, Save, UserRound } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Breadcrumb,
  FormActions,
  FormError,
  FormField,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { createParqResponse } from '@/lib/actions/parq';
import { getMembers } from '@/lib/actions/members';
import { Member, PARQ_QUESTIONS, ParqFormValues, parqSchema } from '@/types';
import { cn } from '@/lib/utils';

function NewParqForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedMember = searchParams.get('member');
  const [members, setMembers] = useState<Member[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ParqFormValues>({
    resolver: zodResolver(parqSchema),
    defaultValues: {
      member_id: preselectedMember ?? '',
      q1: 'no',
      q2: 'no',
      q3: 'no',
      q4: 'no',
      q5: 'no',
      q6: 'no',
      q7: 'no',
      notes: '',
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
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to save PAR-Q form.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow page-enter">
      <Breadcrumb
        items={[
          { label: 'PAR-Q forms', href: '/parq' },
          { label: 'New PAR-Q' },
        ]}
      />
      <PageHeader
        title="New PAR-Q form"
        subtitle="Complete the readiness questionnaire before beginning a new activity program."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack" noValidate>
        <SectionCard
          title="Member"
          description="Select the member completing this screening."
          icon={<UserRound className="h-5 w-5" />}
        >
          <FormField
            label="Member"
            htmlFor="member_id"
            required
            error={errors.member_id?.message}
          >
            <select
              id="member_id"
              className="select-field"
              aria-invalid={Boolean(errors.member_id)}
              {...register('member_id')}
            >
              <option value="">Select a member</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>{member.full_name} - {member.phone}</option>
              ))}
            </select>
          </FormField>
        </SectionCard>

        <SectionCard
          title="Health screening"
          description="Answer every question honestly. A yes response may require medical clearance."
          icon={<ClipboardCheck className="h-5 w-5" />}
        >
          <div className="space-y-3">
            {PARQ_QUESTIONS.map((question, index) => (
              <fieldset key={question.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <legend className="sr-only">Question {index + 1}</legend>
                <div className="flex items-start gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-300 text-xs font-bold text-zinc-950">
                    {index + 1}
                  </span>
                  <p className="text-sm font-medium leading-6 text-slate-800">{question.text}</p>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:ml-10 sm:max-w-xs">
                  {['yes', 'no'].map((answer) => (
                    <label
                      key={answer}
                      className={cn(
                        'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors',
                        'has-[:checked]:border-amber-400 has-[:checked]:bg-amber-50 has-[:checked]:text-amber-900',
                      )}
                    >
                      <input
                        type="radio"
                        value={answer}
                        className="h-4 w-4 accent-amber-500"
                        {...register(question.id as keyof ParqFormValues)}
                      />
                      {answer === 'yes' ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Additional notes"
          description="Add context for any yes answers or other relevant health information."
          icon={<FileText className="h-5 w-5" />}
        >
          <FormField label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              rows={4}
              placeholder="Optional notes about the member's health"
              className="textarea-field"
              {...register('notes')}
            />
          </FormField>
        </SectionCard>

        {error && <FormError>{error}</FormError>}

        <FormActions sticky>
          <Link href="/parq" className="btn btn-secondary w-full sm:w-auto">Cancel</Link>
          <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {submitting ? 'Saving...' : 'Save PAR-Q'}
          </button>
        </FormActions>
      </form>
    </div>
  );
}

export default function NewParqPage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <NewParqForm />
    </Suspense>
  );
}
