'use client';

import { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle,
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import {
  FormActions,
  FormField,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { getSettings, upsertSettings } from '@/lib/actions/settings';
import { GymSettings } from '@/types';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<GymSettings>();

  useEffect(() => {
    getSettings()
      .then(reset)
      .finally(() => setLoading(false));
  }, [reset]);

  async function onSubmit(data: GymSettings) {
    setSaving(true);
    setSaved(false);
    try {
      await upsertSettings(data);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingSpinner />;

  return (
    <div className="page-narrow page-enter">
      <PageHeader
        title="Settings"
        subtitle="Keep gym contact details and membership pricing up to date."
      />

      <form onSubmit={handleSubmit(onSubmit)} className="page-stack">
        <SectionCard
          title="Gym information"
          description="These details appear on generated invoices and documents."
          icon={<Building2 className="h-5 w-5" />}
        >
          <div className="field-grid field-grid-2">
            {[
              { name: 'gym_name' as const, label: 'Gym name', icon: Building2, placeholder: 'FusionFit Gym' },
              { name: 'gym_phone' as const, label: 'Phone', icon: Phone, placeholder: '+91 98765 43210' },
              { name: 'gym_email' as const, label: 'Email', icon: Mail, placeholder: 'info@fusionfitgym.com' },
              { name: 'gym_address' as const, label: 'Address', icon: MapPin, placeholder: 'Street, city, state' },
            ].map(({ name, label, icon: Icon, placeholder }) => (
              <FormField key={name} label={label} htmlFor={name}>
                <div className="input-with-icon">
                  <Icon />
                  <input
                    id={name}
                    type={name === 'gym_email' ? 'email' : 'text'}
                    placeholder={placeholder}
                    className="input-field"
                    {...register(name)}
                  />
                </div>
              </FormField>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Membership pricing"
          description="Set the default amount used when creating invoices."
          icon={<CreditCard className="h-5 w-5" />}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { name: 'plan_monthly' as const, label: 'Monthly', period: '1 month' },
              { name: 'plan_quarterly' as const, label: 'Quarterly', period: '3 months' },
              { name: 'plan_biannual' as const, label: 'Biannual', period: '6 months' },
              { name: 'plan_annual' as const, label: 'Annual', period: '12 months' },
            ].map(({ name, label, period }) => (
              <div key={name} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  <span className="text-xs text-slate-500">{period}</span>
                </div>
                <FormField label="Price (INR)" htmlFor={name}>
                  <input id={name} type="number" min="0" className="input-field" {...register(name)} />
                </FormField>
              </div>
            ))}
          </div>
        </SectionCard>

        <FormActions sticky>
          {saved && (
            <span className="flex items-center justify-center gap-2 text-sm font-semibold text-emerald-700 sm:mr-auto">
              <CheckCircle className="h-4 w-4" /> Settings saved
            </span>
          )}
          <button type="submit" disabled={saving} className="btn btn-primary w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? 'Saving...' : 'Save settings'}
          </button>
        </FormActions>
      </form>
    </div>
  );
}
