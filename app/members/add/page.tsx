'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Save, Upload, Loader2, User, Phone, Mail, Calendar, MapPin, AlertCircle, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { memberSchema, MemberFormValues, MEMBERSHIP_PLANS, MEMBER_STATUSES } from '@/types';
import { createMember, uploadProfilePhoto } from '@/lib/actions/members';

export default function AddMemberPage() {
  const router = useRouter();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<MemberFormValues>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      membership_plan: 'Monthly',
      status: 'Active',
      join_date: new Date().toISOString().split('T')[0],
    },
  });

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
  }

  async function onSubmit(data: MemberFormValues) {
    setSubmitting(true);
    setError(null);
    try {
      let profile_photo: string | undefined;
      if (photoFile) {
        try {
          profile_photo = await uploadProfilePhoto(photoFile);
        } catch {
          /* skip photo on error */
        }
      }
      const member = await createMember({ ...data, profile_photo });
      router.push(`/members/${member.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create member');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto px-6 py-8"
    >
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center text-[13px] text-slate-500 gap-2 font-medium">
        <Link href="/" className="hover:text-[#F59E0B] transition-colors">
          Dashboard
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <Link href="/members" className="hover:text-[#F59E0B] transition-colors">
          Members
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-900 font-semibold" aria-current="page">
          Add New Member
        </span>
      </nav>

      {/* Header */}
      <header className="mb-10">
        <h1 className="text-[36px] font-bold tracking-tight text-slate-900 leading-tight">
          Add New Member
        </h1>
        <p className="text-base text-slate-500 mt-2 font-medium">
          Register a new gym member, assign a membership plan, and configure their profile settings.
        </p>
      </header>

      {/* Main Form Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Profile Photo Card */}
        <section className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
          <div className="pb-4">
            <h2 className="text-[20px] font-semibold text-slate-900">Profile Photo</h2>
            <p className="text-sm text-slate-500 mt-1">Upload a profile picture for this member</p>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Large Avatar Preview */}
              <div className="relative group w-28 h-28 rounded-full border-4 border-slate-50 shadow-md flex items-center justify-center overflow-hidden shrink-0 bg-slate-50 transition-transform duration-300 hover:scale-105">
                {photoPreview ? (
                  <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-slate-300" />
                )}
              </div>

              {/* Drag & Drop Upload Area */}
              <div
                className={`flex-1 w-full border-2 border-dashed rounded-2xl p-6 transition-all duration-300 cursor-pointer ${
                  isDragging
                    ? 'border-[#FFD700] bg-[#FFD700]/5 shadow-[0_0_12px_rgba(255,215,0,0.1)]'
                    : 'border-slate-200 bg-slate-50 hover:bg-slate-100/70 hover:border-slate-300'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => document.getElementById('photo-upload')?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    document.getElementById('photo-upload')?.click();
                  }
                }}
                aria-label="Upload profile picture"
              >
                <div className="flex flex-col items-center justify-center text-center gap-2">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                    <Upload className="w-5 h-5 text-slate-400" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-[#F59E0B] hover:text-[#D97706] transition-colors">
                      Click to upload
                    </span>
                    <span className="text-sm text-slate-500 font-medium"> or drag and drop</span>
                  </div>
                  <p className="text-xs text-slate-400 font-medium">PNG, JPG or GIF (max. 5MB)</p>
                  <input
                    id="photo-upload"
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoChange}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Form Grid Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
          {/* Left Column: Personal Info & Address */}
          <div className="space-y-8">
            {/* Personal Information Card */}
            <section className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
              <div className="pb-4">
                <h2 className="text-[20px] font-semibold text-slate-900">Personal Information</h2>
                <p className="text-sm text-slate-500 mt-1">Basic details about the member</p>
              </div>
              <div className="border-t border-slate-100 pt-6 space-y-6">
                {/* Full Name */}
                <div>
                  <label htmlFor="full_name" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center w-full">
                    <User className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="full_name"
                      {...register('full_name')}
                      type="text"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      placeholder="John Doe"
                      aria-required="true"
                      aria-invalid={errors.full_name ? 'true' : 'false'}
                      aria-describedby={errors.full_name ? 'full_name_error' : undefined}
                    />
                  </div>
                  {errors.full_name && (
                    <p id="full_name_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.full_name.message}
                    </p>
                  )}
                </div>

                {/* Phone Number */}
                <div>
                  <label htmlFor="phone" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center w-full">
                    <Phone className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="phone"
                      {...register('phone')}
                      type="tel"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      placeholder="+91 98765 43210"
                      aria-required="true"
                      aria-invalid={errors.phone ? 'true' : 'false'}
                      aria-describedby={errors.phone ? 'phone_error' : undefined}
                    />
                  </div>
                  {errors.phone && (
                    <p id="phone_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.phone.message}
                    </p>
                  )}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="email" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Email Address
                  </label>
                  <div className="relative flex items-center w-full">
                    <Mail className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="email"
                      {...register('email')}
                      type="email"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      placeholder="john@example.com"
                      aria-invalid={errors.email ? 'true' : 'false'}
                      aria-describedby={errors.email ? 'email_error' : undefined}
                    />
                  </div>
                  {errors.email && (
                    <p id="email_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label htmlFor="dob" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Date of Birth
                  </label>
                  <div className="relative flex items-center w-full">
                    <Calendar className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="dob"
                      {...register('dob')}
                      type="date"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      aria-invalid={errors.dob ? 'true' : 'false'}
                      aria-describedby={errors.dob ? 'dob_error' : undefined}
                    />
                  </div>
                  {errors.dob && (
                    <p id="dob_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.dob.message}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* Address & Emergency Details Card */}
            <section className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
              <div className="pb-4">
                <h2 className="text-[20px] font-semibold text-slate-900">Address & Emergency Details</h2>
                <p className="text-sm text-slate-500 mt-1">Contact location and emergency contact info</p>
              </div>
              <div className="border-t border-slate-100 pt-6 space-y-6">
                {/* Address */}
                <div>
                  <label htmlFor="address" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Address
                  </label>
                  <div className="relative flex items-center w-full">
                    <MapPin className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="address"
                      {...register('address')}
                      type="text"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      placeholder="123 Main St, City, Country"
                      aria-invalid={errors.address ? 'true' : 'false'}
                      aria-describedby={errors.address ? 'address_error' : undefined}
                    />
                  </div>
                  {errors.address && (
                    <p id="address_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.address.message}
                    </p>
                  )}
                </div>

                {/* Emergency Contact */}
                <div>
                  <label htmlFor="emergency_contact" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Emergency Contact
                  </label>
                  <div className="relative flex items-center w-full">
                    <Phone className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="emergency_contact"
                      {...register('emergency_contact')}
                      type="text"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 placeholder-slate-400 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      placeholder="Jane Doe — +91 98765 43210"
                      aria-invalid={errors.emergency_contact ? 'true' : 'false'}
                      aria-describedby={errors.emergency_contact ? 'emergency_contact_error' : undefined}
                    />
                  </div>
                  {errors.emergency_contact && (
                    <p id="emergency_contact_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.emergency_contact.message}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Right Column: Membership Details */}
          <div className="space-y-8">
            {/* Membership Details Card */}
            <section className="bg-white rounded-[20px] border border-slate-200/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-6">
              <div className="pb-4">
                <h2 className="text-[20px] font-semibold text-slate-900">Membership Details</h2>
                <p className="text-sm text-slate-500 mt-1">Enrollment type, status, and join date</p>
              </div>
              <div className="border-t border-slate-100 pt-6 space-y-6">
                {/* Membership Plan */}
                <div>
                  <label htmlFor="membership_plan" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Membership Plan <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="membership_plan"
                      {...register('membership_plan')}
                      className="w-full h-[52px] px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300 appearance-none bg-no-repeat bg-[right_16px_center] bg-[length:18px]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      }}
                      aria-required="true"
                      aria-invalid={errors.membership_plan ? 'true' : 'false'}
                      aria-describedby={errors.membership_plan ? 'membership_plan_error' : undefined}
                    >
                      {MEMBERSHIP_PLANS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.membership_plan && (
                    <p id="membership_plan_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.membership_plan.message}
                    </p>
                  )}
                </div>

                {/* Join Date */}
                <div>
                  <label htmlFor="join_date" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Join Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative flex items-center w-full">
                    <Calendar className="absolute left-4 w-5 h-5 text-slate-400 pointer-events-none" />
                    <input
                      id="join_date"
                      {...register('join_date')}
                      type="date"
                      className="w-full h-[52px] pl-12 pr-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300"
                      aria-required="true"
                      aria-invalid={errors.join_date ? 'true' : 'false'}
                      aria-describedby={errors.join_date ? 'join_date_error' : undefined}
                    />
                  </div>
                  {errors.join_date && (
                    <p id="join_date_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.join_date.message}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label htmlFor="status" className="text-[14px] font-medium text-slate-700 block mb-2">
                    Status <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      id="status"
                      {...register('status')}
                      className="w-full h-[52px] px-4 rounded-xl border border-slate-200 bg-white text-[14px] text-slate-900 font-medium transition-all duration-200 focus:outline-none focus:border-[#FFD700] focus:ring-4 focus:ring-[#FFD700]/10 hover:border-slate-300 appearance-none bg-no-repeat bg-[right_16px_center] bg-[length:18px]"
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2371717a' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                      }}
                      aria-required="true"
                      aria-invalid={errors.status ? 'true' : 'false'}
                      aria-describedby={errors.status ? 'status_error' : undefined}
                    >
                      {MEMBER_STATUSES.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                  {errors.status && (
                    <p id="status_error" className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {errors.status.message}
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="p-4 rounded-xl bg-rose-50 border border-rose-100 text-sm text-rose-600 flex items-center gap-3 font-medium"
            role="alert"
          >
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            {error}
          </motion.div>
        )}

        {/* Action Buttons Footer (Non-sticky) */}
        <footer className="mt-8 pt-6 border-t border-slate-200">
          <div className="flex flex-col md:flex-row md:justify-end gap-3 w-full">
            <Link
              href="/members"
              className="order-2 md:order-1 flex items-center justify-center w-full md:w-auto h-[52px] px-6 rounded-xl border border-slate-200 bg-white text-[14px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              Cancel
            </Link>

            <motion.button
              type="submit"
              disabled={submitting}
              whileHover={{ scale: 1.01, translateY: -1 }}
              whileTap={{ scale: 0.99 }}
              className="order-1 md:order-2 flex items-center justify-center gap-2 w-full md:w-auto h-[52px] px-8 rounded-xl bg-gradient-to-r from-[#FFD700] to-[#F59E0B] text-[14px] font-bold text-slate-950 transition-shadow hover:shadow-[0_6px_20px_rgba(255,215,0,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {submitting ? 'Saving Member...' : 'Save Member'}
            </motion.button>
          </div>
        </footer>
      </form>
    </motion.div>
  );
}
