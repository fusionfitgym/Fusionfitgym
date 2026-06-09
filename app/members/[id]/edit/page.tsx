'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card, LoadingSpinner } from '@/components/ui/Primitives';
import { memberSchema, MemberFormValues, MEMBERSHIP_PLANS, MEMBER_STATUSES } from '@/types';
import { getMemberById, updateMember } from '@/lib/actions/members';

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
  });

  useEffect(() => {
    getMemberById(id).then(m => {
      if (m) reset({
        full_name: m.full_name,
        phone: m.phone,
        email: m.email ?? '',
        address: m.address ?? '',
        emergency_contact: m.emergency_contact ?? '',
        dob: m.dob ?? '',
        membership_plan: m.membership_plan,
        join_date: m.join_date,
        status: m.status,
        profile_photo: m.profile_photo ?? '',
      });
    }).finally(() => setLoading(false));
  }, [id, reset]);

  async function onSubmit(data: MemberFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      await updateMember(id, data);
      router.push(`/members/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update member');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner size={36} />;

  const FIELDS: { name: keyof MemberFormValues; label: string; type: string; required?: boolean; colSpan?: number; options?: readonly string[] }[] = [
    { name: 'full_name',         label: 'Full Name',         type: 'text',   required: true  },
    { name: 'phone',             label: 'Phone Number',      type: 'tel',    required: true  },
    { name: 'email',             label: 'Email Address',     type: 'email'                   },
    { name: 'dob',               label: 'Date of Birth',     type: 'date'                    },
    { name: 'address',           label: 'Address',           type: 'text',   colSpan: 2      },
    { name: 'emergency_contact', label: 'Emergency Contact', type: 'text',   colSpan: 2      },
    { name: 'membership_plan',   label: 'Membership Plan',   type: 'select', required: true,  options: MEMBERSHIP_PLANS },
    { name: 'join_date',         label: 'Join Date',         type: 'date',   required: true  },
    { name: 'status',            label: 'Status',            type: 'select', required: true,  options: MEMBER_STATUSES  },
  ];

  return (
    <div className="page-enter max-w-3xl mx-auto">
      <PageHeader
        title="Edit Member"
        subtitle="Update member information"
        action={
          <Link href={`/members/${id}`} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(field => (
              <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select {...register(field.name)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input {...register(field.name)} type={field.type} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                )}
                {errors[field.name] && <p className="text-xs text-red-500 mt-1">{errors[field.name]?.message}</p>}
              </div>
            ))}
          </div>
        </Card>

        {error && <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-yellow">
            {submitting ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
          <Link href={`/members/${id}`} className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
