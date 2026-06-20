'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Phone,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  UserPlus,
  Info,
} from 'lucide-react';
import { FormField, SectionCard } from '@/components/ui/Primitives';
import { adminCreateUser } from '@/lib/actions/users';

const fieldClass =
  'input-field bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800';
const fieldErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';

interface UserFormProps {
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export function UserForm({ onSuccess, onError }: UserFormProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'Trainer',
    password: '',
    status: 'Active' as 'Active' | 'Suspended',
    notes: '',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validateForm = () => {
    const errors: Record<string, string> = {};
    if (!formData.fullName.trim()) {
      errors.fullName = 'Full Name is required.';
    }
    if (!formData.email.trim()) {
      errors.email = 'Email Address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Please provide a valid email address.';
    }
    if (formData.phone && !/^\+?[0-9\s\-()]{7,16}$/.test(formData.phone)) {
      errors.phone = 'Please provide a valid phone number.';
    }
    if (formData.password && formData.password.length < 6) {
      errors.password = 'Temporary password must be at least 6 characters.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      await adminCreateUser({
        email: formData.email,
        password: formData.password || undefined,
        fullName: formData.fullName,
        phone: formData.phone || undefined,
        role: formData.role,
        status: formData.status,
        notes: formData.notes || undefined,
      });
      onSuccess(`User account ${formData.email} created successfully.`);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to create administrator account. Verify service role configuration.';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <SectionCard
        title="Personal Information"
        description="Name, email, and contact details for the new operator."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="Full Name" htmlFor="add_fullName" required error={formErrors.fullName}>
            <input
              id="add_fullName"
              type="text"
              placeholder="Arjun Sharma"
              aria-invalid={!!formErrors.fullName}
              className={`${fieldClass} ${formErrors.fullName ? fieldErrorClass : ''}`}
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            />
          </FormField>

          <FormField label="Email Address" htmlFor="add_email" required error={formErrors.email}>
            <input
              id="add_email"
              type="email"
              placeholder="name@fusionfit.com"
              aria-invalid={!!formErrors.email}
              className={`${fieldClass} ${formErrors.email ? fieldErrorClass : ''}`}
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </FormField>

          <FormField label="Phone Number" htmlFor="add_phone" error={formErrors.phone}>
            <div className="relative flex items-center">
              <Phone className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
              <input
                id="add_phone"
                type="text"
                placeholder="+91 98765 43210"
                aria-invalid={!!formErrors.phone}
                className={`${fieldClass} pl-10 ${formErrors.phone ? fieldErrorClass : ''}`}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </FormField>
        </div>
      </SectionCard>

      <SectionCard
        title="Access & Permissions"
        description="System role, temporary password, and account status."
      >
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <FormField label="System Access Role" htmlFor="add_role" required>
            <select
              id="add_role"
              className="select-field bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
            >
              <option value="Super Admin">Super Admin</option>
              <option value="Admin">Admin</option>
              <option value="Receptionist">Receptionist</option>
              <option value="Trainer">Trainer</option>
            </select>
          </FormField>

          <FormField label="Temporary Password" htmlFor="add_password" error={formErrors.password}>
            <div className="relative flex items-center">
              <Lock className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
              <input
                id="add_password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Default is password123"
                aria-invalid={!!formErrors.password}
                className={`${fieldClass} pl-10 pr-10 ${formErrors.password ? fieldErrorClass : ''}`}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-400 hover:bg-slate-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </FormField>

          <FormField label="Account Access Status" htmlFor="add_status" required>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <input
                  type="radio"
                  name="status"
                  value="Active"
                  checked={formData.status === 'Active'}
                  onChange={() => setFormData({ ...formData, status: 'Active' })}
                  className="h-4 w-4 cursor-pointer border-slate-300 text-amber-500 focus:ring-amber-500"
                />
                Active
              </label>
              <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                <input
                  type="radio"
                  name="status"
                  value="Suspended"
                  checked={formData.status === 'Suspended'}
                  onChange={() => setFormData({ ...formData, status: 'Suspended' })}
                  className="h-4 w-4 cursor-pointer border-slate-300 text-rose-500 focus:ring-rose-500"
                />
                Suspended
              </label>
            </div>
          </FormField>
        </div>

        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-500/15 bg-amber-50/70 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>If no password is provided, the system default (<code className="font-mono">password123</code>) will be assigned. It is recommended to reset the password after first login.</span>
        </div>
      </SectionCard>

      <SectionCard
        title="Internal Notes"
        description="Optional notes about shifts, specializations, or temporary permissions."
      >
        <FormField label="Notes / Biography" htmlFor="add_notes">
          <textarea
            id="add_notes"
            rows={4}
            placeholder="Notes about working shifts, trainer specializations, or temporary permissions."
            className="textarea-field bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </FormField>
      </SectionCard>

      {/* Action Buttons */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link
          href="/users"
          className="btn btn-secondary justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
          Cancel
        </Link>
        <button
          type="submit"
          className="btn btn-primary min-w-[160px] justify-center shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all"
          disabled={submitting}
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
              Creating...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              Create Account
            </>
          )}
        </button>
      </div>
    </form>
  );
}
