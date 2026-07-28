'use client';

import { useEffect, useState } from 'react';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTPayments, getPTClients, getPTInvoices, getPTSessions, getPTTrainers } from '@/lib/actions/pt';
import { PTPayment, PTClient, PTInvoice, PTSession, PTTrainer } from '@/types/pt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { FileSpreadsheet, Download, FileText, BarChart2, Coins, TrendingUp, Users } from 'lucide-react';

export default function PTReportsPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [activeTab, setActiveTab] = useState<'revenue' | 'trainers' | 'packages' | 'progress'>('revenue');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [payments, setPayments] = useState<PTPayment[]>([]);
  const [clients, setClients] = useState<PTClient[]>([]);
  const [invoices, setInvoices] = useState<PTInvoice[]>([]);
  const [sessions, setSessions] = useState<PTSession[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setPayments(demo.getPTPayments());
        setClients(demo.getPTClients());
        setInvoices(demo.getPTInvoices());
        setSessions(demo.getPTSessions());
        setTrainers(demo.getPTTrainers());
      } else {
        const pay = await getPTPayments();
        const cli = await getPTClients();
        const inv = await getPTInvoices();
        const sess = await getPTSessions();
        const trs = await getPTTrainers();

        setPayments(pay);
        setClients(cli);
        setInvoices(inv);
        setSessions(sess);
        setTrainers(trs);
      }
    } catch (err: any) {
      toast.error('Failed to load reports: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptPayments, demo.ptClients, demo.ptInvoices, demo.ptSessions, demo.ptTrainers]);

  // Exports Calculations
  const exportToCSV = (filename: string, headers: string[], rows: any[][]) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`${filename}.csv exported successfully!`);
  };

  const handleExportRevenue = () => {
    const headers = ['Payment Date', 'Client Name', 'Invoice Ref', 'Amount Paid (INR)', 'Payment Method', 'Notes'];
    const rows = payments.map(p => [
      p.payment_date,
      p.client?.full_name,
      p.invoice?.invoice_number || 'Direct Sale',
      p.amount_paid,
      p.payment_method,
      p.notes || ''
    ]);
    exportToCSV('PT_Revenue_Report', headers, rows);
  };

  const handleExportTrainers = () => {
    const headers = ['Trainer Name', 'Phone', 'Commission Model', 'Total Sessions Scheduled', 'Completed Sessions'];
    const rows = trainers.map(t => {
      const scheduled = sessions.filter(s => s.trainer_id === t.id).length;
      const completed = sessions.filter(s => s.trainer_id === t.id && s.status === 'Completed').length;
      return [
        t.full_name,
        t.phone,
        `${t.commission_type} (Rate: ${t.commission_value})`,
        scheduled,
        completed
      ];
    });
    exportToCSV('PT_Trainer_Performance_Report', headers, rows);
  };

  const handleExportPackages = () => {
    const headers = ['Package Name', 'Sessions Included', 'Duration (Days)', 'Base Price (INR)', 'Discount (INR)', 'Final Price (INR)', 'Active Enrolled Clients'];
    // Aggregate unique packages and client enrollments
    const packageStats = new Map();
    // Count active client enrollments per package name
    clients.forEach(c => {
      if (c.package) {
        const pkgName = c.package.package_name;
        const curCount = packageStats.get(pkgName) || 0;
        packageStats.set(pkgName, curCount + 1);
      }
    });

    const rows = Array.from(packageStats.entries()).map(([pkgName, activeClients]) => {
      const sample = clients.find(c => c.package?.package_name === pkgName)?.package;
      return [
        pkgName,
        sample?.number_of_sessions || '-',
        sample?.duration || '-',
        sample?.price || '-',
        sample?.discount || '-',
        sample?.final_price || '-',
        activeClients
      ];
    });
    exportToCSV('PT_Package_Enrollment_Report', headers, rows);
  };

  const handleExportMemberPDF = async (clientId: string) => {
    const clientObj = clients.find(c => c.id === clientId);
    if (!clientObj) return;

    setExportingPdf(true);
    toast.info(`Generating PT Progress PDF for ${clientObj.full_name}...`);
    try {
      let progressData = [];
      let workoutsData = [];
      let clientSessions = [];
      let currentSettings = undefined;

      if (isDemo) {
        progressData = demo.getPTProgress(clientObj.id);
        workoutsData = demo.getPTDailyWorkouts(clientObj.id);
        clientSessions = demo.getPTSessions().filter(s => s.client_id === clientObj.id);
        currentSettings = demo.getSettings();
      } else {
        const { getPTProgress, getPTDailyWorkouts, getPTSessions } = await import('@/lib/actions/pt');
        const { getSettings } = await import('@/lib/actions/settings');
        
        const [prog, work, sess, setts] = await Promise.all([
          getPTProgress(clientObj.id),
          getPTDailyWorkouts(clientObj.id),
          getPTSessions(),
          getSettings()
        ]);
        progressData = prog;
        workoutsData = work;
        clientSessions = sess.filter(s => s.client_id === clientObj.id);
        currentSettings = setts;
      }

      const { generatePTProgressPDF } = await import('@/lib/pdf/generatePTProgressPDF');
      await generatePTProgressPDF({
        client: clientObj,
        progressLogs: progressData,
        dailyWorkouts: workoutsData,
        sessions: clientSessions,
        settings: currentSettings
      });
      toast.success(`Progress PDF for ${clientObj.full_name} exported successfully!`);
    } catch (err: any) {
      toast.error('Failed to export PDF: ' + (err?.message || err));
    } finally {
      setExportingPdf(false);
    }
  };

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const activeClientsCount = clients.filter(c => c.status === 'Active').length;
  const completedSessionsCount = sessions.filter(s => s.status === 'Completed').length;

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Reports"
        subtitle="Export performance indexes, track monthly sales revenue, and audit trainer payouts."
      />

      {/* Tabs */}
      <div className="segmented-control mb-6" aria-label="Reports Tab selection">
        <button
          onClick={() => setActiveTab('revenue')}
          className={`segment ${activeTab === 'revenue' && 'segment-active'}`}
        >
          Revenue Reports
        </button>
        <button
          onClick={() => setActiveTab('trainers')}
          className={`segment ${activeTab === 'trainers' && 'segment-active'}`}
        >
          Trainer Performance
        </button>
        <button
          onClick={() => setActiveTab('packages')}
          className={`segment ${activeTab === 'packages' && 'segment-active'}`}
        >
          Package Enrollments
        </button>
        <button
          onClick={() => setActiveTab('progress')}
          className={`segment ${activeTab === 'progress' && 'segment-active'}`}
        >
          Member Progress PDFs
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : activeTab === 'revenue' ? (
        // Tab 1: Revenue Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200/60">
                <Coins className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Recorded Sales</p>
                <p className="mt-1 text-2xl font-black text-amber-600">{formatCurrency(totalRevenue)}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200/60">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Transactions</p>
                <p className="mt-1 text-2xl font-black text-blue-600">{payments.length} Payments</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Payments Ledger</h3>
              <button onClick={handleExportRevenue} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold shadow-xs">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Client</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3 px-4 text-xs font-medium text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="py-3 px-4"><p className="font-bold text-slate-900">{p.client?.full_name}</p></td>
                      <td className="py-3 px-4"><span className="text-xs text-slate-500 font-mono">{p.invoice?.invoice_number || 'Direct'}</span></td>
                      <td className="py-3 px-4"><span className="text-xs text-slate-700 font-semibold bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">{p.payment_method}</span></td>
                      <td className="py-3 px-4 text-right"><p className="font-black text-amber-600 font-mono">{formatCurrency(p.amount_paid)}</p></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'trainers' ? (
        // Tab 2: Trainer Performance Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200/60">
                <BarChart2 className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Completed Workouts</p>
                <p className="mt-1 text-2xl font-black text-purple-600">{completedSessionsCount} Sessions</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200/60">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Trainers</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{trainers.length}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Trainer Audits</h3>
              <button onClick={handleExportTrainers} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold shadow-xs">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Trainer</th>
                    <th className="py-3 px-4">Phone</th>
                    <th className="py-3 px-4">Commission Type</th>
                    <th className="py-3 px-4">Sessions Scheduled</th>
                    <th className="py-3 px-4 text-right">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {trainers.map(t => {
                    const scheduled = sessions.filter(s => s.trainer_id === t.id).length;
                    const completed = sessions.filter(s => s.trainer_id === t.id && s.status === 'Completed').length;
                    return (
                      <tr key={t.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4"><p className="font-bold text-slate-900">{t.full_name}</p></td>
                        <td className="py-3 px-4"><p className="text-xs text-slate-500 font-medium">{t.phone}</p></td>
                        <td className="py-3 px-4"><span className="text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200">{t.commission_type}</span></td>
                        <td className="py-3 px-4"><p className="font-mono text-sm text-slate-700 font-semibold">{scheduled} Sessions</p></td>
                        <td className="py-3 px-4 text-right"><p className="font-mono text-sm text-emerald-600 font-extrabold">{completed} Completed</p></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'packages' ? (
        // Tab 3: Package Enrollments Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200/60">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active PT Enrollments</p>
                <p className="mt-1 text-2xl font-black text-emerald-600">{activeClientsCount} Clients</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm overflow-hidden">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Package Sales Popularity</h3>
              <button onClick={handleExportPackages} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold shadow-xs">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Package Program</th>
                    <th className="py-3 px-4">Sessions Count</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Price</th>
                    <th className="py-3 px-4">Discount</th>
                    <th className="py-3 px-4 text-right">Active Enrollments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {Array.from(new Set(clients.filter(c => c.package).map(c => c.package?.package_name))).map(pkgName => {
                    const sample = clients.find(c => c.package?.package_name === pkgName)?.package;
                    const count = clients.filter(c => c.package?.package_name === pkgName && c.status === 'Active').length;
                    if (!sample) return null;
                    return (
                      <tr key={pkgName} className="hover:bg-amber-50/20 transition-colors">
                        <td className="py-3 px-4"><p className="font-bold text-slate-900">{pkgName}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-slate-700 font-semibold">{sample.number_of_sessions} Sessions</p></td>
                        <td className="py-3 px-4"><p className="text-xs text-slate-500 font-medium">{sample.duration} Days</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-slate-800 font-mono font-bold">{formatCurrency(sample.price)}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-rose-600 font-mono font-bold">-{formatCurrency(sample.discount)}</p></td>
                        <td className="py-3 px-4 text-right"><p className="font-black text-amber-600 font-mono">{count} Active Clients</p></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        // Tab 4: Member Progress PDFs
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-700 font-extrabold flex items-center justify-center shadow-inner">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Export PT Member Progress PDF</h3>
                <p className="text-xs font-semibold text-slate-500 mt-0.5">Generate a comprehensive biometric timeline, daily workout routine, and attendance progress report for any PT client.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-500 mb-2">Select PT Client</label>
                <select
                  className="select-field w-full text-slate-900 font-semibold bg-white border-slate-200 shadow-xs"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">-- Select a PT Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone}) - Trainer: {c.trainer?.full_name || 'N/A'} - {c.sessions_remaining} sessions remaining
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  onClick={() => selectedClientId && handleExportMemberPDF(selectedClientId)}
                  disabled={!selectedClientId || exportingPdf}
                  className="btn btn-primary w-full flex items-center justify-center gap-2 font-extrabold shadow-md shadow-amber-200/50"
                >
                  <Download className="h-4 w-4" />
                  {exportingPdf ? 'Generating PDF...' : 'Download Progress PDF'}
                </button>
              </div>
            </div>

            {selectedClientId && (() => {
              const selectedClient = clients.find(c => c.id === selectedClientId);
              if (!selectedClient) return null;
              return (
                <div className="mt-6 p-5 rounded-2xl bg-slate-50/90 border border-slate-200/80 text-xs space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-200/70 pb-3">
                    <div>
                      <span className="text-base font-black text-slate-900 block">{selectedClient.full_name}</span>
                      <span className="text-slate-500 text-xs font-semibold">📞 {selectedClient.phone} {selectedClient.email ? `• ✉️ ${selectedClient.email}` : ''}</span>
                    </div>
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-extrabold border shadow-xs ${
                      selectedClient.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {selectedClient.status} Client
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="rounded-xl bg-white p-3 border border-slate-200/70">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Assigned Trainer</span>
                      <span className="text-slate-900 font-extrabold block mt-0.5 text-xs">{selectedClient.trainer?.full_name || 'Not assigned'}</span>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200/70">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Package Selected</span>
                      <span className="text-slate-900 font-extrabold block mt-0.5 text-xs">{selectedClient.package?.package_name || 'Custom Package'}</span>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-slate-200/70">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Sessions Tracker</span>
                      <span className="text-amber-600 font-black block mt-0.5 text-xs">{selectedClient.sessions_remaining} / {selectedClient.sessions_purchased} remaining</span>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
