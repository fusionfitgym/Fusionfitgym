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
  Database,
  Download,
  Upload,
  RefreshCw,
  Trash2,
  FileCode,
  ShieldAlert,
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Logo upload states
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const { register, handleSubmit, reset } = useForm<GymSettings>();

  useEffect(() => {
    if (isDemo) {
      if (demo.settings) {
        reset(demo.settings as any);
        if (demo.settings.gym_logo) {
          setLogoPreview(demo.settings.gym_logo);
        }
      }
      setLoading(false);
      return;
    }
    getSettings()
      .then((data) => {
        reset(data);
        if (data.gym_logo) {
          setLogoPreview(data.gym_logo);
        }
      })
      .finally(() => setLoading(false));
  }, [reset, isDemo, demo.settings]);

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  }

  async function onSubmit(data: GymSettings) {
    setSaving(true);
    setSaved(false);
    if (isDemo) {
      setTimeout(() => {
        demo.saveSettings({ ...data, gym_logo: logoPreview });
        setSaved(true);
        toast.success('Settings saved successfully (Demo Mode)');
        window.setTimeout(() => setSaved(false), 3000);
        setSaving(false);
      }, 400);
      return;
    }
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
          title="Invoice & Billing Settings"
          description="Configure dynamic invoice generation prefix, starting sequence, taxes, currency, terms and automation."
          icon={<CreditCard className="h-5 w-5" />}
        >
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <input
              id="invoice_auto_generation"
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-amber-500 focus:ring-amber-500 cursor-pointer"
              {...register('invoice_auto_generation')}
            />
            <div className="flex flex-col">
              <label htmlFor="invoice_auto_generation" className="text-sm font-semibold text-slate-800 cursor-pointer">
                Enable Automatic Invoice Generation
              </label>
              <span className="text-xs text-slate-500">Automatically generate a unique invoice when a member is created or renewed.</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Invoice Prefix" htmlFor="invoice_prefix">
              <input
                id="invoice_prefix"
                type="text"
                placeholder="INV"
                className="input-field"
                {...register('invoice_prefix')}
              />
            </FormField>

            <FormField label="Starting Invoice Number" htmlFor="invoice_starting_number">
              <input
                id="invoice_starting_number"
                type="number"
                min="1"
                placeholder="1001"
                className="input-field"
                {...register('invoice_starting_number')}
              />
            </FormField>

            <FormField label="GST % (Taxes)" htmlFor="invoice_gst_percent">
              <input
                id="invoice_gst_percent"
                type="number"
                min="0"
                placeholder="18"
                className="input-field"
                {...register('invoice_gst_percent')}
              />
            </FormField>

            <FormField label="Currency Symbol" htmlFor="invoice_currency">
              <input
                id="invoice_currency"
                type="text"
                placeholder="₹"
                className="input-field"
                {...register('invoice_currency')}
              />
            </FormField>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4">
            <FormField label="Invoice Footer Message" htmlFor="invoice_footer">
              <input
                id="invoice_footer"
                type="text"
                placeholder="Thank you for your business!"
                className="input-field"
                {...register('invoice_footer')}
              />
            </FormField>

            <FormField label="Terms & Conditions" htmlFor="invoice_terms">
              <textarea
                id="invoice_terms"
                placeholder="Terms & Conditions apply. Fees once paid are non-refundable."
                rows={3}
                className="input-field py-2"
                {...register('invoice_terms')}
              />
            </FormField>
          </div>
        </SectionCard>

        <SectionCard
          title="SMS Automation Settings"
          description="Configure when the ERP automatically creates pending SMS notifications for staff to send via the device SMS app."
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
              <span className="text-xs text-slate-500">When enabled, the system queues SMS notifications for manual dispatch.</span>
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

        {/* Database Administration Section */}
        <SectionCard
          title="Database Administration"
          description="Manage system backups, export raw SQL snapshots, or reset production data."
        >
          {isDemo && (
            <div className="mb-4 rounded-xl border border-amber-300/40 bg-amber-50/60 p-3.5 text-xs text-amber-800 flex items-center gap-2.5">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>Demo Mode Protection:</strong> Database administration and backup operations are locked during public demonstration.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                if (isDemo) {
                  toast.error('System & Database administration features are locked in Demo Mode.');
                  return;
                }
                toast.info('Initiating database backup...');
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-900">Backup Database</span>
                <span className="block text-xs text-slate-500 mt-0.5">Create a full archive of all records</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDemo) {
                  toast.error('System & Database administration features are locked in Demo Mode.');
                  return;
                }
                toast.info('Select a backup file to restore...');
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
                <Upload className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-900">Restore Backup</span>
                <span className="block text-xs text-slate-500 mt-0.5">Restore system state from archive</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDemo) {
                  toast.error('System & Database administration features are locked in Demo Mode.');
                  return;
                }
                toast.info('Generating SQL export...');
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-xs transition-all hover:border-slate-300 hover:bg-slate-50 cursor-pointer group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 group-hover:scale-105 transition-transform">
                <FileCode className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-slate-900">Export SQL Dump</span>
                <span className="block text-xs text-slate-500 mt-0.5">Download raw SQL schema and data</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                if (isDemo) {
                  toast.error('System & Database administration features are locked in Demo Mode.');
                  return;
                }
                if (window.confirm('Are you sure you want to erase all data and reset database?')) {
                  toast.error('Database reset requested.');
                }
              }}
              className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/40 p-4 text-left shadow-xs transition-all hover:border-red-200 hover:bg-red-50 cursor-pointer group"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 group-hover:scale-105 transition-transform">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-sm font-bold text-red-900">Reset Database</span>
                <span className="block text-xs text-red-600 mt-0.5">Wipe all records and reset tables</span>
              </div>
            </button>
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
