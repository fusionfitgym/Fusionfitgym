'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Loader2, Building2, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, LoadingSpinner } from '@/components/ui/Primitives';
import { getSettings, upsertSettings } from '@/lib/actions/settings';
import { GymSettings } from '@/types';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { register, handleSubmit, reset } = useForm<GymSettings>();

  useEffect(() => {
    getSettings().then(s => { reset(s); }).finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: GymSettings) {
    setSaving(true);
    try {
      await upsertSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner size={36} />;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto"
    >
      <PageHeader
        title="Settings"
        subtitle="Configure your gym information and pricing"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Gym Info */}
        <div className="card p-6 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-section-title text-lg">Gym Information</h3>
              <p className="text-sm text-slate-400 mt-0.5">Your gym's basic details</p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6 space-y-5">
            {[
              { name: 'gym_name'    as const, label: 'Gym Name',    icon: Building2, placeholder: 'FusionFit Gym'              },
              { name: 'gym_phone'   as const, label: 'Phone',       icon: Phone,     placeholder: '+91 98765 43210'             },
              { name: 'gym_email'   as const, label: 'Email',       icon: Mail,      placeholder: 'info@fusionfitgym.com'       },
              { name: 'gym_address' as const, label: 'Address',     icon: MapPin,    placeholder: '123 Fitness Street, City'    },
            ].map(({ name, label, icon: Icon, placeholder }) => (
              <div key={name} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0 mt-7">
                  <Icon className="w-[18px] h-[18px] text-amber-500" />
                </div>
                <div className="flex-1">
                  <label className="text-label block mb-2">{label}</label>
                  <input
                    {...register(name)}
                    type="text"
                    placeholder={placeholder}
                    className="input-field"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing */}
        <div className="card p-6 mb-6">
          <div className="mb-4 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="text-section-title text-lg">Membership Pricing (₹)</h3>
              <p className="text-sm text-slate-400 mt-0.5">Set prices for each plan</p>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                { name: 'plan_monthly'    as const, label: 'Monthly',    period: '1 month'  },
                { name: 'plan_quarterly'  as const, label: 'Quarterly',  period: '3 months' },
                { name: 'plan_biannual'   as const, label: 'Biannual',   period: '6 months' },
                { name: 'plan_annual'     as const, label: 'Annual',     period: '12 months'},
              ].map(({ name, label, period }) => (
                <div key={name} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-400">{period}</p>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">₹</span>
                    <input
                      {...register(name)}
                      type="number"
                      className="input-field pl-7"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 -mx-4 md:-mx-6 lg:-mx-8 px-4 md:px-6 lg:px-8 py-4 bg-[#F8FAFC]/80 backdrop-blur-lg border-t border-slate-200 z-10">
          <div className="flex items-center gap-4 justify-end max-w-3xl mx-auto">
            {saved && (
              <span className="text-sm font-medium text-emerald-600 flex items-center gap-1.5">
                ✅ Settings saved successfully!
              </span>
            )}
            <button type="submit" disabled={saving} className="btn-gold-gradient">
              {saving ? <Loader2 className="w-5 h-5 spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
