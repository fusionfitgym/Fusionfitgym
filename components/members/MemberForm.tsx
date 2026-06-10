'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  Upload,
  User,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar } from '@/components/ui/Avatar';
import {
  FormActions,
  FormError,
  FormField,
  SectionCard,
} from '@/components/ui/Primitives';
import {
  memberSchema,
  MemberFormValues,
  MEMBERSHIP_PLANS,
  MEMBER_STATUSES,
} from '@/types';
import { cn } from '@/lib/utils';

const defaultValues: MemberFormValues = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact: '',
  dob: '',
  membership_plan: 'Monthly',
  join_date: new Date().toISOString().split('T')[0],
  status: 'Active',
  profile_photo: '',
};

interface MemberFormProps {
  initialValues?: Partial<MemberFormValues>;
  submitting: boolean;
  error?: string | null;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (data: MemberFormValues, photoFile: File | null) => Promise<void>;
}

export function MemberForm({
  initialValues,
  submitting,
  error,
  submitLabel,
  cancelHref,
  onSubmit,
}: MemberFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(initialValues?.profile_photo || '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: { ...defaultValues, ...initialValues },
  });

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  function selectPhoto(file?: File) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Choose a PNG, JPG, GIF, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Profile photos must be smaller than 5 MB.');
      return;
    }

    setPhotoError(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  return (
    <form
      onSubmit={handleSubmit((data) => onSubmit(data, photoFile))}
      className="page-stack"
      noValidate
    >
      <SectionCard
        title="Profile photo"
        description="Add a clear photo to make the member easier to identify."
        icon={<User className="h-5 w-5" />}
      >
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <Avatar src={photoPreview} name={initialValues?.full_name || 'Member'} size="xl" />
          <label
            htmlFor="profile-photo"
            className={cn(
              'flex min-h-28 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
              isDragging
                ? 'border-amber-400 bg-amber-50'
                : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100',
            )}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              selectPhoto(event.dataTransfer.files?.[0]);
            }}
          >
            <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
              <Upload className="h-5 w-5" />
            </span>
            <span className="text-sm font-semibold text-slate-800">Choose a photo or drag it here</span>
            <span className="mt-1 text-xs text-slate-500">PNG, JPG, GIF, or WebP up to 5 MB</span>
            <input
              id="profile-photo"
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="sr-only"
              onChange={(event) => selectPhoto(event.target.files?.[0])}
            />
          </label>
        </div>
        {photoError && <p className="field-error mt-3">{photoError}</p>}
      </SectionCard>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <div className="page-stack">
          <SectionCard
            title="Personal information"
            description="Core contact and identity details."
            icon={<User className="h-5 w-5" />}
          >
            <div className="field-grid field-grid-2">
              <FormField
                label="Full name"
                htmlFor="full_name"
                required
                error={errors.full_name?.message}
              >
                <div className="input-with-icon">
                  <User />
                  <input
                    id="full_name"
                    type="text"
                    className="input-field"
                    placeholder="John Doe"
                    aria-invalid={Boolean(errors.full_name)}
                    {...register('full_name')}
                  />
                </div>
              </FormField>

              <FormField
                label="Phone number"
                htmlFor="phone"
                required
                error={errors.phone?.message}
              >
                <div className="input-with-icon">
                  <Phone />
                  <input
                    id="phone"
                    type="tel"
                    className="input-field"
                    placeholder="+91 98765 43210"
                    aria-invalid={Boolean(errors.phone)}
                    {...register('phone')}
                  />
                </div>
              </FormField>

              <FormField label="Email address" htmlFor="email" error={errors.email?.message}>
                <div className="input-with-icon">
                  <Mail />
                  <input
                    id="email"
                    type="email"
                    className="input-field"
                    placeholder="john@example.com"
                    aria-invalid={Boolean(errors.email)}
                    {...register('email')}
                  />
                </div>
              </FormField>

              <FormField label="Date of birth" htmlFor="dob" error={errors.dob?.message}>
                <div className="input-with-icon">
                  <Calendar />
                  <input
                    id="dob"
                    type="date"
                    className="input-field"
                    aria-invalid={Boolean(errors.dob)}
                    {...register('dob')}
                  />
                </div>
              </FormField>
            </div>
          </SectionCard>

          <SectionCard
            title="Contact and emergency details"
            description="Location and an alternate contact for urgent situations."
            icon={<MapPin className="h-5 w-5" />}
          >
            <div className="field-grid">
              <FormField label="Address" htmlFor="address" error={errors.address?.message}>
                <div className="input-with-icon">
                  <MapPin />
                  <input
                    id="address"
                    type="text"
                    className="input-field"
                    placeholder="Street, city, state"
                    aria-invalid={Boolean(errors.address)}
                    {...register('address')}
                  />
                </div>
              </FormField>

              <FormField
                label="Emergency contact"
                htmlFor="emergency_contact"
                error={errors.emergency_contact?.message}
              >
                <div className="input-with-icon">
                  <Phone />
                  <input
                    id="emergency_contact"
                    type="text"
                    className="input-field"
                    placeholder="Name and phone number"
                    aria-invalid={Boolean(errors.emergency_contact)}
                    {...register('emergency_contact')}
                  />
                </div>
              </FormField>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Membership"
          description="Plan, start date, and current account status."
          icon={<ShieldCheck className="h-5 w-5" />}
          className="self-start"
        >
          <div className="field-grid">
            <FormField
              label="Membership plan"
              htmlFor="membership_plan"
              required
              error={errors.membership_plan?.message}
            >
              <select
                id="membership_plan"
                className="select-field"
                aria-invalid={Boolean(errors.membership_plan)}
                {...register('membership_plan')}
              >
                {MEMBERSHIP_PLANS.map((plan) => <option key={plan}>{plan}</option>)}
              </select>
            </FormField>

            <FormField
              label="Join date"
              htmlFor="join_date"
              required
              error={errors.join_date?.message}
            >
              <div className="input-with-icon">
                <Calendar />
                <input
                  id="join_date"
                  type="date"
                  className="input-field"
                  aria-invalid={Boolean(errors.join_date)}
                  {...register('join_date')}
                />
              </div>
            </FormField>

            <FormField
              label="Status"
              htmlFor="status"
              required
              error={errors.status?.message}
            >
              <select
                id="status"
                className="select-field"
                aria-invalid={Boolean(errors.status)}
                {...register('status')}
              >
                {MEMBER_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </FormField>
          </div>
        </SectionCard>
      </div>

      {error && <FormError>{error}</FormError>}

      <FormActions sticky>
        <Link href={cancelHref} className="btn btn-secondary w-full sm:w-auto">Cancel</Link>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full sm:w-auto">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? 'Saving...' : submitLabel}
        </button>
      </FormActions>
    </form>
  );
}
