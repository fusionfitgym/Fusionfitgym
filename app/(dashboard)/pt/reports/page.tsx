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
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : activeTab === 'revenue' ? (
        // Tab 1: Revenue Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Recorded Sales</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{formatCurrency(totalRevenue)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <TrendingUp className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Total Transactions</p>
                <p className="mt-1 text-2xl font-black text-blue-400">{payments.length} Payments</p>
              </div>
            </Card>
          </div>

          <Card className="bg-zinc-950 border border-zinc-800 p-5">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Payments Ledger</h3>
              <button onClick={handleExportRevenue} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Client</th>
                    <th>Reference</th>
                    <th>Payment Method</th>
                    <th>Amount Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => (
                    <tr key={p.id}>
                      <td><span className="text-xs text-zinc-400">{formatDate(p.payment_date)}</span></td>
                      <td><p className="font-bold text-zinc-200">{p.client?.full_name}</p></td>
                      <td><span className="text-xs text-zinc-400 font-mono">{p.invoice?.invoice_number || 'Direct'}</span></td>
                      <td><span className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">{p.payment_method}</span></td>
                      <td><p className="font-black text-amber-300">{formatCurrency(p.amount_paid)}</p></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : activeTab === 'trainers' ? (
        // Tab 2: Trainer Performance Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <BarChart2 className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Completed Workouts</p>
                <p className="mt-1 text-2xl font-black text-purple-400">{completedSessionsCount} Sessions</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active Trainers</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{trainers.length}</p>
              </div>
            </Card>
          </div>

          <Card className="bg-zinc-950 border border-zinc-800 p-5">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Trainer Audits</h3>
              <button onClick={handleExportTrainers} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Trainer</th>
                    <th>Phone</th>
                    <th>Commission Type</th>
                    <th>Sessions Scheduled</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {trainers.map(t => {
                    const scheduled = sessions.filter(s => s.trainer_id === t.id).length;
                    const completed = sessions.filter(s => s.trainer_id === t.id && s.status === 'Completed').length;
                    return (
                      <tr key={t.id}>
                        <td><p className="font-bold text-zinc-200">{t.full_name}</p></td>
                        <td><p className="text-xs text-zinc-400">{t.phone}</p></td>
                        <td><span className="text-xs text-amber-300 font-bold bg-amber-400/5 px-2 py-0.5 rounded border border-amber-400/10">{t.commission_type}</span></td>
                        <td><p className="font-mono text-sm text-zinc-300">{scheduled} Sessions</p></td>
                        <td><p className="font-mono text-sm text-emerald-400 font-bold">{completed} Completed</p></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : activeTab === 'packages' ? (
        // Tab 3: Package Enrollments Reports
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Users className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Active PT Enrollments</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">{activeClientsCount} Clients</p>
              </div>
            </Card>
          </div>

          <Card className="bg-zinc-950 border border-zinc-800 p-5">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-900">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Package Sales Popularity</h3>
              <button onClick={handleExportPackages} className="btn btn-secondary btn-sm flex items-center gap-1.5 font-bold">
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>

            <div className="data-table">
              <table>
                <thead>
                  <tr>
                    <th>Package Program</th>
                    <th>Sessions Count</th>
                    <th>Duration</th>
                    <th>Price</th>
                    <th>Discount</th>
                    <th>Active Enrollments</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(new Set(clients.filter(c => c.package).map(c => c.package?.package_name))).map(pkgName => {
                    const sample = clients.find(c => c.package?.package_name === pkgName)?.package;
                    const count = clients.filter(c => c.package?.package_name === pkgName && c.status === 'Active').length;
                    if (!sample) return null;
                    return (
                      <tr key={pkgName}>
                        <td><p className="font-bold text-zinc-200">{pkgName}</p></td>
                        <td><p className="text-sm text-zinc-300">{sample.number_of_sessions} Sessions</p></td>
                        <td><p className="text-xs text-zinc-400">{sample.duration} Days</p></td>
                        <td><p className="text-sm text-zinc-300 font-mono">{formatCurrency(sample.price)}</p></td>
                        <td><p className="text-sm text-red-400 font-mono">-{formatCurrency(sample.discount)}</p></td>
                        <td><p className="font-black text-amber-300">{count} Active Clients</p></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : (
        // Tab 4: Member Progress PDFs
        <div className="space-y-6">
          <Card className="bg-zinc-950 border border-zinc-800 p-6">
            <div className="flex items-center gap-3 mb-4 pb-3 border-b border-zinc-900">
              <FileText className="h-5 w-5 text-amber-400" />
              <div>
                <h3 className="text-base font-bold text-zinc-100">Export PT Member Progress PDF</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Generate a complete biometric, workout, and attendance progress report for any PT member.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end mt-6">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Select PT Client</label>
                <select
                  className="select-field w-full bg-zinc-900 text-zinc-100 border-zinc-800 font-semibold"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                >
                  <option value="">-- Choose a PT Client --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.phone}) - Trainer: {c.trainer?.full_name || 'N/A'} - {c.sessions_remaining} sessions left
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  onClick={() => selectedClientId && handleExportMemberPDF(selectedClientId)}
                  disabled={!selectedClientId || exportingPdf}
                  className="btn btn-primary w-full flex items-center justify-center gap-2 font-bold shadow-md shadow-amber-500/20"
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
                <div className="mt-6 p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 text-xs space-y-2">
                  <div className="flex justify-between items-center text-zinc-200 font-bold">
                    <span>{selectedClient.full_name}</span>
                    <span className="text-amber-400">{selectedClient.status} Client</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-400 pt-2 border-t border-zinc-800">
                    <div>Phone: <strong className="text-zinc-200">{selectedClient.phone}</strong></div>
                    <div>Trainer: <strong className="text-zinc-200">{selectedClient.trainer?.full_name || 'Not assigned'}</strong></div>
                    <div>Package: <strong className="text-zinc-200">{selectedClient.package?.package_name || 'Custom'}</strong></div>
                    <div>Sessions Remaining: <strong className="text-amber-400">{selectedClient.sessions_remaining} / {selectedClient.sessions_purchased}</strong></div>
                  </div>
                </div>
              );
            })()}
          </Card>
        </div>
      )}
    </div>
  );
}
