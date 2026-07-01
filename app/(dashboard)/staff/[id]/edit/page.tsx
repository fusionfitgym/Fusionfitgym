'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { StaffForm } from '@/components/staff/StaffForm';
import { getStaffById, updateStaff, uploadStaffPhoto } from '@/lib/actions/staff';
import { Staff, StaffFormValues } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

export default function EditStaffPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isDemo) {
      const s = demo.getStaffById(id);
      setStaff(s);
      setLoading(false);
      return;
    }
    getStaffById(id).then((s) => {
      setStaff(s);
      setLoading(false);
    });
  }, [id, isDemo]);

  async function handleUpdate(data: StaffFormValues, photoFile: File | null) {
    setSubmitting(true);
    setError(null);
    if (isDemo) {
      setTimeout(() => {
        const res = demo.updateStaff(id, {
          ...data,
          profile_photo: photoFile ? URL.createObjectURL(photoFile) : data.profile_photo,
        });
        if (res.data) {
          toast.success('Staff member updated (Demo Mode)');
          router.push(`/staff/${id}`);
        } else {
          toast.error(res.error || 'Failed to update (Demo Mode)');
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
      const res = await updateStaff(id, { ...data, profile_photo: profilePhoto });
      if (res.error || !res.data) throw new Error(res.error || 'Failed to update staff');
      toast.success('Staff member updated successfully!');
      router.push(`/staff/${id}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Failed to update staff member.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-wide page-enter animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded mb-4" />
        <div className="card p-6 space-y-4">
          <div className="h-6 w-64 bg-slate-100 rounded" />
          <div className="h-4 w-40 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="page-wide page-enter">
        <p className="text-slate-600">Staff member not found.</p>
      </div>
    );
  }

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Staff', href: '/staff' },
          { label: staff.full_name, href: `/staff/${id}` },
          { label: 'Edit' },
        ]}
      />
      <PageHeader
        title={`Edit ${staff.role}`}
        subtitle={`Update details for ${staff.full_name} (${staff.employee_id})`}
      />
      <StaffForm
        initialValues={{
          full_name: staff.full_name,
          role: staff.role,
          gender: staff.gender || '',
          dob: staff.dob || '',
          phone: staff.phone,
          email: staff.email || '',
          address: staff.address || '',
          emergency_contact: staff.emergency_contact || '',
          profile_photo: staff.profile_photo || '',
          employee_id: staff.employee_id,
          salary: staff.salary ?? '',
          joining_date: staff.joining_date,
          shift: (staff.shift as StaffFormValues['shift']) || '',
          status: staff.status,
          specialization: staff.specialization || '',
          experience: staff.experience ?? '',
          certifications: staff.certifications || '',
          cleaning_area: staff.cleaning_area || '',
          working_shift: staff.working_shift || '',
          notes: staff.notes || '',
        }}
        initialRole={staff.role}
        submitting={submitting}
        error={error}
        submitLabel="Update staff"
        cancelHref={`/staff/${id}`}
        onSubmit={handleUpdate}
      />
    </div>
  );
}
