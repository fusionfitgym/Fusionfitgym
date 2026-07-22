'use client';

import { useState, useEffect } from 'react';
import { X, RefreshCw, Calculator, CreditCard, Calendar, User, FileText, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Member, GymSettings } from '@/types';
import { getBaseMembershipFee } from '@/lib/pricing';
import { renewMembership } from '@/lib/actions/renewals';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RenewalModalProps {
  member: Member;
  settings?: GymSettings;
  isDemo?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RenewalModal({
  member,
  settings,
  isDemo = false,
  isOpen,
  onClose,
  onSuccess
}: RenewalModalProps) {
  const demo = useDemoState();

  // Helper to add days or months to date
  function calculateEndDate(startDateStr: string, durationStr: string): string {
    if (!startDateStr) return '';
    const d = new Date(startDateStr);
    if (isNaN(d.getTime())) return '';

    const dur = durationStr.toLowerCase().trim();
    if (dur.includes('daily')) {
      return startDateStr; // Same day or no expiry
    }
    if (dur.includes('1 month') || dur === '30 days' || dur === '30') {
      d.setMonth(d.getMonth() + 1);
    } else if (dur.includes('3 months') || dur === '90 days' || dur === '90') {
      d.setMonth(d.getMonth() + 3);
    } else if (dur.includes('6 months') || dur === '180 days' || dur === '180') {
      d.setMonth(d.getMonth() + 6);
    } else if (dur.includes('annual') || dur.includes('1 year') || dur === '365 days' || dur === '365') {
      d.setFullYear(d.getFullYear() + 1);
    } else {
      const match = dur.match(/\d+/);
      const days = match ? parseInt(match[0], 10) : 30;
      d.setDate(d.getDate() + days);
    }

    return d.toISOString().split('T')[0];
  }

  // Calculate default start date: if current package end date is in the future, start day after previous end date; else today
  const getDefaultStartDate = (): string => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (member.package_end_date && member.package_end_date >= todayStr) {
      const prevEnd = new Date(member.package_end_date);
      prevEnd.setDate(prevEnd.getDate() + 1);
      return prevEnd.toISOString().split('T')[0];
    }
    return todayStr;
  };

  const initialStartDate = getDefaultStartDate();
  const initialPackage = member.package_name || '1 Month';
  const initialDuration = member.duration || member.package_duration || '1 Month';
  const initialTrainingType = member.training_type || 'Weight Training Only';
  const initialEndDate = calculateEndDate(initialStartDate, initialDuration);

  // Form State
  const [packageName, setPackageName] = useState(initialPackage);
  const [duration, setDuration] = useState(initialDuration);
  const [trainingType, setTrainingType] = useState<'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training'>(initialTrainingType);
  const [startDate, setStartDate] = useState(initialStartDate);
  const [endDate, setEndDate] = useState(initialEndDate);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Online Payment'>('UPI');
  const [discount, setDiscount] = useState<number>(0);
  const [tax, setTax] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recalculate end date whenever start date or duration changes
  useEffect(() => {
    if (startDate && duration) {
      const newEnd = calculateEndDate(startDate, duration);
      setEndDate(newEnd);
    }
  }, [startDate, duration]);

  // Recalculate base package price
  const basePrice = getBaseMembershipFee(
    member.gender || 'Gents',
    duration,
    trainingType,
    settings
  );

  const discountVal = Number(discount) || 0;
  const taxVal = Number(tax) || 0;
  const finalAmount = Math.max(0, basePrice - discountVal + taxVal);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    try {
      if (isDemo) {
        const res = demo.renewMember({
          memberId: member.id,
          packageName,
          duration,
          trainingType,
          startDate,
          endDate,
          paymentMethod,
          packagePrice: basePrice,
          discount: discountVal,
          tax: taxVal,
          finalAmount,
          notes,
        });

        if (res.success) {
          toast.success(
            <div>
              <p className="font-bold text-slate-900">Membership renewed successfully.</p>
              <p className="text-xs text-slate-600">Invoice #{res.invoiceNumber} generated.</p>
            </div>
          );
          onSuccess?.();
          onClose();
        } else {
          setErrorMsg(res.error || 'Failed to renew membership in demo mode.');
        }
        return;
      }

      const res = await renewMembership({
        memberId: member.id,
        packageName,
        duration,
        trainingType,
        startDate,
        endDate,
        paymentMethod,
        packagePrice: basePrice,
        discount: discountVal,
        tax: taxVal,
        finalAmount,
        notes,
      });

      if (res.success) {
        toast.success(
          <div>
            <p className="font-bold text-slate-900">Membership renewed successfully.</p>
            <p className="text-xs text-slate-600">Invoice #{res.invoiceNumber} generated.</p>
          </div>
        );
        onSuccess?.();
        onClose();
      } else {
        setErrorMsg(res.error || 'Failed to renew membership.');
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'An unexpected error occurred during renewal.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="alert-dialog-overlay flex items-center justify-center p-4 z-50">
      <div className="card relative z-10 w-full max-w-2xl overflow-hidden border border-slate-200 bg-white p-6 shadow-2xl animate-dialog-in max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <RefreshCw className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Renew Membership</h2>
              <p className="text-xs text-slate-500">Extend validity and generate renewal invoice for {member.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Read Only Member Information Summary */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Member Details (Read Only)
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <span className="text-slate-400 block font-medium">Member Name</span>
                <span className="font-bold text-slate-900 truncate block">{member.full_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Biometric ID</span>
                <span className="font-mono font-bold text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200 inline-block mt-0.5">
                  {member.biometric_user_id || '—'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Phone Number</span>
                <span className="font-bold text-slate-900 truncate block">{member.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Current Status</span>
                <span className={cn(
                  "badge font-bold py-0.5 px-2 text-[10px] mt-0.5 inline-block",
                  member.status === 'Active' ? 'badge-active' :
                  member.status === 'Expired' ? 'badge-expired' : 'badge-inactive'
                )}>
                  {member.status}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Current Package</span>
                <span className="font-semibold text-slate-800 block">{member.package_name || 'Standard'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Previous Start</span>
                <span className="font-medium text-slate-700 block">{member.package_start_date ? formatDate(member.package_start_date) : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Previous End Date</span>
                <span className="font-medium text-slate-700 block">{member.package_end_date ? formatDate(member.package_end_date) : '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Assigned Machine</span>
                <span className="font-semibold text-slate-800 block">{member.machine_type || 'Gents'} Machine</span>
              </div>
            </div>
          </div>

          {/* Renewal Inputs */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Renewal Package & Dates
            </h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="field-label required-mark" htmlFor="renewal_package">Package Duration</label>
                <select
                  id="renewal_package"
                  value={duration}
                  onChange={(e) => {
                    const dur = e.target.value;
                    setDuration(dur);
                    setPackageName(dur);
                  }}
                  className="select-field"
                  required
                >
                  <option value="1 Month">1 Month</option>
                  <option value="3 Months">3 Months</option>
                  <option value="6 Months">6 Months</option>
                  <option value="Annual">Annual (1 Year)</option>
                  <option value="Cardio">Cardio (1 Month)</option>
                  <option value="Daily Pass">Daily Pass</option>
                </select>
              </div>

              <div>
                <label className="field-label required-mark" htmlFor="renewal_training">Training Type</label>
                <select
                  id="renewal_training"
                  value={trainingType}
                  onChange={(e) => setTrainingType(e.target.value as any)}
                  className="select-field"
                  required
                >
                  <option value="Weight Training Only">Weight Training Only</option>
                  <option value="Weight Training + Cardio">Weight Training + Cardio</option>
                  <option value="Weight Training + Strength Training">Weight Training + Strength Training</option>
                </select>
              </div>

              <div>
                <label className="field-label required-mark" htmlFor="renewal_payment">Payment Method</label>
                <select
                  id="renewal_payment"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="select-field"
                  required
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Online Payment">Online Payment</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label required-mark" htmlFor="renewal_start">Renewal Start Date</label>
                <input
                  type="date"
                  id="renewal_start"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="field-label required-mark" htmlFor="renewal_end">New Expiry Date</label>
                <input
                  type="date"
                  id="renewal_end"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-field font-semibold text-amber-700 bg-amber-50/50"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="renewal_discount">Discount (₹)</label>
                <input
                  type="number"
                  id="renewal_discount"
                  min="0"
                  value={discount || ''}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder="0"
                  className="input-field"
                />
              </div>

              <div>
                <label className="field-label" htmlFor="renewal_tax">Tax / GST (₹)</label>
                <input
                  type="number"
                  id="renewal_tax"
                  min="0"
                  value={tax || ''}
                  onChange={(e) => setTax(Number(e.target.value))}
                  placeholder="0"
                  className="input-field"
                />
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="renewal_notes">Notes (Optional)</label>
              <textarea
                id="renewal_notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Special renewal offer applied..."
                className="input-field min-h-16 resize-y"
              />
            </div>
          </div>

          {/* Pricing Auto-Calculation Summary */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-slate-800">
            <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <Calculator className="h-4 w-4 text-amber-600" />
              Auto Calculated Pricing Summary
            </h4>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Base Package Fee ({packageName}):</span>
                <span className="font-semibold text-slate-900">₹{basePrice.toLocaleString('en-IN')}</span>
              </div>
              {discountVal > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount Applied:</span>
                  <span className="font-semibold">- ₹{discountVal.toLocaleString('en-IN')}</span>
                </div>
              )}
              {taxVal > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Tax / GST:</span>
                  <span className="font-semibold">+ ₹{taxVal.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-amber-200/80 pt-2 text-sm font-bold text-slate-950">
                <span>Final Payable Amount:</span>
                <span className="text-amber-700 text-base">₹{finalAmount.toLocaleString('en-IN')}</span>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Generating Renewal...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Generate Renewal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
