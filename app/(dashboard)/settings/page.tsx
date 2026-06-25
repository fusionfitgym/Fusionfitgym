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
  MessageSquare,
  Send,
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
import { sendTestSMSAction } from '@/lib/actions/sms';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Test SMS states
  const [testPhone, setTestPhone] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const { register, handleSubmit, reset } = useForm<GymSettings>();

  useEffect(() => {
    getSettings()
      .then((data) => {
        reset(data);
        if (data.gym_logo) {
          setLogoPreview(data.gym_logo);
        }
      })
      .finally(() => setLoading(false));
  }, [reset]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function handleSendTest() {
    if (!testPhone) return;
    setSendingTest(true);
    setTestResult(null);
    try {
      const result = await sendTestSMSAction(testPhone);
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Failed to send test SMS.' });
    } finally {
      setSendingTest(false);
    }
  }

  async function onSubmit(data: GymSettings) {
    setSaving(true);
    setSaved(false);
    try {
      let currentLogo = data.gym_logo;
      if (logoFile) {
        const { uploadGymLogo } = await import('@/lib/actions/settings');
        const uploadRes = await uploadGymLogo(logoFile);
        if (uploadRes.error) throw new Error(uploadRes.error);
        currentLogo = uploadRes.url;
      }
      await upsertSettings({ ...data, gym_logo: currentLogo });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save settings');
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
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* Logo Upload Container */}
            <div className="flex flex-col items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Gym Logo</span>
              <div className="relative group h-28 w-28 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm flex items-center justify-center">
                {logoPreview ? (
                  <img src={logoPreview} alt="Gym Logo" className="h-full w-full object-contain p-1" />
                ) : (
                  <Building2 className="h-10 w-10 text-slate-300" />
                )}
                <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs font-semibold cursor-pointer transition-opacity duration-200 rounded-xl">
                  <span>Choose file</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/gif, image/webp"
                    className="sr-only"
                    onChange={handleLogoChange}
                  />
                </label>
              </div>
              <p className="text-[10px] text-slate-400">PNG, JPG up to 5MB</p>
            </div>

            {/* Existing Fields */}
            <div className="flex-1 field-grid field-grid-2">
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

        <SectionCard
          title="SMS Automation Settings"
          description="Enable or disable automatic SMS notifications dispatched via the gym's connected Android phone."
          icon={<MessageSquare className="h-5 w-5" />}
        >
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <input
              id="sms_enabled"
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
              {...register('sms_enabled')}
            />
            <div className="flex flex-col">
              <label htmlFor="sms_enabled" className="text-sm font-semibold text-slate-800 cursor-pointer">
                Enable SMS Communication System
              </label>
              <span className="text-xs text-slate-500">Enable or disable all outgoing SMS communication.</span>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Automatic SMS Triggers</h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[
                { name: 'sms_automation_new_member' as const, label: 'New member registration', desc: 'Welcome SMS when a new member is added' },
                { name: 'sms_automation_expires_7' as const, label: 'Membership expires in 7 days', desc: 'Pre-expiry warning 7 days before end date' },
                { name: 'sms_automation_expires_3' as const, label: 'Membership expires in 3 days', desc: 'Pre-expiry warning 3 days before end date' },
                { name: 'sms_automation_expires_today' as const, label: 'Membership expires today', desc: 'Reminder sent on the day of expiry' },
                { name: 'sms_automation_expired' as const, label: 'Membership expired', desc: 'Alert sent when membership status becomes Expired' },
                { name: 'sms_automation_invoice' as const, label: 'Invoice generated', desc: 'Sent when an invoice is created' },
                { name: 'sms_automation_payment' as const, label: 'Payment reminder', desc: 'Manual or automated invoice payment reminder' },
              ].map(({ name, label, desc }) => (
                <div key={name} className="flex items-start gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm hover:border-slate-200 transition-colors">
                  <input
                    id={name}
                    type="checkbox"
                    className="mt-0.5 h-4.5 w-4.5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
                    {...register(name)}
                  />
                  <div className="flex flex-col">
                    <label htmlFor={name} className="text-sm font-semibold text-slate-800 cursor-pointer">
                      {label}
                    </label>
                    <span className="text-xs text-slate-500 mt-0.5">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
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
