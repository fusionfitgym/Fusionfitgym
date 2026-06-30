'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { MemberForm } from '@/components/members/MemberForm';
import { createMember, uploadProfilePhoto } from '@/lib/actions/members';
import { MemberFormValues } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

export default function AddMemberPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(data: MemberFormValues, photoFile: File | null) {
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
