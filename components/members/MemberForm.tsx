'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Fingerprint,
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
  MEMBER_STATUSES,
} from '@/types';
import { cn } from '@/lib/utils';
import { getSettings } from '@/lib/actions/settings';
import { getMembers } from '@/lib/actions/members';
import { GymSettings } from '@/types';

const defaultValues: MemberFormValues = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact: '',
  dob: '',
  package_name: 'Standard Monthly Package',
  package_duration: '1 Month',
  package_price: 1500,
  package_start_date: new Date().toISOString().split('T')[0],
  package_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'Active',
  profile_photo: '',
  biometric_user_id: '',
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
  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null);

  useEffect(() => {
    getSettings().then(setGymSettings).catch(console.error);
  }, []);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(initialValues?.profile_photo || '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const legacyInitial = initialValues as any;
  const parsedInitialValues = {
    ...initialValues,
    package_name: initialValues?.package_name || (legacyInitial?.membership_plan ? `${legacyInitial.membership_plan} Plan` : 'Standard Monthly Package'),
    package_duration: initialValues?.package_duration || (legacyInitial?.membership_plan ? (
      legacyInitial.membership_plan === 'Monthly' ? '1 Month' :
      legacyInitial.membership_plan === 'Quarterly' ? '3 Months' :
      legacyInitial.membership_plan === 'Biannual' ? '6 Months' : '1 Year'
    ) : '1 Month'),
    package_price: initialValues?.package_price ?? (legacyInitial?.membership_plan ? (
      legacyInitial.membership_plan === 'Monthly' ? 1500 :
      legacyInitial.membership_plan === 'Quarterly' ? 4000 :
      legacyInitial.membership_plan === 'Biannual' ? 7500 : 14000
    ) : 1500),
    package_start_date: initialValues?.package_start_date || legacyInitial?.join_date || new Date().toISOString().split('T')[0],
    package_end_date: initialValues?.package_end_date || (legacyInitial?.join_date ? new Date(new Date(legacyInitial.join_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    biometric_user_id: initialValues?.biometric_user_id || legacyInitial?.device_user_id || '',
  };

  const initialDuration = parsedInitialValues.package_duration;
  const isStandardDuration = ['1 Month', '3 Months', '6 Months', '1 Year'].includes(initialDuration);
  const [durationSelect, setDurationSelect] = useState<string>(
    initialDuration ? (isStandardDuration ? initialDuration : 'Custom') : '1 Month'
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    setError,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema) as any,
    defaultValues: { ...defaultValues, ...parsedInitialValues },
  });

  const [existingBiometricIds, setExistingBiometricIds] = useState<string[]>([]);

  useEffect(() => {
    getMembers().then((membersList) => {
      const currentMemberId = (initialValues as any)?.id;
      const filtered = membersList
        .filter((m) => !currentMemberId || m.id !== currentMemberId)
        .map((m) => m.biometric_user_id)
        .filter((id): id is string => !!id);
      setExistingBiometricIds(filtered);

      // Auto-suggest next ID only on Add form (when no initial biometric_user_id)
      const currentBiometricId = initialValues?.biometric_user_id || (initialValues as any)?.device_user_id;
      if (!currentBiometricId && submitLabel === 'Save member') {
        const numericIds = membersList
          .map((m) => m.biometric_user_id)
          .filter((id): id is string => !!id && /^\d+$/.test(id))
          .map((id) => parseInt(id, 10));
        
        const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 101;
        setValue('biometric_user_id', String(nextId), { shouldValidate: true });
      }
    }).catch(console.error);
  }, [initialValues, submitLabel, setValue]);

  const handleAutoGenerate = async () => {
    try {
      const membersList = await getMembers();
      const numericIds = membersList
        .map((m) => m.biometric_user_id)
        .filter((id): id is string => !!id && /^\d+$/.test(id))
        .map((id) => parseInt(id, 10));

      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 101;
      setValue('biometric_user_id', String(nextId), { shouldValidate: true });
    } catch (err) {
      console.error('Failed to auto-generate biometric user ID:', err);
    }
  };

  const handleFormSubmit = handleSubmit((data) => {
    if (data.biometric_user_id && existingBiometricIds.includes(data.biometric_user_id)) {
      setError('biometric_user_id', {
        type: 'manual',
        message: 'This Biometric User ID is already assigned to another member',
      });
      return;
    }
    onSubmit(data, photoFile);
  });

  const duration = watch('package_duration');
  const startDate = watch('package_start_date');

  // Auto-calculate end date
  useEffect(() => {
    if (!startDate || !duration) return;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return;
    
    const durStr = duration.toLowerCase().trim();
    if (durStr.includes('year') || durStr.includes('yr')) {
      const match = durStr.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 1;
      start.setFullYear(start.getFullYear() + num);
    } else if (durStr.includes('month') || durStr.includes('mo')) {
      const match = durStr.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 1;
      start.setMonth(start.getMonth() + num);
    } else if (durStr.includes('week') || durStr.includes('wk')) {
      const match = durStr.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 1;
      start.setDate(start.getDate() + num * 7);
    } else if (durStr.includes('day') || durStr.includes('dy')) {
      const match = durStr.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 30;
      start.setDate(start.getDate() + num);
    } else {
      const num = parseInt(durStr, 10);
      if (!isNaN(num)) {
        start.setMonth(start.getMonth() + num);
      } else {
        start.setMonth(start.getMonth() + 1);
      }
    }
    
    setValue('package_end_date', start.toISOString().split('T')[0]);
  }, [startDate, duration, setValue]);

  // Auto-set standard price and standard package name
  useEffect(() => {
    if (!gymSettings) return;
    const durStr = (duration || '').toLowerCase().trim();
    let price = 0;
    let name = '';
    
    if (durStr === '1 month') {
      price = Number(gymSettings.plan_monthly);
      name = 'Standard Monthly Package';
    } else if (durStr === '3 months') {
      price = Number(gymSettings.plan_quarterly);
      name = 'Pro Quarterly Package';
    } else if (durStr === '6 months') {
      price = Number(gymSettings.plan_biannual);
      name = 'Elite Biannual Package';
    } else if (durStr === '1 year' || durStr === '12 months') {
      price = Number(gymSettings.plan_annual);
      name = 'VIP Gold Annual Package';
    } else {
      return; // Custom duration
    }
    
    setValue('package_price', price);
    setValue('package_name', name);
  }, [duration, gymSettings, setValue]);

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
      onSubmit={handleFormSubmit}
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

              <FormField
                label="Date of birth"
                htmlFor="dob"
                required
                error={errors.dob?.message}
              >
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

          <SectionCard
            title="Pricing & Package Details"
            description="Enter package subscription name, duration, price, and validity dates."
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <div className="field-grid field-grid-2">
              <FormField
                label="Package Name"
                htmlFor="package_name"
                required
                error={errors.package_name?.message}
              >
                <input
                  id="package_name"
                  type="text"
                  className="input-field"
                  placeholder="e.g. Standard Monthly Package"
                  aria-invalid={Boolean(errors.package_name)}
                  {...register('package_name')}
                />
              </FormField>

              <FormField
                label="Duration"
                htmlFor="package_duration_select"
                required
              >
                <select
                  id="package_duration_select"
                  className="select-field"
                  value={durationSelect}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDurationSelect(val);
                    if (val !== 'Custom') {
                      setValue('package_duration', val, { shouldDirty: true, shouldValidate: true });
                    }
                  }}
                >
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="1 Year">1 Year</option>
                  <option value="Custom">Custom Duration...</option>
                </select>
              </FormField>

              {durationSelect === 'Custom' && (
                <FormField
                  label="Custom Duration"
                  htmlFor="package_duration"
                  required
                  error={errors.package_duration?.message}
                >
                  <input
                    id="package_duration"
                    type="text"
                    className="input-field"
                    placeholder="e.g. 45 Days, 2 Months"
                    aria-invalid={Boolean(errors.package_duration)}
                    {...register('package_duration')}
                  />
                </FormField>
              )}

              <FormField
                label="Package Price (INR)"
                htmlFor="package_price"
                required
                error={errors.package_price?.message}
              >
                <input
                  id="package_price"
                  type="number"
                  min="0"
                  className="input-field"
                  placeholder="1500"
                  aria-invalid={Boolean(errors.package_price)}
                  {...register('package_price')}
                />
              </FormField>

              <FormField
                label="Start Date"
                htmlFor="package_start_date"
                required
                error={errors.package_start_date?.message}
              >
                <div className="input-with-icon">
                  <Calendar />
                  <input
                    id="package_start_date"
                    type="date"
                    className="input-field"
                    aria-invalid={Boolean(errors.package_start_date)}
                    {...register('package_start_date')}
                  />
                </div>
              </FormField>

              <FormField
                label="End Date"
                htmlFor="package_end_date"
                required
                error={errors.package_end_date?.message}
              >
                <div className="input-with-icon">
                  <Calendar />
                  <input
                    id="package_end_date"
                    type="date"
                    className="input-field"
                    aria-invalid={Boolean(errors.package_end_date)}
                    {...register('package_end_date')}
                  />
                </div>
              </FormField>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Status & Biometrics"
          description="Status and biometric hardware mapping."
          icon={<ShieldCheck className="h-5 w-5" />}
          className="self-start"
        >
          <div className="field-grid">
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

            <FormField
              label="Biometric User ID"
              htmlFor="biometric_user_id"
              error={errors.biometric_user_id?.message}
            >
              <div className="flex gap-2">
                <div className="input-with-icon flex-1">
                  <Fingerprint className="text-slate-400" />
                  <input
                    id="biometric_user_id"
                    type="text"
                    className="input-field font-mono"
                    placeholder="e.g. 101"
                    aria-invalid={Boolean(errors.biometric_user_id)}
                    {...register('biometric_user_id')}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoGenerate}
                  className="btn btn-secondary text-xs shrink-0 cursor-pointer"
                  title="Generate next available Biometric User ID"
                >
                  Auto Generate
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">
                This is the User ID stored in the biometric machine for this member. Example: 101, 102, 103.
              </p>
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
