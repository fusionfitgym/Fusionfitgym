'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Receipt } from 'lucide-react';
import Link from 'next/link';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTClients, getPTPackages, getPTTrainers, createPTInvoice } from '@/lib/actions/pt';
import { PTClient, PTPackage, PTTrainer } from '@/types/pt';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

export default function NewPTInvoicePage() {
  const router = useRouter();
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [clients, setClients] = useState<PTClient[]>([]);
  const [packages, setPackages] = useState<PTPackage[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [clientId, setClientId] = useState('');
  const [trainerId, setTrainerId] = useState('');
  const [packageId, setPackageId] = useState('');
  const [packageName, setPackageName] = useState('');
  const [sessionsIncluded, setSessionsIncluded] = useState(12);
  const [price, setPrice] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [gstAmount, setGstAmount] = useState(0);
  const [taxAmount, setTaxAmount] = useState(0);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [nextDueDate, setNextDueDate] = useState('');
  const [terms, setTerms] = useState('1. Personal Training packages are non-refundable.\n2. Sessions must be completed within the duration cap.\n3. Cancellations must be notified 2 hours in advance.');

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (isDemo) {
          setClients(demo.getPTClients().filter(c => c.status === 'Active'));
          setPackages(demo.getPTPackages());
          setTrainers(demo.getPTTrainers());
        } else {
          const clientsData = await getPTClients();
          const packagesData = await getPTPackages();
          const trainersData = await getPTTrainers();
          setClients(clientsData.filter(c => c.status === 'Active'));
          setPackages(packagesData);
          setTrainers(trainersData);
        }
      } catch (err: any) {
        toast.error('Failed to load form details: ' + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isDemo, demo.ptClients, demo.ptPackages]);

  const handleClientChange = (cId: string) => {
    setClientId(cId);
    if (!cId) return;
    const client = clients.find(c => c.id === cId);
    if (client) {
      if (client.trainer_id) setTrainerId(client.trainer_id);
      if (client.package_id) handlePackageChange(client.package_id);
    }
  };

  const handlePackageChange = (pId: string) => {
    setPackageId(pId);
    if (!pId) {
      setPackageName('');
      setPrice(0);
      setDiscount(0);
      return;
    }
    const pkg = packages.find(p => p.id === pId);
    if (pkg) {
      setPackageName(pkg.package_name);
      setPrice(pkg.price);
      setDiscount(pkg.discount);
      setSessionsIncluded(pkg.number_of_sessions);
    }
  };

  const baseFinalAmount = Math.max(0, price - discount);
  const totalGst = Number(gstAmount);
  const totalTax = Number(taxAmount);
  const finalAmountCalculated = baseFinalAmount + totalGst + totalTax;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !packageName || !sessionsIncluded || price <= 0 || !dueDate) {
      toast.error('Please fill all required fields');
      return;
    }

    setSubmitting(true);
    const payload = {
      client_id: clientId,
      invoice_date: new Date().toISOString().split('T')[0],
      trainer_id: trainerId || undefined,
      package_id: packageId || undefined,
      package_name: packageName,
      sessions_included: Number(sessionsIncluded),
      sessions_remaining_at_invoice: Number(sessionsIncluded),
      price: Number(price),
      discount: Number(discount),
      gst_amount: totalGst,
      tax_amount: totalTax,
      final_amount: finalAmountCalculated,
      paid_amount: 0,
      balance_due: finalAmountCalculated,
      due_date: dueDate,
      next_due_date: nextDueDate || undefined,
      status: 'Pending' as const,
      terms_conditions: terms || undefined
    };

    try {
      if (isDemo) {
        const res = demo.createPTInvoice(payload);
        toast.success('PT Invoice generated successfully! (Demo Mode)');
        if (res.data) {
          router.push(`/pt/invoices/${res.data.id}`);
        } else {
          throw new Error(res.error || 'Failed to create invoice');
        }
      } else {
        const res = await createPTInvoice(payload);
        if (res.error || !res.data) throw new Error(res.error || 'Failed to create invoice');
        toast.success('PT Invoice generated successfully!');
        router.push(`/pt/invoices/${res.data.id}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Invoice generation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page page-enter">
      <div className="mb-4">
        <Link href="/pt/invoices" className="btn btn-ghost btn-sm pl-0 gap-1 text-zinc-400 hover:text-zinc-200">
          <ArrowLeft className="h-4 w-4" /> Back to invoices
        </Link>
      </div>

      <PageHeader
        title="Generate PT Invoice"
        subtitle="Create dedicated billing details for personal training. Visually distinct from normal gym invoices."
      />

      {loading ? (
        <div className="flex min-h-[300px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Primary Details */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Invoice Information</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="PT Client Profile" required>
                    <select
                      className="input w-full"
                      value={clientId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      required
                    >
                      <option value="">-- Choose PT Client --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Assigned Trainer">
                    <select
                      className="input w-full"
                      value={trainerId}
                      onChange={(e) => setTrainerId(e.target.value)}
                    >
                      <option value="">-- No Trainer Assigned --</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.id}>{t.full_name}</option>
                      ))}
                    </select>
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Select Package Link">
                    <select
                      className="input w-full"
                      value={packageId}
                      onChange={(e) => handlePackageChange(e.target.value)}
                    >
                      <option value="">-- Custom Invoice --</option>
                      {packages.map(p => (
                        <option key={p.id} value={p.id}>{p.package_name}</option>
                      ))}
                    </select>
                  </FormField>

                  <FormField label="Package Item Name" required>
                    <input
                      type="text"
                      className="input w-full"
                      placeholder="e.g. 12 Sessions Package"
                      value={packageName}
                      onChange={(e) => setPackageName(e.target.value)}
                      required
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField label="Sessions Included" required>
                    <input
                      type="number"
                      min="1"
                      className="input w-full"
                      value={sessionsIncluded}
                      onChange={(e) => setSessionsIncluded(Number(e.target.value))}
                      required
                    />
                  </FormField>

                  <FormField label="Payment Due Date" required>
                    <input
                      type="date"
                      className="input w-full"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      required
                    />
                  </FormField>

                  <FormField label="Next Due Date (Optional)">
                    <input
                      type="date"
                      className="input w-full"
                      value={nextDueDate}
                      onChange={(e) => setNextDueDate(e.target.value)}
                    />
                  </FormField>
                </div>
              </Card>

              {/* Pricing Cards */}
              <Card className="bg-zinc-950 border border-zinc-800 p-6 space-y-4">
                <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Pricing Breakdown</h3>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Base Package Price (₹)" required>
                    <input
                      type="number"
                      min="1"
                      className="input w-full"
                      value={price}
                      onChange={(e) => setPrice(Number(e.target.value))}
                      required
                    />
                  </FormField>

                  <FormField label="Discount (₹)">
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="GST Tax Amount (Optional, ₹)">
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={gstAmount}
                      onChange={(e) => setGstAmount(Number(e.target.value))}
                    />
                  </FormField>

                  <FormField label="Other Tax Amount (Optional, ₹)">
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(Number(e.target.value))}
                    />
                  </FormField>
                </div>

                <FormField label="Terms and Conditions / Policy">
                  <textarea
                    className="input w-full min-h-[90px] text-xs font-mono"
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </FormField>
              </Card>
            </div>

            {/* Invoice Review Panel */}
            <div>
              <Card className="bg-zinc-950 border border-zinc-800 p-6 flex flex-col justify-between h-full sticky top-4">
                <div>
                  <h3 className="text-md font-bold text-zinc-200 border-b border-zinc-800 pb-2">Billing Preview</h3>

                  <div className="mt-4 space-y-3 text-sm text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Subtotal:</span>
                      <span className="font-semibold text-zinc-200">{formatCurrency(price)}</span>
                    </div>
                    {discount > 0 && (
                      <div className="flex justify-between text-red-400">
                        <span>Discount:</span>
                        <span>-{formatCurrency(discount)}</span>
                      </div>
                    )}
                    {(totalGst > 0 || totalTax > 0) && (
                      <>
                        {totalGst > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">GST:</span>
                            <span className="font-semibold text-zinc-200">+{formatCurrency(totalGst)}</span>
                          </div>
                        )}
                        {totalTax > 0 && (
                          <div className="flex justify-between">
                            <span className="text-zinc-500">Tax:</span>
                            <span className="font-semibold text-zinc-200">+{formatCurrency(totalTax)}</span>
                          </div>
                        )}
                      </>
                    )}
                    <div className="border-t border-zinc-800 pt-3 flex justify-between items-baseline">
                      <span className="text-zinc-400 font-bold">Total Amount:</span>
                      <span className="text-2xl font-black text-amber-300">{formatCurrency(finalAmountCalculated)}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex flex-col gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn btn-primary w-full py-3 text-md font-bold flex items-center justify-center gap-2"
                  >
                    <Receipt className="h-5 w-5" />
                    {submitting ? 'Generating...' : 'Generate PT Invoice'}
                  </button>
                  <Link href="/pt/invoices" className="btn btn-secondary w-full py-3 text-center">
                    Cancel
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
