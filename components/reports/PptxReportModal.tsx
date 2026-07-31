'use client';

import { useState } from 'react';
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
  FileText
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { preparePPTXReportData, PPTXReportOptions } from '@/lib/reports/pptx-data';
import { generatePowerPointReport } from '@/lib/reports/pptx-generator';
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
  const [generationProgress, setGenerationProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

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
    { num: 15, title: 'AI Business Insights', tag: 'Executive Recommendations', icon: Sparkles },
    { num: 16, title: 'Closing & QR Code', tag: 'Contact & Portal QR Code', icon: CheckCircle2 },
  ];

  // PowerPoint Generator Handler
  const handleGeneratePPTX = async () => {
    setGenerating(true);
    setGenerationProgress(15);
    setStatusMessage('Aggregating real-time database metrics...');
    const toastId = toast.loading('Building 16-Slide Executive PowerPoint Presentation...');

    try {
      // 1. Gather raw data sources (or demo state if in demo mode)
      const rawMembers = isDemo ? demo.members : membersData;
      const rawInvoices = isDemo ? demo.invoices : invoicesData;
      const rawAttendance = attendanceData;
      const rawStaff = isDemo ? demo.staff : staffData;
      const rawTrainers = isDemo ? demo.ptTrainers : ptTrainersData;
      const rawPTClients = isDemo ? demo.ptClients : ptClientsData;

      setGenerationProgress(40);
      setStatusMessage('Calculating 16-slide analytics & AI insights...');

      // 2. Prepare aggregated data
      const options: PPTXReportOptions = {
        dateRange,
        startDate,
        endDate,
        generatedBy: profile?.full_name || 'Gym Administrator',
        isDemo
      };

      const fullReportData = await preparePPTXReportData(
        rawMembers,
        rawInvoices,
        rawAttendance,
        rawTrainers,
        rawPTClients,
        rawStaff,
        settingsData,
        options
      );

      setGenerationProgress(70);
      setStatusMessage('Rendering editable PowerPoint vector charts & multi-slide tables...');

      // 3. Generate PPTX presentation blob
      const pptxBlob = await generatePowerPointReport(fullReportData);

      setGenerationProgress(95);
      setStatusMessage('Finalizing presentation bundle...');

      // 4. Trigger download
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
      toast.success('✓ PowerPoint (.pptx) Report Generated & Downloaded Successfully!', { id: toastId });
    } catch (err: any) {
      console.error('Failed to generate PPTX report:', err);
      toast.error(`Generation Failed: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
      setStatusMessage('');
    }
  };

  // PDF Direct Print / Export Handler
  const handleGeneratePDF = async () => {
    toast.info('Preparing presentation print view for PDF export...', { duration: 3000 });
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800 text-white rounded-2xl shadow-2xl p-6">
        <DialogHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
                <Presentation className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  Automatic PowerPoint (.pptx) Executive Report Generator
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 font-semibold uppercase">
                    16 Slides
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400 mt-0.5">
                  Generate presentation-ready, dynamic PowerPoint slides with native editable vector charts & auto-paginated tables.
                </DialogDescription>
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Controls Bar: Date Range Picker */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-blue-400" />
                Select Report Period & Date Range
              </label>
              <span className="text-xs text-slate-400">Real-time DB Data Sync</span>
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
                  className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${
                    dateRange === tab.id
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-transparent'
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
                  <label className="text-[11px] text-slate-400 mb-1 block">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Slide Deck Outline Grid */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" />
                16-Slide Executive Deck Structure
              </h4>
              <span className="text-[11px] text-slate-400">Native Vector Charts & Editable Tables</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 max-h-64 overflow-y-auto pr-1">
              {slidesOutline.map((item) => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.num}
                    className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 hover:border-blue-500/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">
                        Slide {item.num}
                      </span>
                      <IconComponent className="h-3.5 w-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <p className="text-xs font-semibold text-slate-200 line-clamp-1 group-hover:text-white">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">{item.tag}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Progress Indicator when generating */}
          {generating && (
            <div className="bg-blue-950/40 border border-blue-500/30 rounded-xl p-4 space-y-2 animate-pulse">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-300 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-400 animate-spin" />
                  {statusMessage || 'Generating PowerPoint Report...'}
                </span>
                <span className="font-bold text-blue-400">{generationProgress}%</span>
              </div>
              <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-gradient-to-r from-blue-600 to-cyan-400 h-full transition-all duration-300"
                  style={{ width: `${generationProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>Ready for Client & Stakeholder Meetings</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleGeneratePDF}
              disabled={generating}
              className="flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Printer className="h-4 w-4 text-slate-400" />
              Export PDF
            </button>

            <button
              type="button"
              onClick={handleGeneratePPTX}
              disabled={generating}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
