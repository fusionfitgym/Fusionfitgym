'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Info,
  Loader2,
} from 'lucide-react';
import { FormField } from '@/components/ui/Primitives';
import { adminCreateUser, adminUpdateUser } from '@/lib/actions/users';

export type UserProfile = {
  id: string;
  auth_user_id?: string | null;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  role?: string | null;
  status?: 'Active' | 'Suspended' | string | null;
  notes?: string | null;
  created_at?: string | null;
};

interface UserModalProps {
  isOpen: boolean;
  mode: 'add' | 'edit';
  user: UserProfile | null;
  loggedInUserId?: string | null;
  onClose: () => void;
  onSaveSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const fieldClass =
  'input-field bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800';
const fieldErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
const modalPanelClass =
  'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-h-[calc(100dvh-3rem)]';

export function UserModal({
  isOpen,
  mode,
  user,
  loggedInUserId,
  onClose,
  onSaveSuccess,
  onError,
}: UserModalProps) {
  const [formData, setFormData] = useState({
    id: '',
    authUserId: '',
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

  useEffect(() => {
    if (isOpen) {
      if (mode === 'edit' && user) {
        setFormData({
          id: user.id,
          authUserId: user.auth_user_id || '',
          fullName: user.full_name || '',
          email: user.email || '',
          phone: user.phone || '',
          role: user.role || 'Trainer',
          password: '',
          status: user.status === 'Suspended' ? 'Suspended' : 'Active',
          notes: user.notes || '',
        });
      } else {
        setFormData({
          id: '',
          authUserId: '',
          fullName: '',
          email: '',
          phone: '',
          role: 'Trainer',
          password: '',
          status: 'Active',
          notes: '',
        });
      }
      setFormErrors({});
      setShowPassword(false);
    }
  }, [isOpen, mode, user]);

  if (!isOpen) return null;

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
    if (mode === 'add') {
      if (formData.password && formData.password.length < 6) {
        errors.password = 'Temporary password must be at least 6 characters.';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (mode === 'add') {
        const res = await adminCreateUser({
          email: formData.email,
          password: formData.password || undefined,
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          role: formData.role,
          status: formData.status,
          notes: formData.notes || undefined,
        });
        if (res?.error) {
          throw new Error(res.error);
        }
        onSaveSuccess(`User account ${formData.email} created successfully.`);
      } else {
        const res = await adminUpdateUser({
          id: formData.id,
          authUserId: formData.authUserId,
          fullName: formData.fullName,
          phone: formData.phone || undefined,
          role: formData.role,
          status: formData.status,
          notes: formData.notes || undefined,
          userEmail: formData.email,
        });
        if (res?.error) {
          throw new Error(res.error);
        }
        onSaveSuccess(`User profile for ${formData.email} has been updated.`);
      }
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save administrator account details. Verify service role configuration.';
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm animate-enter sm:items-center sm:p-6">
      <div className={`${modalPanelClass} max-w-3xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-zinc-900/70 sm:px-6">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {mode === 'add' ? 'Create New Operator Account' : 'Edit Operator Settings'}
            </h3>
            <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
              {mode === 'add'
                ? 'Register a new administrative or trainer profile with role permissions.'
                : 'Update user roles, contact information, status policies, or internal notes.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="table-action shrink-0 text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
            type="button"
            disabled={submitting}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Full Name" htmlFor="fullName" required error={formErrors.fullName}>
                <input
                  id="fullName"
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
                  disabled={mode === 'edit'}
                  placeholder="name@fusionfit.com"
                  aria-invalid={!!formErrors.email}
                  className={`${fieldClass} ${
                    mode === 'edit' ? 'cursor-not-allowed bg-slate-100 opacity-75 dark:bg-zinc-900/60' : ''
                  } ${formErrors.email ? fieldErrorClass : ''}`}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Phone Number" htmlFor="phone" error={formErrors.phone}>
                <div className="relative flex items-center">
                  <Phone className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-400" />
                  <input
                    id="phone"
                    type="text"
                    placeholder="+91 98765 43210"
                    aria-invalid={!!formErrors.phone}
                    className={`${fieldClass} pl-10 ${formErrors.phone ? fieldErrorClass : ''}`}
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </FormField>

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
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {mode === 'add' ? (
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
              ) : (
                <div className="flex min-h-[78px] flex-col justify-center rounded-xl border border-amber-500/15 bg-amber-50/70 p-3 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                  <span className="mb-1 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 shrink-0" /> Password Editing
                  </span>
                  Password changes must use the Reset Password action on the user row.
                </div>
              )}

              <FormField label="Account Access Status" htmlFor="status" required>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <input
                      type="radio"
                      name="status"
                      value="Active"
                      checked={formData.status === 'Active'}
                      disabled={formData.authUserId === loggedInUserId}
                      onChange={() => setFormData({ ...formData, status: 'Active' })}
                      className="h-4 w-4 cursor-pointer border-slate-300 text-amber-500 focus:ring-amber-500 disabled:cursor-not-allowed"
                    />
                    Active
                  </label>
                  <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                    <input
                      type="radio"
                      name="status"
                      value="Suspended"
                      checked={formData.status === 'Suspended'}
                      disabled={formData.authUserId === loggedInUserId}
                      onChange={() => setFormData({ ...formData, status: 'Suspended' })}
                      className="h-4 w-4 cursor-pointer border-slate-300 text-rose-500 focus:ring-rose-500 disabled:cursor-not-allowed"
                    />
                    Suspended
                  </label>
                </div>
              </FormField>
            </div>

            <FormField label="Internal Notes / Biography (Optional)" htmlFor="notes">
              <textarea
                id="notes"
                rows={4}
                placeholder="Notes about working shifts, trainer specializations, or temporary permissions."
                className="textarea-field bg-white text-slate-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </FormField>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50/80 px-5 py-4 dark:border-zinc-900/70 dark:bg-zinc-950 sm:flex-row sm:justify-end sm:px-6">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary justify-center"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary min-w-[144px] justify-center"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-zinc-950" />
                  Saving...
                </>
              ) : mode === 'add' ? (
                'Create Account'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
