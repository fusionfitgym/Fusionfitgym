'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Breadcrumb, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { MemberForm } from '@/components/members/MemberForm';
import { getMemberById, updateMember, uploadProfilePhoto } from '@/lib/actions/members';
import { Member, MemberFormValues } from '@/types';

export default function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMemberById(id)
      .then(setMember)
      .finally(() => setLoading(false));
  }, [id]);

  async function handleUpdate(data: MemberFormValues, photoFile: File | null) {
    setSubmitting(true);
    setError(null);
    try {
      let profilePhoto = member?.profile_photo ?? data.profile_photo;
      if (photoFile) profilePhoto = await uploadProfilePhoto(photoFile);
      await updateMember(id, { ...data, profile_photo: profilePhoto ?? '' });
      router.push(`/members/${id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update member.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <LoadingSpinner />;
  if (!member) return <div className="empty-state"><p className="card-title">Member not found</p></div>;

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Members', href: '/members' },
          { label: member.full_name, href: `/members/${id}` },
          { label: 'Edit' },
        ]}
      />
      <PageHeader
        title="Edit member"
        subtitle={`Update ${member.full_name}'s profile and membership details.`}
      />
      <MemberForm
        initialValues={{
          full_name: member.full_name,
          phone: member.phone,
          email: member.email ?? '',
          address: member.address ?? '',
          emergency_contact: member.emergency_contact ?? '',
          dob: member.dob ?? '',
          membership_plan: member.membership_plan,
          join_date: member.join_date,
          status: member.status,
          profile_photo: member.profile_photo ?? '',
        }}
        submitting={submitting}
        error={error}
        submitLabel="Save changes"
        cancelHref={`/members/${id}`}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
