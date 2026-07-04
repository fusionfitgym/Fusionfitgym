'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  Printer,
  Share2,
  Trash2,
  DollarSign,
  Send,
  Plus,
  MessageSquare
} from 'lucide-react';
import {
  Breadcrumb,
  FormField,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { SmsSendButton } from '@/components/ui/SmsSendButton';
import { 
  getInvoiceById, 
  updateInvoiceStatus, 
  ensureInvoiceToken,
  duplicateInvoice,
  cancelInvoice,
  recordAdditionalPayment,
  sendManualInvoiceSMS
} from '@/lib/actions/invoices';
import { getSettings } from '@/lib/actions/settings';
import { GymSettings, Invoice, INVOICE_STATUSES } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { buildInvoiceMessage } from '@/lib/native-sms';
import { buildInvoicePublicUrl } from '@/lib/invoice-links';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [settings, setSettings] = useState<GymSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [invoiceLink, setInvoiceLink] = useState('');

  // Payment Recording States
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [transactionId, setTransactionId] = useState('');
  const [recordingPayment, setRecordingPayment] = useState(false);

  // Invoice Action States
  const [duplicating, setDuplicating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [sendingSMS, setSendingSMS] = useState(false);

  useEffect(() => {
    if (isDemo) {
      const inv = demo.invoices.find((i) => i.id === id);
      setInvoice(inv || null);
      if (inv) {
        setPaymentAmount(inv.balance_due !== undefined ? inv.balance_due : (inv.amount - (inv.paid_amount || 0)));
      }
      setSettings(demo.settings);
      setLoading(false);
      return;
    }
    Promise.all([getInvoiceById(id), getSettings()])
      .then(async ([invoiceData, settingsData]) => {
        setInvoice(invoiceData);
        setSettings(settingsData);
        if (invoiceData) {
          const token = invoiceData.invoice_token || (await ensureInvoiceToken(invoiceData.id));
          setInvoiceLink(buildInvoicePublicUrl(token));
          setPaymentAmount(invoiceData.balance_due !== undefined ? invoiceData.balance_due : (invoiceData.amount - (invoiceData.paid_amount || 0)));
        }
      })
      .finally(() => setLoading(false));
  }, [id, isDemo, demo.invoices, demo.settings]);

  const member = invoice?.member as {
    full_name: string;
    phone?: string;
    email?: string;
    address?: string;
    package_name?: string;
    package_duration?: string;
    package_price?: number;
    package_start_date?: string;
    package_end_date?: string;
  } | undefined;

  async function handleStatusChange(status: Invoice['status']) {
    if (!invoice) return;
    setUpdating(true);
    if (isDemo) {
      setTimeout(() => {
        demo.updateInvoiceStatus(id, status);
        setInvoice((current) => {
          if (!current) return null;
          let paid_amount = current.paid_amount;
          let balance_due = current.balance_due;
          if (status === 'Paid') {
            paid_amount = current.amount;
            balance_due = 0;
          } else if (status === 'Pending' || status === 'Unpaid') {
            paid_amount = 0;
            balance_due = current.amount;
          } else if (status === 'Cancelled') {
            balance_due = 0;
          }
          return { ...current, status, paid_amount, balance_due };
        });
        setUpdating(false);
        toast.success(`Invoice status updated to ${status} (Demo Mode)`);
      }, 300);
      return;
    }
    try {
      await updateInvoiceStatus(id, status);
      const updated = await getInvoiceById(id);
      if (updated) {
        setInvoice(updated);
        setPaymentAmount(updated.balance_due !== undefined ? updated.balance_due : (updated.amount - (updated.paid_amount || 0)));
      }
    } finally {
      setUpdating(false);
    }
  }

  async function handleDownloadPDF() {
    if (!invoice || !settings) return;
    setDownloading(true);
    try {
      const { generateInvoicePDF } = await import('@/lib/pdf/generateInvoice');
      await generateInvoicePDF(invoice, settings);
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      alert('Error generating PDF: ' + (err?.message || String(err)));
    } finally {
      setDownloading(false);
    }
  }

  const handleWhatsAppShare = () => {
    if (!invoice || !member) return;
    const phone = member.phone || '';
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const currencySym = settings?.invoice_currency || '₹';
    const text = `Hi ${member.full_name},\n\nHere is your invoice ${invoice.invoice_number} from ${settings?.gym_name || 'Fusion Fit'}.\nAmount: ${currencySym}${invoice.amount}\nDue Date: ${formatDate(invoice.due_date)}\n\nLink to view: ${invoiceLink || 'N/A'}\n\nThank you!`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleEmailShare = () => {
    if (!invoice || !member) return;
    const email = member.email || '';
    const subject = `Invoice ${invoice.invoice_number} - ${settings?.gym_name || 'Fusion Fit'}`;
    const currencySym = settings?.invoice_currency || '₹';
    const body = `Hi ${member.full_name},\n\nHere is your invoice details:\nInvoice Number: ${invoice.invoice_number}\nAmount: ${currencySym}${invoice.amount}\nDue Date: ${formatDate(invoice.due_date)}\n\nLink to view invoice online: ${invoiceLink || 'N/A'}\n\nThank you for your business!\n\nBest regards,\n${settings?.gym_name || 'Fusion Fit Team'}`;
    const url = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  const handleSendSMS = async () => {
    if (!invoice || !member) return;
    if (!member.phone) {
      toast.error('Member phone number is missing');
      return;
    }
    setSendingSMS(true);
    try {
      if (isDemo) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        toast.success('Invoice SMS sent successfully (Demo Mode)');
      } else {
        const res = await sendManualInvoiceSMS(invoice.id);
        if (res.success) {
          toast.success('Invoice SMS sent successfully');
        } else {
          toast.error(res.error || 'Failed to send SMS');
        }
      }
    } catch (err: any) {
      console.error('Error sending SMS:', err);
      toast.error(err?.message || 'Failed to send SMS');
    } finally {
      setSendingSMS(false);
    }
  };

  const handleDuplicate = async () => {
    if (!confirm('Are you sure you want to duplicate this invoice?')) return;
    setDuplicating(true);
    if (isDemo) {
      setTimeout(() => {
        const res = demo.duplicateInvoice(id);
        if (res.data) {
          toast.success('Invoice duplicated (Demo Mode)');
          router.push(`/invoices/${res.data.id}`);
        } else {
          toast.error(res.error || 'Failed to duplicate');
        }
        setDuplicating(false);
      }, 300);
      return;
    }
    try {
      const res = await duplicateInvoice(id);
      if (res.error || !res.data) throw new Error(res.error || 'Failed to duplicate invoice');
      toast.success('Invoice duplicated successfully!');
      router.push(`/invoices/${res.data.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to duplicate invoice');
      setDuplicating(false);
    }
  };

  const handleCancel = async () => {
    if (!confirm('Are you sure you want to cancel this invoice?')) return;
    setCancelling(true);
    if (isDemo) {
      setTimeout(() => {
        demo.cancelInvoice(id);
        setInvoice(current => current ? { ...current, status: 'Cancelled', balance_due: 0 } : null);
        setCancelling(false);
        toast.success('Invoice cancelled (Demo Mode)');
      }, 300);
      return;
    }
    try {
      const res = await cancelInvoice(id);
      if (res.error) throw new Error(res.error);
      toast.success('Invoice cancelled successfully!');
      const updatedInvoice = await getInvoiceById(id);
      if (updatedInvoice) setInvoice(updatedInvoice);
    } catch (err: any) {
      toast.error(err.message || 'Failed to cancel invoice');
    } finally {
      setCancelling(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentAmount <= 0) {
      toast.error('Payment amount must be greater than 0');
      return;
    }
    setRecordingPayment(true);
    if (isDemo) {
      setTimeout(() => {
        demo.recordAdditionalPayment(id, paymentAmount, paymentMethod, transactionId);
        setInvoice(current => {
          if (!current) return null;
          const newPaid = Number(current.paid_amount || 0) + paymentAmount;
          const newBalance = Math.max(0, Number(current.amount) - newPaid);
          const status = newPaid >= current.amount ? 'Paid' : 'Partially Paid';
          return {
            ...current,
            paid_amount: newPaid,
            balance_due: newBalance,
            status,
            payment_method: paymentMethod,
            transaction_id: transactionId || current.transaction_id || null,
            payment_date: new Date().toISOString()
          };
        });
        setRecordingPayment(false);
        toast.success('Payment recorded successfully (Demo Mode)');
      }, 300);
      return;
    }
    try {
      const res = await recordAdditionalPayment(id, paymentAmount, paymentMethod, transactionId);
      if (res.error) throw new Error(res.error);
      toast.success('Payment recorded successfully!');
      const updatedInvoice = await getInvoiceById(id);
      if (updatedInvoice) {
        setInvoice(updatedInvoice);
        setPaymentAmount(updatedInvoice.balance_due !== undefined ? updatedInvoice.balance_due : (updatedInvoice.amount - (updatedInvoice.paid_amount || 0)));
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to record payment');
    } finally {
      setRecordingPayment(false);
    }
  };

  // Helper to format currency dynamically using the configured currency symbol
  const formatWithCurrency = (amount: number): string => {
    const formatted = formatCurrency(amount);
    const customSymbol = settings?.invoice_currency || '₹';
    if (customSymbol !== '₹') {
      return formatted.replace('₹', customSymbol);
    }
    return formatted;
  };

  if (loading) return <LoadingSpinner />;
  if (!invoice) return <div className="empty-state"><p className="card-title">Invoice not found</p></div>;

  const statusIcons = {
    Paid: CheckCircle,
    Pending: Clock,
    Overdue: AlertCircle,
  };

  return (
    <div className="page-medium page-enter">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-invoice-area, #print-invoice-area * {
            visibility: visible;
          }
          #print-invoice-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <Breadcrumb
        items={[
          { label: 'Invoices', href: '/invoices' },
          { label: invoice.invoice_number },
        ]}
      />
      
      <PageHeader
        title={invoice.invoice_number}
        subtitle={`Created ${formatDate(invoice.created_at)}`}
        action={
          <div className="flex flex-wrap gap-2 no-print">
            <Link href="/invoices" className="btn btn-secondary">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            
            <button
              type="button"
              onClick={() => window.print()}
              className="btn btn-secondary"
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </button>

            <button
              type="button"
              onClick={handleWhatsAppShare}
              className="btn btn-secondary text-green-700 hover:text-green-800"
            >
              <Share2 className="mr-2 h-4 w-4" />
              WhatsApp
            </button>

            <button
              type="button"
              onClick={handleEmailShare}
              className="btn btn-secondary text-blue-700 hover:text-blue-800"
            >
              <Send className="mr-2 h-4 w-4" />
              Email
            </button>

            <button
              type="button"
              onClick={handleSendSMS}
              disabled={sendingSMS}
              className="btn btn-secondary text-amber-700 hover:text-amber-800"
            >
              {sendingSMS ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              SMS
            </button>

            {invoice.status !== 'Cancelled' && (
              <button
                type="button"
                onClick={handleDuplicate}
                disabled={duplicating}
                className="btn btn-secondary"
              >
                {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                Duplicate
              </button>
            )}

            {invoice.status !== 'Cancelled' && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="btn btn-secondary hover:bg-red-50 text-red-600 hover:text-red-700 hover:border-red-300"
              >
                {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Cancel
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="btn btn-primary"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </button>
          </div>
        }
      />

      <div className="page-stack">
        {/* Redesigned Premium A4 Preview Card */}
        <section id="print-invoice-area" className="card overflow-hidden border border-slate-200 shadow-lg bg-white">
          {/* Header Block (Dark premium background) */}
          <div className="bg-[#0b0d12] p-6 text-white sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                {settings?.gym_logo ? (
                  <div className="h-16 w-16 bg-white rounded-xl overflow-hidden p-1 flex items-center justify-center shrink-0">
                    <img src={settings.gym_logo} alt="Gym Logo" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-16 w-16 bg-amber-400 rounded-xl flex items-center justify-center text-zinc-950 font-black text-2xl shrink-0">
                    💪
                  </div>
                )}
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-amber-300">{settings?.gym_name ?? 'FusionFit Gym'}</h2>
                  {settings?.gym_address && <p className="mt-1 text-xs text-zinc-400 max-w-sm">{settings.gym_address}</p>}
                  <p className="mt-1.5 text-xs text-zinc-400">
                    {[settings?.gym_phone, settings?.gym_email].filter(Boolean).join(' | ')}
                  </p>
                </div>
              </div>
              <div className="sm:text-right flex flex-col items-start sm:items-end justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Invoice Number</p>
                  <p className="mt-1 font-mono text-base font-bold text-white">{invoice.invoice_number}</p>
                </div>
                <div className="mt-3"><StatusBadge variant={invoice.status} /></div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 sm:p-8">
            {/* Customer & Billing Metadata Cards */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border-b border-slate-100 pb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Billing To</p>
                <p className="text-base font-extrabold text-slate-900">{member?.full_name ?? '-'}</p>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {member?.phone && <p>Phone: {member.phone}</p>}
                  {member?.email && <p className="break-all">Email: {member.email}</p>}
                  {member?.address && <p className="leading-relaxed">Address: {member.address}</p>}
                </div>
              </div>
              <div className="sm:text-right flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Billing Information</p>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Invoice Date:</span>
                      <span className="font-semibold text-slate-900">{formatDate(invoice.created_at)}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Plan:</span>
                      <span className="font-semibold text-slate-900">{member?.package_name ?? '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Plan Duration:</span>
                      <span className="font-semibold text-slate-900">{member?.package_duration ?? '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Membership Start:</span>
                      <span className="font-semibold text-slate-900">{formatDate(invoice.membership_start_date || member?.package_start_date)}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Membership Expiry:</span>
                      <span className="font-semibold text-slate-900">{formatDate(invoice.membership_expiry_date || member?.package_end_date)}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500">Payment Date:</span>
                      <span className="font-semibold text-slate-900">{invoice.payment_date ? formatDate(invoice.payment_date) : '—'}</span>
                    </div>
                    <div className="flex justify-between gap-4 sm:justify-end">
                      <span className="text-slate-500 font-bold text-amber-700">Next Due Date:</span>
                      <span className="font-bold text-amber-700">{formatDate(invoice.due_date)}</span>
                    </div>
                    {invoice.trainer_name && (
                      <div className="flex justify-between gap-4 sm:justify-end">
                        <span className="text-slate-500">PT Trainer:</span>
                        <span className="font-semibold text-slate-900">{invoice.trainer_name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Charges Table */}
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
              <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-[#0b0d12] px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-amber-300">
                <span>Fee Item Description</span>
                <span>Amount</span>
              </div>
              
              {/* Membership Fee */}
              {(invoice.membership_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Membership fee - {member?.package_name ?? 'Gym Membership'}</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.membership_fee || 0)}</span>
                </div>
              )}

              {/* PT Fee */}
              {(invoice.trainer_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Personal Training Fee {invoice.trainer_name ? `(${invoice.trainer_name})` : ''}</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.trainer_fee || 0)}</span>
                </div>
              )}

              {/* PAR-Q Fee */}
              {(invoice.parq_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">PAR-Q Assessment Fee</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.parq_fee || 0)}</span>
                </div>
              )}

              {/* Admission Fee */}
              {(invoice.admission_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Admission & Registration Fee</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.admission_fee || 0)}</span>
                </div>
              )}

              {/* Locker Fee */}
              {(invoice.locker_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Locker Rental Fee</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.locker_fee || 0)}</span>
                </div>
              )}

              {/* Diet Plan Fee */}
              {(invoice.diet_plan_fee || 0) > 0 && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-700 font-medium">Customized Diet & Nutrition Plan Fee</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.diet_plan_fee || 0)}</span>
                </div>
              )}

              {/* Empty state fallback if all are 0 */}
              {!(invoice.membership_fee || invoice.trainer_fee || invoice.parq_fee || invoice.admission_fee || invoice.locker_fee || invoice.diet_plan_fee) && (
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3.5 text-sm border-b border-slate-100">
                  <span className="text-slate-500 italic">No charges recorded.</span>
                  <span className="font-semibold text-slate-950">{formatWithCurrency(invoice.amount)}</span>
                </div>
              )}
            </div>

            {/* Notes & Summary Box */}
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
              <div>
                {invoice.notes && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Invoice Notes / Memo</p>
                    <p className="text-sm leading-relaxed text-slate-700">{invoice.notes}</p>
                  </div>
                )}
                {invoice.payment_method && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Payment Details</p>
                    <div className="space-y-1 text-sm text-slate-700">
                      <p><strong>Payment Method:</strong> {invoice.payment_method}</p>
                      {invoice.transaction_id && <p><strong>Transaction ID:</strong> {invoice.transaction_id}</p>}
                      {invoice.payment_date && <p><strong>Payment Date:</strong> {formatDate(invoice.payment_date)}</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end">
                <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Subtotal:</span>
                    <span className="font-bold text-slate-800">{formatWithCurrency(invoice.subtotal || invoice.amount)}</span>
                  </div>
                  {invoice.discount && invoice.discount > 0 ? (
                    <div className="flex justify-between text-sm text-emerald-700">
                      <span>Discount:</span>
                      <span>-{formatWithCurrency(invoice.discount)}</span>
                    </div>
                  ) : null}
                  {invoice.tax && invoice.tax > 0 ? (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Tax / GST:</span>
                      <span className="font-bold text-slate-800">{formatWithCurrency(invoice.tax)}</span>
                    </div>
                  ) : null}
                  <div className="border-t border-slate-200 my-2"></div>
                  <div className="flex justify-between text-base font-extrabold text-slate-900">
                    <span>Grand Total:</span>
                    <span>{formatWithCurrency(invoice.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>Paid Amount:</span>
                    <span className="font-semibold text-emerald-700">{formatWithCurrency(invoice.paid_amount || 0)}</span>
                  </div>
                  <div className="border-t border-amber-300 my-1"></div>
                  <div className="flex justify-between text-lg font-black text-amber-900 bg-amber-100/50 p-2 rounded-lg">
                    <span>Balance Due:</span>
                    <span className="text-red-700">
                      {formatWithCurrency(invoice.balance_due !== undefined ? invoice.balance_due : (invoice.amount - (invoice.paid_amount || 0)))}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer details: T&C, Refund policy, signature placeholders */}
            <div className="mt-12 border-t border-slate-100 pt-8 grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-8">
              <div className="space-y-4">
                {settings?.invoice_terms && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terms & Conditions</h4>
                    <p className="mt-1.5 text-xs text-slate-500 leading-relaxed white-space-pre-wrap">{settings.invoice_terms}</p>
                  </div>
                )}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Refund Policy</h4>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    Fees once paid are non-refundable. Memberships cannot be transferred or exchanged.
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-center justify-end md:items-end">
                <div className="w-44 text-center">
                  <div className="h-12 border-b border-slate-300 mb-2 flex items-end justify-center">
                    <span className="text-[10px] font-mono text-slate-400 italic">Signature Placeholder</span>
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Authorized Signature</p>
                </div>
              </div>
            </div>

            {/* Thank you message at the center */}
            <div className="mt-8 text-center bg-slate-900 text-amber-300 text-sm font-semibold py-3 px-4 rounded-xl">
              {settings?.invoice_footer || 'Thank you for your business! Stay fit, stay strong.'}
            </div>
          </div>
        </section>

        {/* Record Additional Payment Box */}
        {invoice.status !== 'Paid' && invoice.status !== 'Cancelled' && (
          <SectionCard
            title="Record Payment"
            description="Record additional payments against the outstanding balance."
            className="no-print"
          >
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField label="Amount to Record (INR)" htmlFor="record_amount">
                  <input
                    id="record_amount"
                    type="number"
                    min="1"
                    max={invoice.balance_due !== undefined ? invoice.balance_due : (invoice.amount - (invoice.paid_amount || 0))}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="input-field font-semibold text-slate-800"
                    required
                  />
                </FormField>

                <FormField label="Payment Method" htmlFor="record_method">
                  <select
                    id="record_method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="select-field font-semibold text-slate-800"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Online Payment">Online Payment</option>
                  </select>
                </FormField>

                <FormField label="Transaction ID (Optional)" htmlFor="record_transaction">
                  <input
                    id="record_transaction"
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. UPI82761829"
                    className="input-field font-mono"
                  />
                </FormField>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={recordingPayment}
                  className="btn btn-primary"
                >
                  {recordingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <DollarSign className="h-4 w-4" />}
                  Record Payment
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        <SectionCard
          title="Manual Status Override"
          description="Force update the status of this invoice (requires admin approval)."
          className="no-print"
        >
          <div className="segmented-control">
            {INVOICE_STATUSES.map((status) => {
              const Icon = statusIcons[status as keyof typeof statusIcons] || Clock;
              const active = invoice.status === status;
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => void handleStatusChange(status)}
                  disabled={updating || active}
                  className={cn('segment inline-flex items-center gap-2', active && 'segment-active')}
                >
                  {updating && !active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                  {status}
                </button>
              );
            })}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
