'use client';

import React, { useState } from 'react';
import { Calendar, Snowflake, X, Loader2, Info, AlertTriangle } from 'lucide-react';
import { Member } from '@/types';
import { freezeMember, unfreezeMember } from '@/lib/actions/members';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

interface FreezeModalProps {
  member: Member | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const PRESET_DURATIONS = [
  { label: '7 Days', days: 7 },
  { label: '15 Days', days: 15 },
  { label: '30 Days', days: 30 },
  { label: 'Custom', days: 0 },
];

export function FreezeModal({ member, isOpen, onClose, onSuccess }: FreezeModalProps) {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [selectedPreset, setSelectedPreset] = useState<number>(7);
  const [customDays, setCustomDays] = useState<string>('7');
  const [reason, setReason] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !member) return null;

  const isCurrentlyFrozen = member.status === 'Frozen' || member.is_frozen;

  const freezeDays = selectedPreset === 0 ? parseInt(customDays, 10) || 0 : selectedPreset;

  // Calculate extended date preview
  const currentExpiry = member.package_end_date ? new Date(member.package_end_date) : new Date();
  const extendedExpiry = new Date(currentExpiry.getTime());
  if (!isNaN(extendedExpiry.getTime()) && freezeDays > 0) {
    extendedExpiry.setDate(extendedExpiry.getDate() + freezeDays);
  }

  async function handleFreezeSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!member) return;

    if (freezeDays <= 0) {
      setError('Please enter a valid number of freeze days (greater than 0).');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      if (isDemo) {
        const res = demo.freezeMember(member.id, freezeDays, reason);
        if (res.error) {
          setError(res.error);
        } else {
          toast.success(`Member frozen for ${freezeDays} days (Demo Mode)`);
          onSuccess?.();
          onClose();
        }
        return;
      }

      const result = await freezeMember(member.id, freezeDays, reason);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(`Successfully frozen ${member.full_name} for ${freezeDays} days!`);
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to freeze member.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUnfreezeSubmit() {
    if (!member) return;

    setError(null);
    setSubmitting(true);

    try {
      if (isDemo) {
        const res = demo.unfreezeMember(member.id);
        if (res.error) {
          setError(res.error);
        } else {
          toast.success('Member unfrozen (Demo Mode)');
          onSuccess?.();
          onClose();
        }
        return;
      }

      const result = await unfreezeMember(member.id);
      if (result.error) {
        setError(result.error);
      } else {
        toast.success(`Successfully unfrozen ${member.full_name}!`);
        onSuccess?.();
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unfreeze member.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-lg overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-blue-50/50 to-cyan-50/50 dark:from-slate-800/50 dark:to-slate-900">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400">
              <Snowflake className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {isCurrentlyFrozen ? 'Unfreeze Member Account' : 'Freeze Member Package'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {member.full_name} • {member.package_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        {isCurrentlyFrozen ? (
          <div className="p-6 space-y-5">
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-800/60">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-sm text-blue-900 dark:text-blue-200">
                  <p className="font-semibold">This member is currently frozen</p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Unfreezing will restore member status to <strong className="font-semibold">Active</strong> and re-enable biometric access hardware sync.
                  </p>
                  {member.freeze_reason && (
                    <p className="text-xs italic mt-2">
                      Reason recorded: &ldquo;{member.freeze_reason}&rdquo;
                    </p>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUnfreezeSubmit}
                disabled={submitting}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Unfreeze Member
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFreezeSubmit} className="p-6 space-y-5">
            {/* Duration Selector */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Select Freeze Duration
              </label>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_DURATIONS.map((preset) => {
                  const isActive = selectedPreset === preset.days;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setSelectedPreset(preset.days);
                        if (preset.days > 0) setCustomDays(preset.days.toString());
                      }}
                      className={`py-2 px-3 text-xs font-medium rounded-lg border transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Days Input */}
            {selectedPreset === 0 && (
              <div>
                <label htmlFor="customDays" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Number of Days to Freeze
                </label>
                <input
                  id="customDays"
                  type="number"
                  min="1"
                  max="365"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="input-field"
                  placeholder="Enter days (e.g. 10)"
                  required
                />
              </div>
            )}

            {/* Live Calculation Preview */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Current Package Expiry:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {formatDate(member.package_end_date)}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                <span className="font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Extended Package Expiry:
                </span>
                <span className="font-bold text-blue-700 dark:text-blue-300 text-sm">
                  {freezeDays > 0 ? formatDate(extendedExpiry.toISOString()) : '—'}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 pt-1">
                ⚡ Active invoice expiry and due dates will also be automatically extended by <strong className="text-slate-700 dark:text-slate-300">{freezeDays} day{freezeDays === 1 ? '' : 's'}</strong>.
              </div>
            </div>

            {/* Reason Input */}
            <div>
              <label htmlFor="freezeReason" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Freeze Reason <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                id="freezeReason"
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="input-field"
                placeholder="e.g. Medical injury, vacation travel, personal break"
              />
            </div>

            {/* Biometric Warning */}
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/70 dark:border-amber-800/70 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-semibold block">Biometric Hardware Restricted</span>
                <span>Member biometric entry check-in will be automatically set to disabled during the frozen period.</span>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs font-medium border border-red-200 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || freezeDays <= 0}
                className="btn btn-primary bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Snowflake className="h-4 w-4" />}
                Freeze Member ({freezeDays} Days)
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
