'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { MemberForm } from '@/components/members/MemberForm';
import { createMember, uploadProfilePhoto } from '@/lib/actions/members';
import { MemberFormValues } from '@/types';

export default function AddMemberPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(data: MemberFormValues, photoFile: File | null) {
    setSubmitting(true);
    setError(null);
    try {
      let profilePhoto = data.profile_photo;
      if (photoFile) profilePhoto = await uploadProfilePhoto(photoFile);
      const member = await createMember({ ...data, profile_photo: profilePhoto });
      router.push(`/members/${member.id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to create member.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Members', href: '/members' },
          { label: 'Add member' },
        ]}
      />
      <PageHeader
        title="Add member"
        subtitle="Create a complete profile, assign a plan, and set the member's current status."
      />
      <MemberForm
        submitting={submitting}
        error={error}
        submitLabel="Save member"
        cancelHref="/members"
        onSubmit={handleCreate}
      />
    </div>
  );
}
