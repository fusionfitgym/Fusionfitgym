'use client';

import { useState, useEffect } from 'react';
import {
  Presentation,
  Download,
  Calendar,
  FileSpreadsheet,
  CheckCircle2,
  Sparkles,
  Layers,
  BarChart3,
  Users,
  ShieldCheck,
  Zap,
  Printer,
  X,
  FileText,
  Database,
  RefreshCw
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { preparePPTXReportData, PPTXReportOptions } from '@/lib/reports/pptx-data';
import { generatePowerPointReport } from '@/lib/reports/pptx-generator';
import { generatePdfReport } from '@/lib/reports/pdf-generator';
import { getPowerPointLiveData } from '@/lib/actions/reports';
import { toast } from 'sonner';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';

interface PptxReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  membersData?: any[];
  invoicesData?: any[];
  attendanceData?: any[];
  ptTrainersData?: any[];
  ptClientsData?: any[];
  staffData?: any[];
  settingsData?: any;
}

export function PptxReportModal({
  open,
  onOpenChange,
  membersData = [],
  invoicesData = [],
  attendanceData = [],
  ptTrainersData = [],
  ptClientsData = [],
  staffData = [],
  settingsData,
}: PptxReportModalProps) {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [dateRange, setDateRange] = useState<'monthly' | 'weekly' | 'yearly' | 'custom'>('monthly');
  const [startDate, setStartDate] = useState<string>(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [generating, setGenerating] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  // Live Database State
  const [liveData, setLiveData] = useState<{
    members: any[];
    invoices: any[];
    attendanceLogs: any[];
    ptTrainers: any[];
    ptClients: any[];
    staff: any[];
    settings?: any;
  }>({
    members: [],
    invoices: [],
    attendanceLogs: [],
    ptTrainers: [],
    ptClients: [],
    staff: [],
    settings: undefined,
  });

  // Fetch full live database data when modal opens
  const fetchLiveData = async () => {
    setLoadingData(true);
    try {
      if (isDemo) {
        setLiveData({
          members: demo.members || [],
          invoices: demo.invoices || [],
          attendanceLogs: attendanceData || [],
          ptTrainers: demo.ptTrainers || [],
          ptClients: demo.ptClients || [],
          staff: demo.staff || [],
          settings: settingsData,
        });
      } else {
        const res = await getPowerPointLiveData();
        setLiveData({
          members: res.members.length > 0 ? res.members : membersData,
          invoices: res.invoices.length > 0 ? res.invoices : invoicesData,
          attendanceLogs: res.attendanceLogs.length > 0 ? res.attendanceLogs : attendanceData,
          ptTrainers: res.ptTrainers.length > 0 ? res.ptTrainers : ptTrainersData,
          ptClients: res.ptClients.length > 0 ? res.ptClients : ptClientsData,
          staff: res.staff.length > 0 ? res.staff : staffData,
          settings: res.settings || settingsData,
        });
      }
    } catch (err) {
      console.error('Error fetching live PowerPoint data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchLiveData();
    }
  }, [open, isDemo]);

  // 16 Slide List Metadata for Preview Outline
  const slidesOutline = [
    { num: 1, title: 'Cover Page', tag: 'Branding & Details', icon: ShieldCheck },
    { num: 2, title: 'Executive Dashboard', tag: '10 Key KPI Cards', icon: Zap },
    { num: 3, title: 'Membership Overview', tag: 'Status & Join Trends', icon: Users },
    { num: 4, title: 'Gender Analytics', tag: 'Demographics & Footfall', icon: Users },
    { num: 5, title: 'Package Analytics', tag: 'Revenue & Share Table', icon: Layers },
    { num: 6, title: 'Personal Training (PT)', tag: 'Client & Trainer Metrics', icon: Sparkles },
    { num: 7, title: 'Revenue Analysis', tag: 'Streams & Monthly Growth', icon: BarChart3 },
    { num: 8, title: 'Attendance Analytics', tag: 'Hourly Heatmap & Footfall', icon: Calendar },
    { num: 9, title: 'Top Members Spotlight', tag: 'Top 10 Frequent Members', icon: Sparkles },
    { num: 10, title: 'Expiring Memberships', tag: '7 / 15 / 30 Day Pipeline', icon: Calendar },
    { num: 11, title: 'Payment & Dues Report', tag: 'Paid vs Outstanding Table', icon: FileSpreadsheet },
    { num: 12, title: 'Trainer Performance', tag: 'Leaderboard & Revenue', icon: BarChart3 },
    { num: 13, title: 'Member Demographics', tag: 'Age & Occupation Breakdown', icon: Users },
    { num: 14, title: 'Member List Table', tag: 'Auto-Paginated Multi-Slide', icon: FileText },
    { num: 15, title: 'Closing & QR Code', tag: 'Contact & Portal QR Code', icon: CheckCircle2 },
  ];

  // Helper to filter data by selected period
  const getFilteredPeriodData = () => {
    const now = new Date();
    let periodStart = new Date();

    if (dateRange === 'weekly') {
      periodStart.setDate(now.getDate() - 7);
    } else if (dateRange === 'monthly') {
      periodStart.setDate(now.getDate() - 30);
    } else if (dateRange === 'yearly') {
      periodStart = new Date(now.getFullYear(), 0, 1);
    } else if (dateRange === 'custom' && startDate) {
      periodStart = new Date(startDate);
    }

    const periodEnd = (dateRange === 'custom' && endDate) ? new Date(endDate) : now;

    const filteredInvoices = (liveData.invoices || []).filter(inv => {
      const invDate = new Date(inv.created_at || inv.due_date || '');
      return isNaN(invDate.getTime()) || (invDate >= periodStart && invDate <= periodEnd);
    });

    const filteredLogs = (liveData.attendanceLogs || []).filter(log => {
      const punchDate = new Date(log.punch_time || '');
      return isNaN(punchDate.getTime()) || (punchDate >= periodStart && punchDate <= periodEnd);
    });

    return {
      members: liveData.members,
      invoices: filteredInvoices.length > 0 ? filteredInvoices : liveData.invoices,
      attendance: filteredLogs.length > 0 ? filteredLogs : liveData.attendanceLogs,
      trainers: liveData.ptTrainers,
      ptClients: liveData.ptClients,
      staff: liveData.staff,
      settings: liveData.settings,
    };
  };

  // PowerPoint Generator Handler
  const handleGeneratePPTX = async () => {
    setGenerating(true);
    setGenerationProgress(15);
    setStatusMessage('Aggregating dynamic period database metrics...');
    const toastId = toast.loading(`Building 16-Slide PowerPoint (${dateRange.toUpperCase()})...`);

    try {
      const dataset = getFilteredPeriodData();

      setGenerationProgress(45);
      setStatusMessage(`Computing real statistics for ${dataset.members.length} members & ${dataset.invoices.length} invoices...`);

      const options: PPTXReportOptions = {
        dateRange,
        startDate,
        endDate,
        generatedBy: profile?.full_name || 'Gym Administrator',
        isDemo
      };

      const fullReportData = await preparePPTXReportData(
        dataset.members,
        dataset.invoices,
        dataset.attendance,
        dataset.trainers,
        dataset.ptClients,
        dataset.staff,
        dataset.settings,
        options
      );

      setGenerationProgress(75);
      setStatusMessage('Rendering editable PowerPoint vector charts & multi-slide tables...');

      const pptxBlob = await generatePowerPointReport(fullReportData);

      setGenerationProgress(95);
      setStatusMessage('Finalizing presentation file...');

      const filename = `Gym_ERP_Executive_Report_${dateRange.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pptx`;
      const url = URL.createObjectURL(pptxBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setGenerationProgress(100);
      toast.success('✓ PowerPoint (.pptx) Report Generated & Downloaded!', { id: toastId });
    } catch (err: any) {
      console.error('Failed to generate PPTX report:', err);
      toast.error(`Generation Failed: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
      setStatusMessage('');
    }
  };

  // PDF Generator Handler
  const handleGeneratePDF = async () => {
    setGenerating(true);
    setGenerationProgress(15);
    setStatusMessage('Aggregating dynamic period database metrics for PDF...');
    const toastId = toast.loading(`Building 15-Page PDF Executive Report (${dateRange.toUpperCase()})...`);

    try {
      const dataset = getFilteredPeriodData();

      setGenerationProgress(45);
      setStatusMessage(`Computing statistics for ${dataset.members.length} members & ${dataset.invoices.length} invoices...`);

      const options: PPTXReportOptions = {
        dateRange,
        startDate,
        endDate,
        generatedBy: profile?.full_name || 'Gym Administrator',
        isDemo
      };

      const fullReportData = await preparePPTXReportData(
        dataset.members,
        dataset.invoices,
        dataset.attendance,
        dataset.trainers,
        dataset.ptClients,
        dataset.staff,
        dataset.settings,
        options
      );

      setGenerationProgress(75);
      setStatusMessage('Rendering executive PDF layout, tables, and KPIs...');

      const pdfBlob = await generatePdfReport(fullReportData);

      setGenerationProgress(95);
      setStatusMessage('Finalizing PDF document...');

      const filename = `Gym_ERP_Executive_Report_${dateRange.toUpperCase()}_${new Date().toISOString().split('T')[0]}.pdf`;
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setGenerationProgress(100);
      toast.success('✓ Executive PDF (.pdf) Report Generated & Downloaded!', { id: toastId });
    } catch (err: any) {
      console.error('Failed to generate PDF report:', err);
      toast.error(`Generation Failed: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
      setStatusMessage('');
    }
  };

  const membersCount = liveData.members?.length || 0;
  const invoicesCount = liveData.invoices?.length || 0;
  const logsCount = liveData.attendanceLogs?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} containerClassName="max-w-3xl sm:max-w-4xl">
      <DialogContent className="bg-zinc-950 border border-zinc-800 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] p-0">
        {/* Header - High Contrast Gold Accent */}
        <DialogHeader className="px-6 py-4 border-b border-zinc-800 bg-zinc-900/90">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-amber-400 text-zinc-950 flex items-center justify-center font-bold shadow-lg shadow-amber-400/20">
                <Presentation className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Executive Report Generator (PPTX & PDF)
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 font-bold uppercase">
                    15 Slides / Pages
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                  Generate presentation-ready, dynamic PowerPoint slides (.pptx) or PDF executive reports (.pdf) with vector charts & auto-paginated tables.
                </DialogDescription>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Real-time DB Connection Badge */}
          <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs">
              <Database className="h-4 w-4 text-amber-400" />
              <span className="font-semibold text-zinc-200">
                {loadingData ? 'Syncing Live Database...' : `Live Database Synced:`}
              </span>
              {!loadingData && (
                <span className="text-amber-400 font-mono font-medium">
                  {membersCount} Members | {invoicesCount} Invoices | {logsCount} Logs
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={fetchLiveData}
              disabled={loadingData}
              className="text-xs text-zinc-400 hover:text-amber-400 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Controls Bar: Date Range Picker */}
          <div className="bg-zinc-900/80 rounded-xl p-4 border border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-amber-400" />
                Select Report Period & Date Range
              </label>
              <span className="text-xs text-zinc-400">Dynamic Metrics Calculation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'monthly', label: 'Monthly Report' },
                { id: 'weekly', label: 'Weekly Report' },
                { id: 'yearly', label: 'Annual Report' },
                { id: 'custom', label: 'Custom Range' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setDateRange(tab.id as any)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                    dateRange === tab.id
                      ? 'bg-amber-400 text-zinc-950 shadow-md shadow-amber-400/20 border border-amber-400'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Custom Date Inputs */}
            {dateRange === 'custom' && (
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-zinc-400 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Slide Deck Outline Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-300 flex items-center gap-2">
                <Layers className="h-4 w-4 text-amber-400" />
                16-Slide Executive Deck Structure
              </h4>
              <span className="text-[11px] text-zinc-400">Native Vector Charts & Editable Tables</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
              {slidesOutline.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.num}
                    className="bg-zinc-900 border border-zinc-800 rounded-lg p-2 hover:border-amber-400/40 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[9px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">
                        Slide {item.num}
                      </span>
                      <IconComponent className="h-3.5 w-3.5 text-zinc-500 group-hover:text-amber-400 transition-colors" />
                    </div>
                    <p className="text-xs font-semibold text-zinc-200 line-clamp-1 group-hover:text-white">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{item.tag}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Indicator when generating */}
          {generating && (
            <div className="bg-zinc-900 border border-amber-400/30 rounded-xl p-4 space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-amber-400 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
                  {statusMessage || 'Generating PowerPoint Report...'}
                </span>
                <span className="font-bold text-amber-400">{generationProgress}%</span>
              </div>
              <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-amber-400 to-amber-500 h-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Sticky Pinned Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur sticky bottom-0 z-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Presentation-Ready & Executive Level</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={generating}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <FileText className="h-4 w-4" />
              Download PDF (.pdf)
            </button>

            <button
              type="button"
              onClick={handleGeneratePPTX}
              disabled={generating}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 shadow-lg shadow-amber-400/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  One-Click Download (.pptx)
                </>
              )}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
