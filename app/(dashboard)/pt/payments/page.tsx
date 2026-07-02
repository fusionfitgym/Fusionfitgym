'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTPayments, createPTPayment, getPTClients, getPTInvoices } from '@/lib/actions/pt';
import { PTPayment, PTClient, PTInvoice } from '@/types/pt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { DollarSign, Search, Plus, Filter, Wallet, CreditCard, X, Check } from 'lucide-react';

export default function PTPaymentsPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [payments, setPayments] = useState<PTPayment[]>([]);
  const [clients, setClients] = useState<PTClient[]>([]);
  const [invoices, setInvoices] = useState<PTInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('All');

  // Collect Payment Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientId, setClientId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Split Payment' | 'Partial Payment'>('UPI');
  const [notes, setNotes] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [upiAmount, setUpiAmount] = useState('');
  const [cardAmount, setCardAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setPayments(demo.getPTPayments());
        setClients(demo.getPTClients().filter(c => c.status === 'Active'));
        setInvoices(demo.getPTInvoices().filter(i => i.status === 'Pending'));
      } else {
        const payData = await getPTPayments();
        const clientData = await getPTClients();
        const invData = await getPTInvoices();
        setPayments(payData);
        setClients(clientData.filter(c => c.status === 'Active'));
        setInvoices(invData.filter(i => i.status === 'Pending'));
      }
    } catch (err: any) {
      toast.error('Failed to load payments: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptPayments, demo.ptClients, demo.ptInvoices]);

  const handleClientChange = (cId: string) => {
    setClientId(cId);
    setInvoiceId('');
    if (!cId) return;
    
    // Auto fill first pending invoice amount if exists
    const clientPendingInvs = invoices.filter(i => i.client_id === cId);
    if (clientPendingInvs.length > 0) {
      setInvoiceId(clientPendingInvs[0].id);
      setAmountPaid(String(clientPendingInvs[0].balance_due));
    } else {
      setAmountPaid('');
    }
  };

  const handleInvoiceChange = (invId: string) => {
    setInvoiceId(invId);
    if (!invId) {
      setAmountPaid('');
      return;
    }
    const inv = invoices.find(i => i.id === invId);
    if (inv) {
      setAmountPaid(String(inv.balance_due));
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !amountPaid || Number(amountPaid) <= 0 || !paymentDate || !paymentMethod) {
      toast.error('Please enter all required fields');
      return;
    }

    setSubmitting(true);
    
    let splitDetails: Record<string, number> | null = null;
    if (paymentMethod === 'Split Payment') {
      splitDetails = {};
      if (cashAmount && Number(cashAmount) > 0) splitDetails['Cash'] = Number(cashAmount);
      if (upiAmount && Number(upiAmount) > 0) splitDetails['UPI'] = Number(upiAmount);
      if (cardAmount && Number(cardAmount) > 0) splitDetails['Card'] = Number(cardAmount);
      
      const splitSum = Object.values(splitDetails).reduce((a, b) => a + b, 0);
      if (splitSum !== Number(amountPaid)) {
        toast.error(`Split amounts sum (${formatCurrency(splitSum)}) must match total paid (${formatCurrency(Number(amountPaid))})`);
        setSubmitting(false);
        return;
      }
    }

    const payload = {
      client_id: clientId,
      invoice_id: invoiceId || null,
      amount_paid: Number(amountPaid),
      payment_date: paymentDate,
      payment_method: paymentMethod,
      split_details: splitDetails,
      notes: notes || undefined
    };

    try {
      if (isDemo) {
        demo.createPTPayment(payload);
        toast.success('PT Payment recorded successfully! (Demo Mode)');
      } else {
        const res = await createPTPayment(payload);
        if (res.error) throw new Error(res.error);
        toast.success('PT Payment recorded successfully!');
      }
      setIsModalOpen(false);
      
      // Clear forms
      setClientId('');
      setInvoiceId('');
      setAmountPaid('');
      setNotes('');
      setCashAmount('');
      setUpiAmount('');
      setCardAmount('');

      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Payment recording failed');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter payments
  const filteredPayments = payments.filter(p => {
    const matchesSearch = p.client?.full_name.toLowerCase().includes(search.toLowerCase()) ||
                          (p.invoice && p.invoice.invoice_number.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = methodFilter === 'All' ? true : p.payment_method === methodFilter;
    return matchesSearch && matchesMethod;
  });

  const totalCollected = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

  // Invoices for selected client in modal
  const filteredInvoicesForClient = invoices.filter(i => i.client_id === clientId);

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Payments"
        subtitle="Track payment receipts, record new collections, and handle split training invoices."
        action={
          (isAdmin || isReceptionist) && (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Collect PT Payment
            </button>
          )
        }
      />

      {/* Summary Widget */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
            <DollarSign className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Collected Revenue</p>
            <p className="mt-1 text-2xl font-black text-amber-300">{formatCurrency(totalCollected)}</p>
          </div>
        </Card>
      </div>

      {/* Filters Card */}
      <Card className="mb-6 p-4 sm:p-5 bg-zinc-950 border border-zinc-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              className="input pl-9 w-full"
              placeholder="Search by client name or invoice number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <span className="flex items-center text-sm text-zinc-400 gap-1 shrink-0">
              <Filter className="h-4 w-4" /> Payment Method:
            </span>
            <select
              className="input flex-1"
              value={methodFilter}
              onChange={(e) => setMethodFilter(e.target.value)}
            >
              <option value="All">All Methods</option>
              <option value="UPI">UPI</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Split Payment">Split Payment</option>
              <option value="Partial Payment">Partial Payment</option>
            </select>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filteredPayments.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center bg-zinc-950 border border-zinc-800">
          <Wallet className="mx-auto h-12 w-12 text-zinc-650" />
          <h3 className="mt-4 text-lg font-bold text-zinc-200">No Payment History Found</h3>
          <p className="mt-2 text-zinc-400">Collect the first payment package to populate reports.</p>
        </Card>
      ) : (
        <div className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Reference Invoice</th>
                  <th>Amount Paid</th>
                  <th>Payment Method</th>
                  <th>Date Recorded</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((p) => (
                  <tr key={p.id}>
                    <td><p className="font-bold text-zinc-100">{p.client?.full_name}</p></td>
                    <td>
                      {p.invoice ? (
                        <span className="font-mono text-xs text-zinc-300 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                          {p.invoice.invoice_number}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Direct Sale</span>
                      )}
                    </td>
                    <td><p className="font-black text-amber-300">{formatCurrency(p.amount_paid)}</p></td>
                    <td>
                      <div>
                        <span className="text-xs text-zinc-200 font-bold bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full">{p.payment_method}</span>
                        {p.payment_method === 'Split Payment' && p.split_details && (
                          <p className="text-[10px] text-zinc-500 mt-1 font-mono">
                            {Object.entries(p.split_details).map(([m, amt]) => `${m}: ₹${amt}`).join(', ')}
                          </p>
                        )}
                      </div>
                    </td>
                    <td><p className="text-xs text-zinc-400">{formatDate(p.payment_date)}</p></td>
                    <td><p className="text-xs text-zinc-500 max-w-xs truncate">{p.notes || '-'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Collect Payment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl animate-enter max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                <DollarSign className="h-5 w-5 text-amber-500" /> Collect PT Payment
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <FormField label="Select PT Client" required>
                <select
                  className="select-field w-full"
                  value={clientId}
                  onChange={(e) => handleClientChange(e.target.value)}
                  required
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.full_name} ({c.phone})</option>
                  ))}
                </select>
              </FormField>

              {clientId && filteredInvoicesForClient.length > 0 && (
                <FormField label="Link Pending Invoice (Optional)">
                  <select
                    className="select-field w-full"
                    value={invoiceId}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                  >
                    <option value="">-- Direct Payment (No Invoice link) --</option>
                    {filteredInvoicesForClient.map(i => (
                      <option key={i.id} value={i.id}>{i.invoice_number} (Bal: ₹{i.balance_due})</option>
                    ))}
                  </select>
                </FormField>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Amount Paid (₹)" required>
                  <input
                    type="number"
                    min="1"
                    className="input-field w-full font-bold text-amber-600"
                    placeholder="Enter amount"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Payment Date" required>
                  <input
                    type="date"
                    className="input-field w-full"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </FormField>
              </div>

              <FormField label="Payment Method" required>
                <select
                  className="select-field w-full"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  required
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Split Payment">Split Payment</option>
                  <option value="Partial Payment">Partial Payment</option>
                </select>
              </FormField>

              {/* Split Payment inputs */}
              {paymentMethod === 'Split Payment' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Split Details</h4>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <FormField label="Cash (₹)">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-full text-xs font-mono text-center"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                      />
                    </FormField>

                    <FormField label="UPI (₹)">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-full text-xs font-mono text-center"
                        value={upiAmount}
                        onChange={(e) => setUpiAmount(e.target.value)}
                      />
                    </FormField>

                    <FormField label="Card (₹)">
                      <input
                        type="number"
                        min="0"
                        className="input-field w-full text-xs font-mono text-center"
                        value={cardAmount}
                        onChange={(e) => setCardAmount(e.target.value)}
                      />
                    </FormField>
                  </div>
                </div>
              )}

              <FormField label="Payment Notes">
                <textarea
                  className="textarea-field w-full min-h-[60px]"
                  placeholder="Transactions notes, references..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
