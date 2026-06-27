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
      if (photoFile) {
        const uploadRes = await uploadProfilePhoto(photoFile);
        if (uploadRes.error) throw new Error(uploadRes.error);
        profilePhoto = uploadRes.url ?? '';
      }
      const res = await updateMember(id, { ...data, profile_photo: profilePhoto ?? '' });
      if (res.error) throw new Error(res.error);
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
          id: member.id,
          full_name: member.full_name,
          phone: member.phone,
          email: member.email ?? '',
          address: member.address ?? '',
          emergency_contact: member.emergency_contact ?? '',
          dob: member.dob ?? '',
          package_name: member.package_name,
          package_duration: member.package_duration,
          package_price: member.package_price,
          package_start_date: member.package_start_date,
          package_end_date: member.package_end_date,
          membership_plan: member.membership_plan,
          join_date: member.join_date,
          status: member.status,
          profile_photo: member.profile_photo ?? '',
          biometric_user_id: member.biometric_user_id ?? '',
          gender: member.gender,
          duration: member.duration,
          training_type: member.training_type,
          membership_fee: member.membership_fee,
          parq_purchased: member.parq_purchased,
          parq_fee: member.parq_fee,
          admission_fee: member.admission_fee,
        } as any}
        submitting={submitting}
        error={error}
        submitLabel="Save changes"
        cancelHref={`/members/${id}`}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
