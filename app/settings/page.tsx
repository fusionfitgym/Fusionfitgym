'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Save, Loader2, Building2, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { PageHeader, Card, LoadingSpinner } from '@/components/ui/Primitives';
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
    <div className="page-enter max-w-2xl mx-auto">
      <PageHeader
        title="Settings"
        subtitle="Configure your gym information and pricing"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Gym Info */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#FFD700]" /> Gym Information
          </h3>
          <div className="space-y-4">
            {[
              { name: 'gym_name'    as const, label: 'Gym Name',    icon: Building2, placeholder: 'FusionFit Gym'              },
              { name: 'gym_phone'   as const, label: 'Phone',       icon: Phone,     placeholder: '+91 98765 43210'             },
              { name: 'gym_email'   as const, label: 'Email',       icon: Mail,      placeholder: 'info@fusionfitgym.com'       },
              { name: 'gym_address' as const, label: 'Address',     icon: MapPin,    placeholder: '123 Fitness Street, City'    },
            ].map(({ name, label, icon: Icon, placeholder }) => (
              <div key={name} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-[#FFD700]" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">{label}</label>
                  <input
                    {...register(name)}
                    type="text"
                    placeholder={placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Pricing */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-[#FFD700]" /> Membership Pricing (₹)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { name: 'plan_monthly'    as const, label: 'Monthly',    period: '1 month'  },
              { name: 'plan_quarterly'  as const, label: 'Quarterly',  period: '3 months' },
              { name: 'plan_biannual'   as const, label: 'Biannual',   period: '6 months' },
              { name: 'plan_annual'     as const, label: 'Annual',     period: '12 months'},
            ].map(({ name, label, period }) => (
              <div key={name} className="p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-700">{label}</p>
                  <p className="text-xs text-gray-400">{period}</p>
                </div>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">₹</span>
                  <input
                    {...register(name)}
                    type="number"
                    className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm font-semibold bg-white"
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <button type="submit" disabled={saving} className="btn-yellow">
            {saving ? <Loader2 className="w-4 h-4 spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          {saved && (
            <span className="text-sm font-medium text-green-600 flex items-center gap-1.5">
              ✅ Settings saved successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
