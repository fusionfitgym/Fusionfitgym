'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { MemberForm } from '@/components/members/MemberForm';
import { StaffForm } from '@/components/staff/StaffForm';
import { createMember, uploadProfilePhoto } from '@/lib/actions/members';
import { createStaff, uploadStaffPhoto } from '@/lib/actions/staff';
import { MemberFormValues, StaffFormValues } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type PersonType = 'Member' | 'Trainer' | 'Janitor';

export default function AddMemberPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personType, setPersonType] = useState<PersonType>('Member');

  async function handleCreateMember(data: MemberFormValues, photoFile: File | null) {
    setSubmitting(true);
    setError(null);
    if (isDemo) {
      setTimeout(() => {
        const res = demo.createMember({
          ...data,
          profile_photo: photoFile ? URL.createObjectURL(photoFile) : data.profile_photo,
        });
        if (res.data) {
          toast.success('Member created successfully (Demo Mode)');
          router.push(`/members/${res.data.id}`);
        } else {
          toast.error(res.error || 'Failed to create member (Demo Mode)');
          setSubmitting(false);
        }
      }, 400);
      return;
    }
    try {
      let profilePhoto = data.profile_photo;
      if (photoFile) {
        const uploadRes = await uploadProfilePhoto(photoFile);
        if (uploadRes.error) throw new Error(uploadRes.error);
        profilePhoto = uploadRes.url;
      }
      const res = await createMember({ ...data, profile_photo: profilePhoto });
      if (res.error || !res.data) throw new Error(res.error || 'Failed to create member');
      router.push(`/members/${res.data.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create member.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCreateStaff(data: StaffFormValues, photoFile: File | null) {
    setSubmitting(true);
    setError(null);
    if (isDemo) {
      setTimeout(() => {
        const res = demo.createStaff({
          ...data,
          role: personType as 'Trainer' | 'Janitor',
          profile_photo: photoFile ? URL.createObjectURL(photoFile) : data.profile_photo,
        });
        if (res.data) {
          toast.success(`${personType} created successfully (Demo Mode)`);
          router.push(`/staff/${res.data.id}`);
        } else {
          toast.error(res.error || `Failed to create ${personType} (Demo Mode)`);
          setSubmitting(false);
        }
      }, 400);
      return;
    }
    try {
      let profilePhoto = data.profile_photo;
      if (photoFile) {
        const uploadRes = await uploadStaffPhoto(photoFile);
        if (uploadRes.error) throw new Error(uploadRes.error);
        profilePhoto = uploadRes.url;
      }
      const res = await createStaff({ ...data, role: personType as 'Trainer' | 'Janitor', profile_photo: profilePhoto });
      if (res.error || !res.data) throw new Error(res.error || `Failed to create ${personType}`);
      toast.success(`${personType} created successfully!`);
      router.push(`/staff/${res.data.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : `Failed to create ${personType}.`);
    } finally {
      setSubmitting(false);
    }
  }

  const breadcrumbLabel = personType === 'Member' ? 'Add member' : `Add ${personType}`;
  const breadcrumbBack = personType === 'Member' ? '/members' : '/staff';

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: personType === 'Member' ? 'Members' : 'Staff', href: breadcrumbBack },
          { label: breadcrumbLabel },
        ]}
      />
      <PageHeader
        title={breadcrumbLabel}
        subtitle={
          personType === 'Member'
            ? 'Create a complete profile, assign a plan, and set the member\'s current status.'
            : `Add a new ${personType.toLowerCase()} to your gym staff.`
        }
      />

      {/* Person Type Selector */}
      <div className="card p-4 mb-6">
        <label className="block text-sm font-semibold text-slate-700 mb-3">Person Type</label>
        <div className="flex flex-wrap gap-2">
          {(['Member', 'Trainer', 'Janitor'] as PersonType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                setPersonType(type);
                setError(null);
              }}
              className={cn(
                'rounded-xl border px-5 py-2 text-sm font-semibold transition-all duration-150',
                personType === type
                  ? 'border-amber-400 bg-amber-400 text-zinc-900 shadow-md shadow-amber-200/50'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:text-slate-900'
              )}
            >
              {type === 'Member' && '👤 '}
              {type === 'Trainer' && '💪 '}
              {type === 'Janitor' && '🧹 '}
              {type}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {personType === 'Member' && 'Members have memberships, billing, attendance tracking, health assessments, and SMS notifications.'}
          {personType === 'Trainer' && 'Trainers are gym employees. No membership or billing is assigned to them.'}
          {personType === 'Janitor' && 'Janitors are maintenance staff. No membership or billing is assigned to them.'}
        </p>
      </div>

      {personType === 'Member' ? (
        <MemberForm
          submitting={submitting}
          error={error}
          submitLabel="Save member"
          cancelHref="/members"
          onSubmit={handleCreateMember}
        />
      ) : (
        <StaffForm
          initialRole={personType}
          submitting={submitting}
          error={error}
          submitLabel={`Save ${personType}`}
          cancelHref="/staff"
          onSubmit={handleCreateStaff}
        />
      )}
    </div>
  );
}
