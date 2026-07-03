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
  Member,
} from '@/types';
import { cn } from '@/lib/utils';
import { getSettings } from '@/lib/actions/settings';
import { getMembers } from '@/lib/actions/members';
import { getPTPackages } from '@/lib/actions/pt';
import { GymSettings } from '@/types';
import { calculatePackagePrice } from '@/lib/pricing';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';

const defaultValues: MemberFormValues = {
  full_name: '',
  phone: '',
  email: '',
  address: '',
  emergency_contact: '',
  dob: '',
  package_name: 'Gents - 1 Month - Weight Training Only',
  package_duration: '1 Month',
  package_price: 1000,
  package_start_date: new Date().toISOString().split('T')[0],
  package_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  status: 'Active',
  profile_photo: '',
  biometric_user_id: '',
  gender: 'Gents',
  duration: '1 Month',
  training_type: 'Weight Training Only',
  membership_fee: 1000,
  parq_purchased: false,
  parq_fee: 0,
  trainer_package: false,
  trainer_fee: 0,
  admission_fee: 0,
  machine_type: 'Gents',
  tax: 0,
  discount: 0,
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
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [gymSettings, setGymSettings] = useState<GymSettings | null>(null);

  useEffect(() => {
    getSettings().then(setGymSettings).catch(console.error);
  }, []);

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState(initialValues?.profile_photo || '');
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [ptPackages, setPtPackages] = useState<any[]>([]);

  const legacyInitial = initialValues as any;
  const parsedInitialValues = {
    ...initialValues,
    gender: initialValues?.gender || legacyInitial?.gender || 'Gents',
    duration: initialValues?.duration || legacyInitial?.duration || (legacyInitial?.package_duration === 'Custom' ? '1 Month' : legacyInitial?.package_duration) || '1 Month',
    training_type: initialValues?.training_type || legacyInitial?.training_type || 'Weight Training Only',
    membership_fee: initialValues?.membership_fee ?? legacyInitial?.membership_fee ?? 1000,
    parq_purchased: initialValues?.parq_purchased ?? legacyInitial?.parq_purchased ?? false,
    parq_fee: initialValues?.parq_fee ?? legacyInitial?.parq_fee ?? 0,
    trainer_package: initialValues?.trainer_package ?? legacyInitial?.trainer_package ?? false,
    trainer_fee: initialValues?.trainer_fee ?? legacyInitial?.trainer_fee ?? 0,
    admission_fee: initialValues?.admission_fee ?? legacyInitial?.admission_fee ?? 0,
    machine_type: initialValues?.machine_type || legacyInitial?.machine_type || 'Gents',
    package_name: initialValues?.package_name || (legacyInitial?.membership_plan ? `${legacyInitial.membership_plan} Plan` : 'Gents - 1 Month - Weight Training Only'),
    package_duration: initialValues?.package_duration || (legacyInitial?.membership_plan ? (
      legacyInitial.membership_plan === 'Monthly' ? '1 Month' :
      legacyInitial.membership_plan === 'Quarterly' ? '3 Months' :
      legacyInitial.membership_plan === 'Biannual' ? '6 Months' : '1 Month'
    ) : '1 Month'),
    package_price: initialValues?.package_price ?? legacyInitial?.package_price ?? 1000,
    package_start_date: initialValues?.package_start_date || legacyInitial?.join_date || new Date().toISOString().split('T')[0],
    package_end_date: initialValues?.package_end_date || (legacyInitial?.join_date ? new Date(new Date(legacyInitial.join_date).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
    biometric_user_id: initialValues?.biometric_user_id || legacyInitial?.device_user_id || '',
  };

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

  const [allMembers, setAllMembers] = useState<Member[]>([]);

  useEffect(() => {
    getMembers().then((membersList) => {
      setAllMembers(membersList);

      // Auto-suggest next ID only on Add form (when no initial biometric_user_id)
      const currentBiometricId = initialValues?.biometric_user_id || (initialValues as any)?.device_user_id;
      if (!currentBiometricId && submitLabel === 'Save member') {
        const selectedMachine = parsedInitialValues.machine_type || 'Gents';
        const numericIds = membersList
          .filter((m) => m.machine_type === selectedMachine)
          .map((m) => m.biometric_user_id)
          .filter((id): id is string => !!id && /^\d+$/.test(id))
          .map((id) => parseInt(id, 10));
        
        const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
        setValue('biometric_user_id', String(nextId), { shouldValidate: true });
      }
    }).catch(console.error);
  }, [initialValues, submitLabel, setValue]);

  useEffect(() => {
    if (isDemo) {
      setPtPackages(demo.ptPackages || []);
      return;
    }
    getPTPackages().then(setPtPackages).catch(console.error);
  }, [isDemo, demo.ptPackages]);

  useEffect(() => {
    if (gymSettings) {
      if (initialValues?.tax === undefined) {
        setValue('tax', 0);
      }
    }
  }, [gymSettings, initialValues, setValue]);

  const handleAutoGenerate = async () => {
    try {
      const membersList = await getMembers();
      const selectedMachine = watch('machine_type') || 'Gents';
      const numericIds = membersList
        .filter((m) => m.machine_type === selectedMachine)
        .map((m) => m.biometric_user_id)
        .filter((id): id is string => !!id && /^\d+$/.test(id))
        .map((id) => parseInt(id, 10));

      const nextId = numericIds.length > 0 ? Math.max(...numericIds) + 1 : 1;
      setValue('biometric_user_id', String(nextId), { shouldValidate: true });
    } catch (err) {
      console.error('Failed to auto-generate biometric user ID:', err);
    }
  };

  const handleFormSubmit = handleSubmit((data) => {
    if (data.biometric_user_id) {
      const currentMemberId = (initialValues as any)?.id;
      const duplicate = allMembers.find(
        (m) =>
          m.id !== currentMemberId &&
          m.biometric_user_id === data.biometric_user_id &&
          m.machine_type === data.machine_type
      );
      if (duplicate) {
        const machineName = data.machine_type === 'Gents' ? 'Gents Machine' : 'Ladies Machine';
        setError('biometric_user_id', {
          type: 'manual',
          message: `Biometric ID ${data.biometric_user_id} already exists on ${machineName}.`,
        });
        return;
      }
    }
    onSubmit(data, photoFile);
  });

  const gender = watch('gender');
  const duration = watch('duration');
  const trainingType = watch('training_type');
  const parqPurchased = watch('parq_purchased');
  const trainerPackage = watch('trainer_package');
  const machineType = watch('machine_type');
  const startDate = watch('package_start_date');
  const admissionFee = watch('admission_fee') || 0;
  
  const membershipFee = watch('membership_fee') || 0;
  const parqFee = watch('parq_fee') || 0;
  const trainerFee = watch('trainer_fee') || 0;
  const lockerFee = watch('locker_fee') || 0;
  const dietPlanFee = watch('diet_plan_fee') || 0;
  const discount = watch('discount') || 0;
  const taxPercent = watch('tax') || 0;
  const paidAmount = watch('paid_amount') || 0;
  const ptPackageId = watch('pt_package_id') || '';

  // Synchronize trainer_fee and trainer_package when pt_package_id is updated
  useEffect(() => {
    if (!ptPackageId) {
      setValue('trainer_package', false);
      setValue('trainer_fee', 0);
      return;
    }
    const pkg = ptPackages.find(p => p.id === ptPackageId);
    if (pkg) {
      setValue('trainer_package', true);
      setValue('trainer_fee', Number(pkg.final_price || pkg.price || 0));
    }
  }, [ptPackageId, ptPackages, setValue]);

  // Auto-calculate end date
  useEffect(() => {
    if (!startDate || !duration) return;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return;
    
    if (duration === 'Daily Pass') {
      setValue('package_end_date', startDate, { shouldDirty: true, shouldValidate: true });
      return;
    }

    const durStr = duration.toLowerCase().trim();
    if (durStr.includes('month') || durStr.includes('mo')) {
      const match = durStr.match(/\d+/);
      const num = match ? parseInt(match[0], 10) : 1;
      start.setMonth(start.getMonth() + num);
    } else {
      start.setMonth(start.getMonth() + 1);
    }
    
    setValue('package_end_date', start.toISOString().split('T')[0], { shouldDirty: true, shouldValidate: true });
  }, [startDate, duration, setValue]);

  // Pricing engine recalculations based on Genders, Durations and Training Types
  useEffect(() => {
    if (!gender || !duration || !trainingType) return;
    
    const result = calculatePackagePrice({
      gender,
      duration,
      trainingType,
      admissionFee,
      addOnSelections: {
        parq_purchased: parqPurchased,
        trainer_package: trainerPackage,
      },
      settings: gymSettings || undefined,
    });

    setValue('membership_fee', result.membershipFee, { shouldDirty: true, shouldValidate: true });
    setValue('parq_fee', result.addOnFees['parq_purchased'], { shouldDirty: true, shouldValidate: true });
    
    let currentTrainerFee = result.addOnFees['trainer_package'];
    if (ptPackageId) {
      const pkg = ptPackages.find(p => p.id === ptPackageId);
      if (pkg) {
        currentTrainerFee = Number(pkg.final_price || pkg.price || 0);
      }
    }
    setValue('trainer_fee', currentTrainerFee, { shouldDirty: true, shouldValidate: true });

    const finalPackagePrice = result.membershipFee + result.addOnFees['parq_purchased'] + currentTrainerFee + admissionFee;
    setValue('package_price', finalPackagePrice, { shouldDirty: true, shouldValidate: true });

    const isDailyPass = duration === 'Daily Pass';
    const name = isDailyPass ? 'Daily Pass' : `${gender} - ${duration} - ${trainingType}`;
    setValue('package_name', name, { shouldDirty: true, shouldValidate: true });
    setValue('package_duration', duration, { shouldDirty: true, shouldValidate: true });
  }, [gender, duration, trainingType, parqPurchased, trainerPackage, admissionFee, ptPackageId, ptPackages, gymSettings, setValue]);

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
            description="Select gender, duration, training type, PAR-Q status, and validity dates."
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <div className="field-grid field-grid-2">
              <FormField
                label="Gender"
                htmlFor="gender"
                required
                error={errors.gender?.message}
              >
                <select
                  id="gender"
                  className="select-field"
                  aria-invalid={Boolean(errors.gender)}
                  {...register('gender')}
                >
                  <option value="Gents">Gents</option>
                  <option value="Ladies">Ladies</option>
                </select>
              </FormField>

              <FormField
                label="Duration"
                htmlFor="duration"
                required
                error={errors.duration?.message}
              >
                <select
                  id="duration"
                  className="select-field"
                  aria-invalid={Boolean(errors.duration)}
                  {...register('duration')}
                >
                  <option value="Daily Pass">Daily Pass</option>
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                </select>
              </FormField>

              <FormField
                label="Training Type"
                htmlFor="training_type"
                required
                error={errors.training_type?.message}
              >
                <select
                  id="training_type"
                  className="select-field"
                  aria-invalid={Boolean(errors.training_type)}
                  {...register('training_type')}
                >
                  <option value="Weight Training Only">Weight Training Only</option>
                  <option value="Weight Training + Cardio">Weight Training + Cardio</option>
                  <option value="Weight Training + Strength Training">Weight Training + Strength Training</option>
                </select>
              </FormField>

              <FormField
                label="PAR-Q Status"
                htmlFor="parq_purchased"
                className="flex items-center gap-2 pt-6"
              >
                <div className="flex items-center gap-2">
                  <input
                    id="parq_purchased"
                    type="checkbox"
                    disabled={duration === 'Daily Pass'}
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                    {...register('parq_purchased')}
                  />
                  <span className="text-sm font-semibold text-slate-700">PAR-Q Purchased (₹3000)</span>
                </div>
              </FormField>

              <FormField
                label="Trainer Package Status"
                htmlFor="trainer_package"
                className="flex items-center gap-2 pt-6"
              >
                <div className="flex items-center gap-2">
                  <input
                    id="trainer_package"
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-500 disabled:opacity-50"
                    {...register('trainer_package')}
                  />
                  <span className="text-sm font-semibold text-slate-700">Personal Trainer Package (₹3000)</span>
                </div>
              </FormField>

              <FormField
                label="Membership Fee (INR)"
                htmlFor="membership_fee"
              >
                <input
                  id="membership_fee"
                  type="text"
                  disabled
                  className="input-field bg-slate-50 opacity-75 font-semibold text-slate-800"
                  {...register('membership_fee')}
                />
              </FormField>

              <FormField
                label="PAR-Q Fee (INR)"
                htmlFor="parq_fee"
              >
                <input
                  id="parq_fee"
                  type="text"
                  disabled
                  className="input-field bg-slate-50 opacity-75 font-semibold text-slate-800"
                  {...register('parq_fee')}
                />
              </FormField>

              <FormField
                label="Trainer Fee (INR)"
                htmlFor="trainer_fee"
              >
                <input
                  id="trainer_fee"
                  type="text"
                  disabled
                  className="input-field bg-slate-50 opacity-75 font-semibold text-slate-800"
                  {...register('trainer_fee')}
                />
              </FormField>

              <FormField
                label="Admission Fee (INR)"
                htmlFor="admission_fee"
                error={errors.admission_fee?.message}
              >
                <input
                  id="admission_fee"
                  type="number"
                  className="input-field font-semibold text-slate-800"
                  {...register('admission_fee', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label="Total Package Price (INR)"
                htmlFor="package_price"
              >
                <input
                  id="package_price"
                  type="text"
                  disabled
                  className="input-field bg-slate-100 font-extrabold text-amber-700 border-amber-300"
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

              {duration !== 'Daily Pass' && (
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
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Invoice & Billing Details"
            description="Configure initial invoice billing options, locker fees, diet fees, taxes, discounts, and payment info."
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <div className="field-grid field-grid-2">
              <FormField
                label="PT Package (Optional)"
                htmlFor="pt_package_id"
              >
                <select
                  id="pt_package_id"
                  className="select-field font-semibold text-slate-800"
                  {...register('pt_package_id')}
                >
                  <option value="">No PT Plan</option>
                  {ptPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.package_name} - ₹{pkg.final_price || pkg.price} ({pkg.trainer?.full_name || 'No trainer'})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField
                label="Locker Fee (INR)"
                htmlFor="locker_fee"
                error={errors.locker_fee?.message}
              >
                <input
                  id="locker_fee"
                  type="number"
                  min="0"
                  className="input-field font-semibold text-slate-800"
                  {...register('locker_fee', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label="Diet Plan Fee (INR)"
                htmlFor="diet_plan_fee"
                error={errors.diet_plan_fee?.message}
              >
                <input
                  id="diet_plan_fee"
                  type="number"
                  min="0"
                  className="input-field font-semibold text-slate-800"
                  {...register('diet_plan_fee', { valueAsNumber: true })}
                />
              </FormField>

              <FormField
                label="Discount (INR)"
                htmlFor="discount"
                error={errors.discount?.message}
              >
                <input
                  id="discount"
                  type="number"
                  min="0"
                  className="input-field font-semibold text-slate-800"
                  {...register('discount', { valueAsNumber: true })}
                />
              </FormField>


              <FormField
                label="Payment Method"
                htmlFor="payment_method"
                error={errors.payment_method?.message}
              >
                <select
                  id="payment_method"
                  className="select-field font-semibold text-slate-800"
                  {...register('payment_method')}
                >
                  <option value="">Unpaid (No Payment)</option>
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Online Payment">Online Payment</option>
                </select>
              </FormField>

              <FormField
                label="Paid Amount (INR)"
                htmlFor="paid_amount"
                error={errors.paid_amount?.message}
              >
                <input
                  id="paid_amount"
                  type="number"
                  min="0"
                  className="input-field font-semibold text-slate-800"
                  {...register('paid_amount', { valueAsNumber: true })}
                />
              </FormField>
            </div>

            {/* Live Invoice Breakdown Preview */}
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/40 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-3">Live Invoice Calculations Summary</h4>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Base Membership Fee:</span>
                  <span className="font-semibold text-slate-800">₹{membershipFee}</span>
                </div>
                {parqPurchased && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">PAR-Q Fee:</span>
                    <span className="font-semibold text-slate-800">₹{parqFee}</span>
                  </div>
                )}
                {trainerPackage && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Personal Training Fee:</span>
                    <span className="font-semibold text-slate-800">₹{trainerFee}</span>
                  </div>
                )}
                {admissionFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Admission Fee:</span>
                    <span className="font-semibold text-slate-800">₹{admissionFee}</span>
                  </div>
                )}
                {lockerFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Locker Fee:</span>
                    <span className="font-semibold text-slate-800">₹{lockerFee}</span>
                  </div>
                )}
                {dietPlanFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Diet Plan Fee:</span>
                    <span className="font-semibold text-slate-800">₹{dietPlanFee}</span>
                  </div>
                )}
                <div className="border-t border-slate-200 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal:</span>
                  <span className="font-semibold text-slate-800">
                    ₹{Number(membershipFee) + Number(parqFee) + Number(trainerFee) + Number(admissionFee) + Number(lockerFee) + Number(dietPlanFee)}
                  </span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>Discount:</span>
                    <span className="font-semibold">-₹{discount}</span>
                  </div>
                )}
                <div className="border-t border-amber-300 my-2"></div>
                <div className="flex justify-between text-base font-extrabold text-amber-900">
                  <span>Grand Total:</span>
                  <span>
                    ₹{Math.max(
                      0,
                      (Number(membershipFee) + Number(parqFee) + Number(trainerFee) + Number(admissionFee) + Number(lockerFee) + Number(dietPlanFee)) -
                      discount
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600 text-xs mt-1">
                  <span>Paid Amount:</span>
                  <span className="font-semibold text-emerald-700">₹{paidAmount}</span>
                </div>
                <div className="flex justify-between text-slate-700 text-xs">
                  <span>Balance Due:</span>
                  <span className="font-bold text-red-600">
                    ₹{Math.max(
                      0,
                      Math.max(
                        0,
                        (Number(membershipFee) + Number(parqFee) + Number(trainerFee) + Number(admissionFee) + Number(lockerFee) + Number(dietPlanFee)) -
                        discount
                      ) - paidAmount
                    )}
                  </span>
                </div>
              </div>
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
              label="Machine"
              htmlFor="machine_type"
              required
              error={errors.machine_type?.message}
            >
              <select
                id="machine_type"
                className="select-field"
                aria-invalid={Boolean(errors.machine_type)}
                {...register('machine_type')}
              >
                <option value="Gents">Gents Machine</option>
                <option value="Ladies">Ladies Machine</option>
              </select>
              <p className="mt-1.5 text-xs text-slate-500">
                Select which fingerprint machine this member is assigned to.
              </p>
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
                This ID is unique per machine. The same ID can exist on both Gents and Ladies machines.
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
