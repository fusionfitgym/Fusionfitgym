'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Printer, Download, Share2, Mail, MessageSquare, CreditCard, DollarSign, X } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTInvoiceById, createPTPayment } from '@/lib/actions/pt';
import { PTInvoice } from '@/types/pt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [invoice, setInvoice] = useState<PTInvoice | null>(null);
  const [loading, setLoading] = useState(true);

  // Payment collection modal state
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer'>('UPI');
  const [notes, setNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setInvoice(demo.getPTInvoiceById(id));
      } else {
        const data = await getPTInvoiceById(id);
        setInvoice(data);
      }
    } catch (err: any) {
      toast.error('Failed to load invoice details: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id, isDemo, demo.ptInvoices]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    toast.info('Generating PDF document...');
    try {
      const { default: jsPDF } = await import('jspdf');
      
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Simple design for PT invoice PDF download
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(245, 158, 11); // Amber
      doc.text('FUSION FIT ERP', 20, 20);
      
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.text('Personal Training Billing Invoice', 20, 26);
      
      doc.setFontSize(12);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`INVOICE: ${invoice?.invoice_number}`, 140, 20);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Date: ${formatDate(invoice?.invoice_date || '')}`, 140, 26);
      doc.text(`Due: ${formatDate(invoice?.due_date || '')}`, 140, 32);

      doc.setDrawColor(200, 200, 200);
      doc.line(20, 38, 190, 38);

      // Customer / Trainer detail columns
      doc.setFont('Helvetica', 'bold');
      doc.text('BILL TO:', 20, 48);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Client Name: ${invoice?.client?.full_name}`, 20, 54);
      doc.text(`Phone: ${invoice?.client?.phone}`, 20, 60);
      doc.text(`Email: ${invoice?.client?.email || '-'}`, 20, 66);

      doc.setFont('Helvetica', 'bold');
      doc.text('TRAINING DETAILS:', 110, 48);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Trainer: ${invoice?.trainer?.full_name || 'N/A'}`, 110, 54);
      doc.text(`Package: ${invoice?.package_name}`, 110, 60);
      doc.text(`Sessions: ${invoice?.sessions_included} Sessions`, 110, 66);

      doc.line(20, 74, 190, 74);

      // Price breakdown
      doc.setFont('Helvetica', 'bold');
      doc.text('DESCRIPTION', 20, 84);
      doc.text('AMOUNT', 160, 84);
      doc.line(20, 88, 190, 88);

      doc.setFont('Helvetica', 'normal');
      doc.text(`${invoice?.package_name} - Course Fee`, 20, 96);
      doc.text(`₹${Number(invoice?.price).toFixed(2)}`, 160, 96);
      
      if (Number(invoice?.discount) > 0) {
        doc.setTextColor(180, 0, 0);
        doc.text(`Package Discount Applied`, 20, 104);
        doc.text(`-₹${Number(invoice?.discount).toFixed(2)}`, 160, 104);
        doc.setTextColor(30, 30, 30);
      }

      const currentY = Number(invoice?.discount) > 0 ? 112 : 104;
      doc.line(20, currentY, 190, currentY);

      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL FINAL AMOUNT:', 100, currentY + 10);
      doc.text(`₹${Number(invoice?.final_amount).toFixed(2)}`, 160, currentY + 10);
      
      doc.setFont('Helvetica', 'normal');
      doc.text('Amount Paid:', 100, currentY + 18);
      doc.text(`₹${Number(invoice?.paid_amount).toFixed(2)}`, 160, currentY + 18);
      
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(245, 158, 11);
      doc.text('Balance Due:', 100, currentY + 26);
      doc.text(`₹${Number(invoice?.balance_due).toFixed(2)}`, 160, currentY + 26);
      
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(100, 100, 100);
      doc.setFontSize(8);
      
      doc.text('Terms and Conditions:', 20, 180);
      doc.text(invoice?.terms_conditions || 'PT fees are non-refundable. Cancelled classes expire if not rescheduled 2h prior.', 20, 186, { maxWidth: 170 });

      // Signatures
      doc.line(20, 230, 70, 230);
      doc.text('Authorized Signature', 20, 235);

      doc.line(140, 230, 190, 230);
      doc.text('Client Signature', 140, 235);

      doc.save(`PT-INVOICE-${invoice?.invoice_number}.pdf`);
      toast.success('Invoice PDF downloaded successfully!');
    } catch (err: any) {
      toast.error('Failed to generate PDF: ' + err.message);
    }
  };

  const handleShareEmail = () => {
    if (!invoice) return;
    const subject = `Invoice ${invoice.invoice_number} from FusionFit Gym`;
    const body = `Hi ${invoice.client?.full_name},\n\nYour PT invoice is ready.\n\nInvoice Number: ${invoice.invoice_number}\nAmount: ₹${invoice.final_amount}\nBalance Due: ₹${invoice.balance_due}\nDue Date: ${formatDate(invoice.due_date)}\n\nThank you,\nFusionFit Gym Team`;
    window.open(`mailto:${invoice.client?.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const handleShareWhatsApp = () => {
    if (!invoice) return;
    const message = `Hi *${invoice.client?.full_name}*, your Personal Training invoice *${invoice.invoice_number}* is ready. Total: *₹${invoice.final_amount}*, Balance Due: *₹${invoice.balance_due}*. Due Date: ${formatDate(invoice.due_date)}. Please settle soon. Thanks! - FusionFit Gym`;
    window.open(`https://api.whatsapp.com/send?phone=${encodeURIComponent(invoice.client?.phone || '')}&text=${encodeURIComponent(message)}`);
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice || !amountPaid || Number(amountPaid) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    setSubmittingPayment(true);
    const payload = {
      client_id: invoice.client_id,
      invoice_id: invoice.id,
      amount_paid: Number(amountPaid),
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: paymentMethod,
      notes: notes || undefined
    };

    try {
      if (isDemo) {
        demo.createPTPayment(payload);
        toast.success('Demo payment recorded successfully! (Demo Mode)');
      } else {
        const res = await createPTPayment(payload);
        if (res.error) throw new Error(res.error);
        toast.success('Payment recorded successfully!');
      }
      setIsPayModalOpen(false);
      setAmountPaid('');
      setNotes('');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Payment collection failed');
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="page p-12 text-center">
        <h3 className="text-xl font-bold text-red-400">Invoice not found.</h3>
        <Link href="/pt/invoices" className="btn btn-secondary mt-4">
          Back to invoices
        </Link>
      </div>
    );
  }

  return (
    <div className="page page-enter">
      {/* Hide controls on Print */}
      <div className="mb-4 flex items-center justify-between no-print">
        <Link href="/pt/invoices" className="btn btn-ghost btn-sm pl-0 gap-1 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>

        <div className="flex gap-2">
          {invoice.status !== 'Paid' && (isAdmin || isReceptionist) && (
            <button onClick={() => { setAmountPaid(String(invoice.balance_due)); setIsPayModalOpen(true); }} className="btn btn-primary btn-sm flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" /> Collect Payment
            </button>
          )}
          <button onClick={handlePrint} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button onClick={handleDownloadPDF} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Download className="h-3.5 w-3.5" /> PDF
          </button>
          <button onClick={handleShareEmail} className="btn btn-secondary btn-sm flex items-center gap-1" title="Email Invoice">
            <Mail className="h-3.5 w-3.5" />
          </button>
          <button onClick={handleShareWhatsApp} className="btn btn-secondary btn-sm flex items-center gap-1 text-emerald-400 hover:text-emerald-300" title="WhatsApp Share">
            <MessageSquare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Invoice Layout Container */}
      <div className="print-area max-w-3xl mx-auto">
        <Card className="bg-zinc-950 border border-zinc-800 p-8 sm:p-12 relative overflow-hidden rounded-xl shadow-xl">
          {/* Subtle branding watermarks or designs unique to PT */}
          <div className="absolute top-0 right-0 h-40 w-40 bg-amber-400/5 rounded-bl-full pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 border-b border-zinc-800 pb-8">
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-amber-300 px-2.5 py-1 bg-amber-400/10 rounded-md border border-amber-400/20">
                Personal Training Invoice
              </span>
              <h2 className="text-xl font-bold text-zinc-400 mt-3 font-mono">{invoice.invoice_number}</h2>
              <p className="text-xs text-zinc-500 mt-1">Generated Date: {formatDate(invoice.invoice_date)}</p>
            </div>
            
            <div className="text-left sm:text-right">
              <h1 className="text-lg font-black tracking-wider text-zinc-100 uppercase">FUSION FIT ERP</h1>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs">123 Fitness Street, MG Road, Bangalore, Karnataka 560001</p>
              <p className="text-xs text-zinc-500 font-medium">info@fusionfitgym.com &bull; +91 98765 43210</p>
            </div>
          </div>

          {/* Billing columns */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-8 text-sm">
            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">Bill To (PT Client)</h4>
              <p className="font-bold text-zinc-200 text-base">{invoice.client?.full_name}</p>
              <p className="text-zinc-400 mt-1.5">{invoice.client?.phone}</p>
              {invoice.client?.email && <p className="text-zinc-400 mt-0.5">{invoice.client?.email}</p>}
            </div>

            <div>
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">PT Course Information</h4>
              <div className="space-y-1 text-zinc-300">
                <div className="flex justify-between"><span className="text-zinc-500">Trainer:</span> <span className="font-semibold text-zinc-200">{invoice.trainer?.full_name || 'N/A'}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Package:</span> <span className="font-semibold text-zinc-200">{invoice.package_name}</span></div>
                <div className="flex justify-between"><span className="text-zinc-500">Sessions Total:</span> <span className="font-semibold text-zinc-200">{invoice.sessions_included} Sessions</span></div>
              </div>
            </div>
          </div>

          {/* Charges details */}
          <div className="mt-10 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 bg-zinc-900/30 p-3 text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-800">
              <div className="col-span-2">Description</div>
              <div className="text-right">Price</div>
            </div>

            <div className="grid grid-cols-3 p-4 text-sm text-zinc-300 items-center">
              <div className="col-span-2">
                <p className="font-bold text-zinc-200">{invoice.package_name} Enrollment</p>
                <p className="text-xs text-zinc-500 mt-1">Course length: {invoice.sessions_included} personalized training sessions with trainer.</p>
              </div>
              <div className="text-right font-mono text-zinc-100 font-bold">{formatCurrency(invoice.price)}</div>
            </div>

            {invoice.discount > 0 && (
              <div className="grid grid-cols-3 px-4 pb-4 text-sm text-red-400 items-center">
                <div className="col-span-2 font-semibold">Special Package Discount Applied</div>
                <div className="text-right font-mono font-bold">-{formatCurrency(invoice.discount)}</div>
              </div>
            )}
          </div>

          {/* Pricing Totals */}
          <div className="mt-6 flex flex-col items-end border-t border-zinc-900 pt-6">
            <div className="w-full sm:w-80 space-y-2.5 text-sm text-zinc-300">
              <div className="flex justify-between text-zinc-500">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(invoice.price - invoice.discount)}</span>
              </div>
              {invoice.gst_amount > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>GST Amount:</span>
                  <span className="font-mono">+{formatCurrency(invoice.gst_amount)}</span>
                </div>
              )}
              {invoice.tax_amount > 0 && (
                <div className="flex justify-between text-zinc-500">
                  <span>Tax Amount:</span>
                  <span className="font-mono">+{formatCurrency(invoice.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold text-zinc-200 border-t border-zinc-800 pt-2.5">
                <span>Final Price:</span>
                <span className="font-mono text-amber-300">{formatCurrency(invoice.final_amount)}</span>
              </div>
              <div className="flex justify-between text-zinc-400 text-xs font-semibold">
                <span>Total Amount Paid:</span>
                <span className="font-mono text-zinc-300">{formatCurrency(invoice.paid_amount)}</span>
              </div>
              <div className="flex justify-between text-lg font-black text-zinc-100 border-t border-zinc-800 pt-2 bg-amber-400/5 p-2 rounded-lg border border-amber-400/10">
                <span className="text-amber-300">Balance Due:</span>
                <span className="font-mono text-amber-300">{formatCurrency(invoice.balance_due)}</span>
              </div>
            </div>
          </div>

          {/* Footer Terms & Signatures */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-8 text-xs pt-8 border-t border-zinc-800/80">
            <div>
              <h4 className="font-bold text-zinc-400 uppercase tracking-widest mb-2">Terms & Policies</h4>
              <p className="text-zinc-500 leading-relaxed whitespace-pre-line font-mono text-[10px]">
                {invoice.terms_conditions || 'No specific terms configured.'}
              </p>
            </div>
            
            <div className="flex justify-between gap-4 mt-8 md:mt-0 pt-4">
              <div className="text-center w-full">
                <div className="h-10 border-b border-zinc-800 max-w-[160px] mx-auto" />
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mt-2">Authorized Signature</span>
              </div>
              <div className="text-center w-full">
                <div className="h-10 border-b border-zinc-800 max-w-[160px] mx-auto" />
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block mt-2">Customer Signature</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Collect Payment Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm no-print">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="h-5 w-5 text-amber-500" /> Collect Payment
              </h3>
              <button onClick={() => setIsPayModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-sm">
                <span className="text-slate-500">Invoice Number:</span>
                <span className="font-mono font-bold text-slate-700">{invoice.invoice_number}</span>
              </div>

              <FormField label="Amount to Collect (₹)" required>
                <input
                  type="number"
                  min="1"
                  max={invoice.balance_due}
                  className="input-field w-full font-bold text-lg text-amber-600"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Payment Method" required>
                <select
                  className="select-field w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  required
                >
                  <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer (IMPS/NEFT)</option>
                </select>
              </FormField>

              <FormField label="Payment Notes">
                <textarea
                  className="textarea-field w-full min-h-[60px]"
                  placeholder="Txn ID, reference, or description..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsPayModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submittingPayment} className="btn btn-primary">
                  {submittingPayment ? 'Processing...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
