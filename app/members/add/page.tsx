'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, Upload, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { memberSchema, MemberFormValues, MEMBERSHIP_PLANS, MEMBER_STATUSES } from '@/types';
import { createMember, uploadProfilePhoto } from '@/lib/actions/members';

const FIELDS: { name: keyof MemberFormValues; label: string; type: string; required?: boolean; colSpan?: number; options?: readonly string[] }[] = [
  { name: 'full_name',         label: 'Full Name',            type: 'text',   required: true  },
  { name: 'phone',             label: 'Phone Number',         type: 'tel',    required: true  },
  { name: 'email',             label: 'Email Address',        type: 'email'                   },
  { name: 'dob',               label: 'Date of Birth',        type: 'date'                    },
  { name: 'address',           label: 'Address',              type: 'text',   colSpan: 2      },
  { name: 'emergency_contact', label: 'Emergency Contact',    type: 'text',   colSpan: 2      },
  { name: 'membership_plan',   label: 'Membership Plan',      type: 'select', required: true,  options: MEMBERSHIP_PLANS },
  { name: 'join_date',         label: 'Join Date',            type: 'date',   required: true  },
  { name: 'status',            label: 'Status',               type: 'select', required: true,  options: MEMBER_STATUSES  },
];

export default function AddMemberPage() {
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      membership_plan: 'Monthly',
      status: 'Active',
      join_date: new Date().toISOString().split('T')[0],
    },
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(data: MemberFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      let profile_photo: string | undefined;
      if (photoFile) {
        try { profile_photo = await uploadProfilePhoto(photoFile); } catch { /* skip photo on error */ }
      }
      const member = await createMember({ ...data, profile_photo });
      router.push(`/members/${member.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-enter max-w-3xl mx-auto">
      <PageHeader
        title="Add New Member"
        subtitle="Register a new gym member"
        action={
          <Link href="/members" className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
        }
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Photo Upload */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Profile Photo</h3>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-yellow-50 border-2 border-dashed border-yellow-200 flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <Upload className="w-6 h-6 text-yellow-400" />
              )}
            </div>
            <div>
              <label
                htmlFor="photo-upload"
                className="btn-yellow text-sm cursor-pointer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Upload className="w-4 h-4" /> Choose Photo
              </label>
              <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              <p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p>
            </div>
          </div>
        </Card>

        {/* Form Fields */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Member Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELDS.map(field => (
              <div key={field.name} className={field.colSpan === 2 ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                </label>
                {field.type === 'select' ? (
                  <select
                    {...register(field.name)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white focus:ring-2"
                  >
                    {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                ) : (
                  <input
                    {...register(field.name)}
                    type={field.type}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2"
                  />
                )}
                {errors[field.name] && (
                  <p className="text-xs text-red-500 mt-1">{errors[field.name]?.message}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600">{error}</div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="btn-yellow flex-1 sm:flex-none justify-center">
            {submitting ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {submitting ? 'Saving...' : 'Save Member'}
          </button>
          <Link href="/members" className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
