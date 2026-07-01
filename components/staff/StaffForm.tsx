'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Calendar,
  DollarSign,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  Upload,
  User,
  Users,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Avatar } from '@/components/ui/Avatar';
import { FormActions, FormError, FormField, SectionCard } from '@/components/ui/Primitives';
import { staffSchema, StaffFormValues, STAFF_SHIFTS, STAFF_GENDERS, STAFF_STATUSES } from '@/types';
import { cn } from '@/lib/utils';

const defaultValues: StaffFormValues = {
  full_name: '',
  role: 'Trainer',
  gender: '',
  dob: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact: '',
  profile_photo: '',
  employee_id: '',
  salary: '',
  joining_date: new Date().toISOString().split('T')[0],
  shift: '',
  status: 'Active',
  specialization: '',
  experience: '',
  certifications: '',
  cleaning_area: '',
  working_shift: '',
  notes: '',
};

interface StaffFormProps {
  initialValues?: Partial<StaffFormValues>;
  initialRole?: 'Trainer' | 'Janitor';
  submitting: boolean;
  error?: string | null;
  submitLabel: string;
  cancelHref: string;
  onSubmit: (data: StaffFormValues, photoFile: File | null) => Promise<void>;
}

export function StaffForm({
  initialValues,
  initialRole = 'Trainer',
  submitting,
  error,
  submitLabel,
  cancelHref,
  onSubmit,
}: StaffFormProps) {
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(initialValues?.profile_photo || '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<StaffFormValues>({
    resolver: zodResolver(staffSchema) as any,
    defaultValues: {
      ...defaultValues,
      ...initialValues,
      role: initialValues?.role || initialRole,
    },
  });

  const role = watch('role');

  const handlePhotoChange = (file: File) => {
    setPhotoError(null);
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Photo must be less than 5 MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setPhotoError('File must be an image');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handlePhotoChange(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handlePhotoChange(file);
  };

  async function onFormSubmit(data: StaffFormValues) {
    await onSubmit(data, photoFile);
  }

  return (
    <form onSubmit={handleSubmit(onFormSubmit as any)} className="space-y-6">
      {error && <FormError>{error}</FormError>}

      {/* Personal Information */}
      <SectionCard
        title="Personal Information"
        icon={<User className="h-4 w-4" />}
        description={`Basic details for the ${role}`}
      >
        {/* Photo upload */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Profile Photo</label>
          <div className="flex items-center gap-5">
            <Avatar
              src={photoPreview}
              name={watch('full_name') || (role === 'Trainer' ? 'Trainer' : 'Janitor')}
              size="lg"
            />
            <div
              className={cn(
                'flex-1 rounded-xl border-2 border-dashed p-4 text-center transition-colors cursor-pointer',
                isDragging ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
              )}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-5 w-5 text-slate-400 mb-1" />
              <p className="text-xs text-slate-500">Drop photo here or <span className="text-amber-600 font-medium">click to browse</span></p>
              <p className="text-[11px] text-slate-400 mt-0.5">Max 5 MB · JPG, PNG, WebP</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
          {photoError && <p className="mt-1 text-xs text-red-600">{photoError}</p>}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Role" required error={errors.role?.message}>
            <select
              {...register('role')}
              className="select-field"
            >
              <option value="Trainer">Trainer</option>
              <option value="Janitor">Janitor</option>
            </select>
          </FormField>

          <FormField label="Full Name" required error={errors.full_name?.message}>
            <div className="input-with-icon">
              <User />
              <input
                {...register('full_name')}
                type="text"
                placeholder="Enter full name"
                className="input-field"
              />
            </div>
          </FormField>

          <FormField label="Gender" error={errors.gender?.message}>
            <select {...register('gender')} className="select-field">
              <option value="">Select gender</option>
              {STAFF_GENDERS.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Date of Birth" error={errors.dob?.message}>
            <div className="input-with-icon">
              <Calendar />
              <input {...register('dob')} type="date" className="input-field" />
            </div>
          </FormField>

          <FormField label="Phone Number" required error={errors.phone?.message}>
            <div className="input-with-icon">
              <Phone />
              <input
                {...register('phone')}
                type="tel"
                placeholder="+91 98765 43210"
                className="input-field"
              />
            </div>
          </FormField>

          <FormField label="Email" error={errors.email?.message}>
            <div className="input-with-icon">
              <Mail />
              <input
                {...register('email')}
                type="email"
                placeholder="email@example.com"
                className="input-field"
              />
            </div>
          </FormField>

          <FormField label="Address" className="sm:col-span-2" error={errors.address?.message}>
            <div className="input-with-icon">
              <MapPin />
              <input
                {...register('address')}
                type="text"
                placeholder="Enter address"
                className="input-field"
              />
            </div>
          </FormField>

          <FormField label="Emergency Contact" className="sm:col-span-2" error={errors.emergency_contact?.message}>
            <div className="input-with-icon">
              <Phone />
              <input
                {...register('emergency_contact')}
                type="tel"
                placeholder="Emergency contact number"
                className="input-field"
              />
            </div>
          </FormField>
        </div>
      </SectionCard>

      {/* Employment Details */}
      <SectionCard
        title="Employment Details"
        icon={<Briefcase className="h-4 w-4" />}
        description="Salary, schedule, and employment status"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Employee ID" error={errors.employee_id?.message}>
            <p className="text-xs text-slate-400 mb-1">Leave blank to auto-generate (EMP-XXXX)</p>
            <input
              {...register('employee_id')}
              type="text"
              placeholder="EMP-1001 (auto-generated)"
              className="input-field"
            />
          </FormField>

          <FormField label="Joining Date" required error={errors.joining_date?.message}>
            <div className="input-with-icon">
              <Calendar />
              <input {...register('joining_date')} type="date" className="input-field" />
            </div>
          </FormField>

          <FormField label="Salary (₹/month)" error={errors.salary?.message}>
            <div className="input-with-icon">
              <DollarSign />
              <input
                {...register('salary')}
                type="number"
                min="0"
                placeholder="25000"
                className="input-field"
              />
            </div>
          </FormField>

          <FormField label="Shift" error={errors.shift?.message}>
            <select {...register('shift')} className="select-field">
              <option value="">Select shift</option>
              {STAFF_SHIFTS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>

          <FormField label="Status" required error={errors.status?.message}>
            <select {...register('status')} className="select-field">
              {STAFF_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </FormField>
        </div>
      </SectionCard>

      {/* Role-Specific Details */}
      {role === 'Trainer' && (
        <SectionCard
          title="Trainer Details"
          icon={<Users className="h-4 w-4" />}
          description="Specialization, experience, and certifications"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Specialization" error={errors.specialization?.message} className="sm:col-span-2">
              <input
                {...register('specialization')}
                type="text"
                placeholder="e.g. Weight Training, CrossFit, Yoga"
                className="input-field"
              />
            </FormField>

            <FormField label="Experience (Years)" error={errors.experience?.message}>
              <input
                {...register('experience')}
                type="number"
                min="0"
                placeholder="5"
                className="input-field"
              />
            </FormField>

            <FormField label="Certifications" error={errors.certifications?.message}>
              <input
                {...register('certifications')}
                type="text"
                placeholder="e.g. ACE Certified, CPR Certified"
                className="input-field"
              />
            </FormField>

            <FormField label="Notes" className="sm:col-span-2" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Additional notes..."
                className="textarea-field resize-none"
              />
            </FormField>
          </div>
        </SectionCard>
      )}

      {role === 'Janitor' && (
        <SectionCard
          title="Janitor Details"
          icon={<Users className="h-4 w-4" />}
          description="Cleaning area and duty schedule"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Cleaning Area" className="sm:col-span-2" error={errors.cleaning_area?.message}>
              <input
                {...register('cleaning_area')}
                type="text"
                placeholder="e.g. Gents Gym Floor, Locker Room"
                className="input-field"
              />
            </FormField>

            <FormField label="Working Shift Hours" className="sm:col-span-2" error={errors.working_shift?.message}>
              <input
                {...register('working_shift')}
                type="text"
                placeholder="e.g. 6:00 AM – 2:00 PM"
                className="input-field"
              />
            </FormField>

            <FormField label="Notes" className="sm:col-span-2" error={errors.notes?.message}>
              <textarea
                {...register('notes')}
                rows={3}
                placeholder="Additional notes..."
                className="textarea-field resize-none"
              />
            </FormField>
          </div>
        </SectionCard>
      )}

      <FormActions>
        <Link href={cancelHref} className="btn btn-ghost">
          Cancel
        </Link>
        <button type="submit" disabled={submitting} className="btn btn-primary">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              {submitLabel}
            </>
          )}
        </button>
      </FormActions>
    </form>
  );
}
