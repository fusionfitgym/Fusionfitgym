import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import { FullPPTXReportData } from './pptx-data';
import { robotoRegular, robotoBold } from '@/lib/pdf/robotoFonts';

// RGB Color Constants matching Corporate Gym Theme
const PDF_COLORS = {
  NAVY_DARK: [15, 23, 42] as [number, number, number],      // #0F172A
  NAVY_CARD: [30, 41, 59] as [number, number, number],      // #1E293B
  BLUE_MAIN: [37, 99, 235] as [number, number, number],     // #2563EB
  CYAN_ACCENT: [14, 165, 233] as [number, number, number],  // #0EA5E9
  BG_LIGHT: [248, 250, 252] as [number, number, number],     // #F8FAFC
  CARD_BG: [255, 255, 255] as [number, number, number],      // #FFFFFF
  CARD_BORDER: [226, 232, 240] as [number, number, number],  // #E2E8F0
  TEXT_MAIN: [15, 23, 42] as [number, number, number],      // #0F172A
  TEXT_MUTED: [100, 116, 139] as [number, number, number],  // #64748B
  WHITE: [255, 255, 255] as [number, number, number],
  GREEN: [16, 185, 129] as [number, number, number],       // #10B981
  RED: [239, 68, 68] as [number, number, number],          // #EF4444
  AMBER: [245, 158, 11] as [number, number, number],       // #F59E0B
  PURPLE: [139, 92, 246] as [number, number, number],      // #8B5CF6
  GOLD: [212, 175, 55] as [number, number, number]          // #D4AF37
};

const PW = 297; // A4 Landscape Width in mm
const PH = 210; // A4 Landscape Height in mm
const M = 12;   // 12mm Margin
const CW = PW - 2 * M; // 273mm Printable Width

// ── Common Header Helper ──────────────────────────────────────────────
function addPageHeader(doc: jsPDF, title: string, subtitle: string, data: FullPPTXReportData) {
  // Top Accent Bar (Blue)
  doc.setFillColor(...PDF_COLORS.BLUE_MAIN);
  doc.rect(0, 0, PW, 2.5, 'F');

  // Header Title
  doc.setTextColor(...PDF_COLORS.NAVY_DARK);
  doc.setFontSize(14);
  doc.setFont('Roboto', 'bold');
  doc.text(title, M, 11);

  // Subtitle
  doc.setTextColor(...PDF_COLORS.TEXT_MUTED);
  doc.setFontSize(8.5);
  doc.setFont('Roboto', 'normal');
  doc.text(subtitle, M, 16);

  // Gym Name Badge (Top Right)
  doc.setTextColor(...PDF_COLORS.BLUE_MAIN);
  doc.setFontSize(9.5);
  doc.setFont('Roboto', 'bold');
  doc.text(data.gymInfo.name.toUpperCase(), PW - M, 11, { align: 'right' });

  // Divider Line
  doc.setDrawColor(...PDF_COLORS.CARD_BORDER);
  doc.setLineWidth(0.4);
  doc.line(M, 19, PW - M, 19);
}

// ── Common Footer Helper ──────────────────────────────────────────────
function addPageFooter(doc: jsPDF, pageNum: number, totalPages: number, data: FullPPTXReportData) {
  const fy = PH - 9;

  // Footer Line
  doc.setDrawColor(...PDF_COLORS.CARD_BORDER);
  doc.setLineWidth(0.3);
  doc.line(M, fy - 3, PW - M, fy - 3);

  // Confidentiality Text
  doc.setTextColor(...PDF_COLORS.TEXT_MUTED);
  doc.setFontSize(7);
  doc.setFont('Roboto', 'normal');
  doc.text(data.metadata.confidentialText, M, fy);

  // Generated Info
  doc.text(`Gen: ${data.metadata.generatedAt} | fusionfit.vercel.app`, PW / 2, fy, { align: 'center' });

  // Page Number
  doc.setTextColor(...PDF_COLORS.BLUE_MAIN);
  doc.setFontSize(8);
  doc.setFont('Roboto', 'bold');
  doc.text(`Page ${pageNum} of ${totalPages}`, PW - M - 22, fy, { align: 'right' });

  // Watermark Hyperlink
  doc.setTextColor(...PDF_COLORS.BLUE_MAIN);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('redix.in', PW - M, fy, { align: 'right' });
}

// ── Helper to draw KPI Card ──────────────────────────────────────────
function drawKpiCard(
  doc: jsPDF,
  title: string,
  value: string | number,
  subtitle: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accentColor: [number, number, number] = PDF_COLORS.BLUE_MAIN
) {
  // Card Fill & Border
  doc.setFillColor(...PDF_COLORS.CARD_BG);
  doc.setDrawColor(...PDF_COLORS.CARD_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'FD');

  // Left Accent Pillar
  doc.setFillColor(...accentColor);
  doc.roundedRect(x, y, 2.5, h, 1, 1, 'F');

  // Title
  doc.setTextColor(...PDF_COLORS.TEXT_MUTED);
  doc.setFontSize(7);
  doc.setFont('Roboto', 'bold');
  doc.text(title.toUpperCase(), x + 5, y + 6);

  // Value
  doc.setTextColor(...PDF_COLORS.NAVY_DARK);
  doc.setFontSize(13);
  doc.setFont('Roboto', 'bold');
  doc.text(String(value), x + 5, y + 15);

  // Subtitle
  doc.setTextColor(...accentColor);
  doc.setFontSize(6.5);
  doc.setFont('Roboto', 'normal');
  doc.text(subtitle, x + 5, y + 21);
}

export async function generatePdfReport(data: FullPPTXReportData): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

  // Register Roboto Fonts
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFileToVFS('Roboto-Bold.ttf', robotoBold);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  let totalPages = 15;

  // -------------------------------------------------------------------
  // PAGE 1: Cover Page
  // -------------------------------------------------------------------
  {
    // Background Dark Slate Navy
    doc.setFillColor(...PDF_COLORS.NAVY_DARK);
    doc.rect(0, 0, PW, PH, 'F');

    // Left Accent Bar
    doc.setFillColor(...PDF_COLORS.BLUE_MAIN);
    doc.rect(0, 0, 7, PH, 'F');
    doc.setFillColor(...PDF_COLORS.CYAN_ACCENT);
    doc.rect(7, 0, 2, PH, 'F');

    // Gym Name Header
    doc.setTextColor(...PDF_COLORS.CYAN_ACCENT);
    doc.setFontSize(14);
    doc.setFont('Roboto', 'bold');
    doc.text(data.gymInfo.name.toUpperCase(), 20, 25);

    // Main Report Title
    doc.setTextColor(...PDF_COLORS.WHITE);
    doc.setFontSize(26);
    doc.setFont('Roboto', 'bold');
    doc.text(data.metadata.reportTitle, 20, 42);

    // Subtitle
    doc.setTextColor(148, 163, 184); // slate-400
    doc.setFontSize(11);
    doc.setFont('Roboto', 'normal');
    doc.text('Comprehensive Business Intelligence, Member Analytics & Revenue Performance', 20, 52);

    // Metadata Details Box
    doc.setFillColor(...PDF_COLORS.NAVY_CARD);
    doc.setDrawColor(51, 65, 85); // slate-700
    doc.setLineWidth(0.4);
    doc.roundedRect(20, 65, CW - 10, 85, 3, 3, 'FD');

    const metaItems = [
      { label: 'REPORT PERIOD', val: data.metadata.periodLabel },
      { label: 'GENERATED ON', val: data.metadata.generatedAt },
      { label: 'GENERATED BY', val: data.metadata.generatedBy },
      { label: 'PORTAL / WEBSITE', val: 'fusionfit.vercel.app' }
    ];

    metaItems.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const mx = 30 + col * 125;
      const my = 80 + row * 32;

      doc.setTextColor(...PDF_COLORS.CYAN_ACCENT);
      doc.setFontSize(8.5);
      doc.setFont('Roboto', 'bold');
      doc.text(item.label, mx, my);

      doc.setTextColor(...PDF_COLORS.WHITE);
      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text(item.val, mx, my + 8);
    });

    // Footer Confidentiality
    doc.setTextColor(...PDF_COLORS.TEXT_MUTED);
    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    doc.text(data.metadata.confidentialText, 20, PH - 15);

    // Watermark
    doc.setTextColor(...PDF_COLORS.CYAN_ACCENT);
    doc.setFontSize(9);
    doc.setFont('Roboto', 'bold');
    doc.text('redix.in', PW - M, PH - 15, { align: 'right' });
  }

  // -------------------------------------------------------------------
  // PAGE 2: Executive Dashboard (10 KPI Cards)
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 2 — Executive Dashboard', 'Key Business Performance Indicators at a Glance', data);

    const kpis = [
      { title: 'Total Members', val: data.kpis.totalMembers, sub: 'Registered DB', color: PDF_COLORS.BLUE_MAIN },
      { title: 'Active Members', val: data.kpis.activeMembers, sub: `${Math.round((data.kpis.activeMembers / data.kpis.totalMembers) * 100)}% Active Ratio`, color: PDF_COLORS.GREEN },
      { title: 'Expired Members', val: data.kpis.expiredMembers, sub: 'Needs Renewal', color: PDF_COLORS.RED },
      { title: 'Frozen Members', val: data.kpis.frozenMembers, sub: 'On Hold', color: PDF_COLORS.AMBER },
      { title: 'New Members', val: `+${data.kpis.newMembersPeriod}`, sub: 'Joined This Period', color: PDF_COLORS.CYAN_ACCENT },
      { title: 'Renewals', val: data.kpis.renewalsPeriod, sub: 'Successful Renewals', color: PDF_COLORS.GREEN },
      { title: 'Today Attendance', val: data.kpis.todayAttendance, sub: 'Check-ins Today', color: PDF_COLORS.PURPLE },
      { title: 'Total Revenue', val: `₹${(data.kpis.totalRevenuePeriod / 1000).toFixed(0)}k`, sub: 'Realized Revenue', color: PDF_COLORS.BLUE_MAIN },
      { title: 'Pending Dues', val: `₹${(data.kpis.pendingPaymentsAmount / 1000).toFixed(0)}k`, sub: 'Outstanding Dues', color: PDF_COLORS.RED },
      { title: 'PT Clients', val: data.kpis.ptClientsCount, sub: 'Personal Training', color: PDF_COLORS.PURPLE }
    ];

    const cardW = 51.5;
    const cardH = 27;

    kpis.forEach((kpi, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = M + col * 55;
      const y = 25 + row * 32;
      drawKpiCard(doc, kpi.title, kpi.val, kpi.sub, x, y, cardW, cardH, kpi.color);
    });

    // Summary Insights Box below KPIs
    const boxY = 93;
    doc.setFillColor(...PDF_COLORS.BG_LIGHT);
    doc.setDrawColor(...PDF_COLORS.CARD_BORDER);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, boxY, CW, 90, 2, 2, 'FD');

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(10);
    doc.setFont('Roboto', 'bold');
    doc.text('EXECUTIVE HIGHLIGHTS & OPERATIONAL METRICS', M + 5, boxY + 10);

    const highlights = [
      `• Member Base: Total roster of ${data.kpis.totalMembers} members with ${data.kpis.activeMembers} active subscriptions (${Math.round((data.kpis.activeMembers / data.kpis.totalMembers) * 100)}% retention rate).`,
      `• New Acquisition: ${data.kpis.newMembersPeriod} new member enrolments logged during the period along with ${data.kpis.renewalsPeriod} plan renewals.`,
      `• Financial Health: Total realized period collection stands at ₹${data.kpis.totalRevenuePeriod.toLocaleString('en-IN')} with ₹${data.kpis.pendingPaymentsAmount.toLocaleString('en-IN')} in pending dues.`,
      `• Facility Footfall: Daily footfall peak recorded ${data.kpis.todayAttendance} check-ins, driving consistent gym floor utilization.`,
      `• Personal Training: ${data.kpis.ptClientsCount} active PT client enrolments managed across certified fitness trainers.`
    ];

    doc.setTextColor(...PDF_COLORS.TEXT_MAIN);
    doc.setFontSize(8.5);
    doc.setFont('Roboto', 'normal');
    highlights.forEach((text, i) => {
      doc.text(text, M + 5, boxY + 22 + i * 13);
    });

    addPageFooter(doc, 2, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 3: Membership Overview & Join Trends Table
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 3 — Membership Overview', 'Status Breakdown, Join Trends & Renewal Performance', data);

    // Status Summary Table (Left)
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('1. Member Status Distribution', M, 26);

    const statusRows = data.membershipOverview.statusCounts.map(s => [
      s.name,
      String(s.count),
      `${Math.round((s.count / (data.kpis.totalMembers || 1)) * 100)}%`
    ]);

    autoTable(doc, {
      startY: 29,
      head: [['Status Category', 'Total Count', 'Share %']],
      body: statusRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 45 }, 1: { cellWidth: 35, halign: 'center' }, 2: { cellWidth: 35, halign: 'center' } },
      margin: { left: M },
      theme: 'grid'
    });

    // Monthly Join Trend Table (Right)
    const rightX = M + 125;
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('2. Monthly New Joins & Renewals Trend', rightX, 26);

    const trendRows = data.membershipOverview.monthlyJoinTrend.map(t => [
      t.month,
      String(t.joins),
      String(t.renewals),
      String(t.expired)
    ]);

    autoTable(doc, {
      startY: 29,
      head: [['Month', 'New Joins', 'Renewals', 'Expired']],
      body: trendRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 30 }, 1: { cellWidth: 35, halign: 'center' }, 2: { cellWidth: 35, halign: 'center' }, 3: { cellWidth: 35, halign: 'center' } },
      margin: { left: rightX },
      theme: 'grid'
    });

    addPageFooter(doc, 3, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 4: Gender Analytics
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 4 — Gender Analytics', 'Demographic Distribution & Attendance by Gender', data);

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Gender Demographics & Monthly Footfall Summary', M, 26);

    const genderRows = data.genderAnalytics.counts.map((g, idx) => {
      const att = data.genderAnalytics.attendanceByGender[idx]?.attendance || 0;
      return [
        g.gender,
        String(g.count),
        `${g.percentage}%`,
        `${att} check-ins`
      ];
    });

    autoTable(doc, {
      startY: 29,
      head: [['Gender Category', 'Enrolled Members', 'Share Percentage', 'Monthly Footfall Check-ins']],
      body: genderRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8.5, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 4, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 60, halign: 'center' }, 2: { cellWidth: 60, halign: 'center' }, 3: { cellWidth: 88, halign: 'center' } },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    // KPI Tiles
    data.genderAnalytics.counts.forEach((g, idx) => {
      const x = M + idx * 140;
      drawKpiCard(doc, `${g.gender} Members`, `${g.count} Members`, `${g.percentage}% of Total Gym Members`, x, 75, 133, 26, idx === 0 ? PDF_COLORS.BLUE_MAIN : PDF_COLORS.PURPLE);
    });

    addPageFooter(doc, 4, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 5: Package Analytics
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 5 — Package Analytics', 'Package Distribution & Revenue Contribution', data);

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Package Subscription Share & Revenue Realization', M, 26);

    const pkgRows = data.packageAnalytics.packageTable.map(p => [
      p.name,
      String(p.members),
      `₹${p.revenue.toLocaleString('en-IN')}`,
      p.avgDuration
    ]);

    autoTable(doc, {
      startY: 29,
      head: [['Package Name', 'Enrolled Members', 'Revenue Contribution (₹)', 'Plan Duration']],
      body: pkgRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8.5, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 4, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 55, halign: 'center' }, 2: { cellWidth: 75, halign: 'right' }, 3: { cellWidth: 63, halign: 'center' } },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 5, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 6: Personal Training (PT)
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 6 — Personal Training (PT)', 'PT Enrolment, Gender Split & Top Performing Trainers', data);

    // KPI Cards
    drawKpiCard(doc, 'Total PT Clients', data.ptAnalytics.totalPTClients, 'Active & Completed', M, 25, 63, 25, PDF_COLORS.PURPLE);
    drawKpiCard(doc, 'Male PT Clients', data.ptAnalytics.malePTClients, 'Gents Training', M + 70, 25, 63, 25, PDF_COLORS.BLUE_MAIN);
    drawKpiCard(doc, 'Female PT Clients', data.ptAnalytics.femalePTClients, 'Ladies Training', M + 140, 25, 63, 25, PDF_COLORS.AMBER);
    drawKpiCard(doc, 'Active PT Plans', data.ptAnalytics.activePT, 'Ongoing Sessions', M + 210, 25, 63, 25, PDF_COLORS.GREEN);

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Top Trainers by Active PT Client Load', M, 58);

    const trainerRows = data.ptAnalytics.topTrainers.map(t => [
      t.name,
      String(t.clientCount),
      `₹${t.revenue.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: 61,
      head: [['Trainer Name', 'Active PT Clients', 'Generated PT Revenue (₹)']],
      body: trainerRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8.5, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3.5, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: 70, halign: 'center' }, 2: { cellWidth: 93, halign: 'right' } },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 6, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 7: Revenue Analysis
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 7 — Revenue Analysis', 'Financial Performance, Revenue Streams & Monthly Growth', data);

    // Large Hero KPI Card
    drawKpiCard(
      doc,
      'TOTAL REVENUE GENERATED',
      `₹${data.revenueAnalysis.totalRevenue.toLocaleString('en-IN')}`,
      'Realized Receipts for Evaluated Period',
      M,
      25,
      CW,
      26,
      PDF_COLORS.GREEN
    );

    // Revenue Sources Table
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('1. Revenue Stream Breakdown', M, 57);

    const sourceRows = data.revenueAnalysis.sources.map(s => [
      s.source,
      `₹${s.amount.toLocaleString('en-IN')}`,
      `${s.percentage}%`
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Revenue Source', 'Realized Revenue (₹)', 'Share %']],
      body: sourceRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 45, halign: 'right' }, 2: { cellWidth: 30, halign: 'center' } },
      margin: { left: M },
      theme: 'grid'
    });

    // Monthly Revenue Growth Table
    const rightX = M + 140;
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('2. Monthly Revenue Realization (₹)', rightX, 57);

    const monthRevRows = data.revenueAnalysis.monthlyRevenue.map(m => [
      m.month,
      `₹${m.amount.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: 60,
      head: [['Month', 'Amount (₹)']],
      body: monthRevRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 70, halign: 'right' } },
      margin: { left: rightX },
      theme: 'grid'
    });

    addPageFooter(doc, 7, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 8: Attendance Analytics & Peak Hour Heatmap
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 8 — Attendance Analytics', 'Daily Footfall, Weekly Summary & Peak Hour Heatmap', data);

    // Attendance KPIs Top Row
    drawKpiCard(doc, "Today's Attendance", data.attendanceAnalytics.todayCount, 'Check-ins Today', M, 25, 87, 24, PDF_COLORS.BLUE_MAIN);
    drawKpiCard(doc, 'Weekly Attendance', data.attendanceAnalytics.weeklyCount, 'Last 7 Days Footfall', M + 93, 25, 87, 24, PDF_COLORS.CYAN_ACCENT);
    drawKpiCard(doc, 'Monthly Attendance', data.attendanceAnalytics.monthlyCount, 'Total Monthly Punch Logs', M + 186, 25, 87, 24, PDF_COLORS.PURPLE);

    // Peak Hour Table
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Hourly Footfall Breakdown (06:00 AM – 09:00 PM)', M, 55);

    const peakRows = data.attendanceAnalytics.peakHoursHeatmap.map(p => [
      p.hour,
      String(p.count),
      p.count >= 70 ? 'Peak (High)' : p.count >= 40 ? 'Moderate' : 'Light'
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['Time Window', 'Check-ins Count', 'Footfall Intensity']],
      body: peakRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 7.5, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 2.5, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 90, halign: 'center' }, 2: { cellWidth: 93, halign: 'center' } },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 8, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 9: Top Members Spotlight
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 9 — Top Members Spotlight', 'Recognizing Most Frequent & Dedicated Gym Members', data);

    const memberRows = data.topMembers.map(m => [
      m.name,
      m.memberId,
      m.packageName,
      m.joinDate,
      `${m.totalVisits} Check-ins`,
      m.lastVisit
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Member Name', 'Member ID', 'Package Name', 'Join Date', 'Total Visits', 'Last Visit']],
      body: memberRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3.5, font: 'Roboto' },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 35, halign: 'center' },
        2: { cellWidth: 55 },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 43, halign: 'center' },
        5: { cellWidth: 45, halign: 'center' }
      },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 9, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 10: Expiring Memberships
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 10 — Expiring Memberships', '30-Day Renewal Pipeline & Urgent Follow-up List', data);

    drawKpiCard(doc, 'Expiring in 7 Days', data.expiringMemberships.in7Days, 'Critical Follow-up', M, 25, 87, 24, PDF_COLORS.RED);
    drawKpiCard(doc, 'Expiring in 15 Days', data.expiringMemberships.in15Days, 'High Priority', M + 93, 25, 87, 24, PDF_COLORS.AMBER);
    drawKpiCard(doc, 'Expiring in 30 Days', data.expiringMemberships.in30Days, 'Renewal Pipeline', M + 186, 25, 87, 24, PDF_COLORS.BLUE_MAIN);

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Upcoming Expiration Registry', M, 55);

    const expiringRows = data.expiringMemberships.list.slice(0, 8).map(m => [
      m.name,
      m.phone,
      m.packageName,
      m.expiryDate,
      `${m.daysRemaining} Days`
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['Member Name', 'Phone Number', 'Current Package', 'Expiry Date', 'Days Remaining']],
      body: expiringRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3.5, font: 'Roboto' },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 50, halign: 'center' },
        2: { cellWidth: 60 },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 48, halign: 'center' }
      },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 10, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 11: Payment & Dues Report
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 11 — Payment & Dues Report', 'Paid Receipts, Outstanding Dues & Pending Invoices', data);

    drawKpiCard(doc, 'Paid Revenue', `₹${data.paymentReport.paidAmount.toLocaleString('en-IN')}`, 'Cleared Payments', M, 25, 87, 24, PDF_COLORS.GREEN);
    drawKpiCard(doc, 'Pending Dues', `₹${data.paymentReport.pendingAmount.toLocaleString('en-IN')}`, 'Awaiting Clearance', M + 93, 25, 87, 24, PDF_COLORS.AMBER);
    drawKpiCard(doc, 'Overdue Amount', `₹${data.paymentReport.overdueAmount.toLocaleString('en-IN')}`, 'Overdue Invoices', M + 186, 25, 87, 24, PDF_COLORS.RED);

    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('Pending & Outstanding Members Table', M, 55);

    const paymentRows = data.paymentReport.pendingMembersTable.map(p => [
      p.name,
      p.phone,
      `₹${p.amount.toLocaleString('en-IN')}`,
      p.dueDate,
      p.status
    ]);

    autoTable(doc, {
      startY: 58,
      head: [['Member Name', 'Phone Number', 'Outstanding Amount (₹)', 'Due Date', 'Status']],
      body: paymentRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3.5, font: 'Roboto' },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 50, halign: 'center' },
        2: { cellWidth: 58, halign: 'right' },
        3: { cellWidth: 50, halign: 'center' },
        4: { cellWidth: 50, halign: 'center' }
      },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 11, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 12: Trainer Performance Leaderboard
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 12 — Trainer Performance Leaderboard', 'Staff Productivity, Member Assignments & PT Revenue Generation', data);

    const trainerLeaderboardRows = data.trainerPerformance.trainers.map(t => [
      t.name,
      t.role,
      String(t.totalMembers),
      String(t.ptClients),
      String(t.sessionsCount),
      `₹${t.revenue.toLocaleString('en-IN')}`
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Trainer Name', 'Designated Role', 'Assigned Members', 'PT Clients', 'Sessions Conducted', 'Generated Revenue (₹)']],
      body: trainerLeaderboardRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8.5, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3.5, font: 'Roboto' },
      columnStyles: {
        0: { cellWidth: 65 },
        1: { cellWidth: 45 },
        2: { cellWidth: 38, halign: 'center' },
        3: { cellWidth: 35, halign: 'center' },
        4: { cellWidth: 40, halign: 'center' },
        5: { cellWidth: 50, halign: 'right' }
      },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 12, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 13: Member Demographics
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 13 — Member Demographics', 'Age Distribution, Occupation Insights & Area Spread', data);

    // Age Groups (Left)
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('1. Age Group Breakdown', M, 26);

    const ageRows = data.demographics.ageGroups.map(a => [
      a.group,
      String(a.count),
      `${Math.round((a.count / (data.kpis.totalMembers || 1)) * 100)}%`
    ]);

    autoTable(doc, {
      startY: 29,
      head: [['Age Bracket', 'Members Count', 'Share %']],
      body: ageRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 50 }, 1: { cellWidth: 40, halign: 'center' }, 2: { cellWidth: 35, halign: 'center' } },
      margin: { left: M },
      theme: 'grid'
    });

    // Occupations (Right)
    const rightX = M + 140;
    doc.setTextColor(...PDF_COLORS.NAVY_DARK);
    doc.setFontSize(9.5);
    doc.setFont('Roboto', 'bold');
    doc.text('2. Occupation Profiles', rightX, 26);

    const occRows = data.demographics.occupations.map(o => [
      o.occupation,
      String(o.count)
    ]);

    autoTable(doc, {
      startY: 29,
      head: [['Occupation Industry', 'Members Count']],
      body: occRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 8, font: 'Roboto' },
      bodyStyles: { fontSize: 8, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 3, font: 'Roboto' },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 43, halign: 'center' } },
      margin: { left: rightX },
      theme: 'grid'
    });

    addPageFooter(doc, 13, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 14: Member List (Paginated Table)
  // -------------------------------------------------------------------
  {
    doc.addPage();
    addPageHeader(doc, 'Page 14 — Member Master List', 'Comprehensive Registry of Enrolled Gym Members', data);

    const memberListRows = data.memberList.slice(0, 15).map(m => [
      m.memberId,
      m.name,
      m.gender,
      String(m.age),
      m.phone,
      m.packageName,
      m.status,
      m.ptStatus,
      m.expiryDate,
      `${m.attendancePercent}%`
    ]);

    autoTable(doc, {
      startY: 25,
      head: [['Member ID', 'Full Name', 'Gender', 'Age', 'Phone', 'Package', 'Status', 'PT', 'Expiry', 'Att %']],
      body: memberListRows,
      headStyles: { fillColor: PDF_COLORS.NAVY_DARK, textColor: PDF_COLORS.WHITE, fontStyle: 'bold', fontSize: 7.5, font: 'Roboto' },
      bodyStyles: { fontSize: 7, textColor: PDF_COLORS.TEXT_MAIN, cellPadding: 2.5, font: 'Roboto' },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        1: { cellWidth: 48 },
        2: { cellWidth: 18, halign: 'center' },
        3: { cellWidth: 14, halign: 'center' },
        4: { cellWidth: 32, halign: 'center' },
        5: { cellWidth: 42 },
        6: { cellWidth: 22, halign: 'center' },
        7: { cellWidth: 22, halign: 'center' },
        8: { cellWidth: 27, halign: 'center' },
        9: { cellWidth: 24, halign: 'center' }
      },
      margin: { left: M, right: M },
      theme: 'grid'
    });

    addPageFooter(doc, 14, totalPages, data);
  }

  // -------------------------------------------------------------------
  // PAGE 15: Closing & QR Code Page
  // -------------------------------------------------------------------
  {
    doc.addPage();

    // Dark Background
    doc.setFillColor(...PDF_COLORS.NAVY_DARK);
    doc.rect(0, 0, PW, PH, 'F');

    // Bottom Accent Bar
    doc.setFillColor(...PDF_COLORS.BLUE_MAIN);
    doc.rect(0, PH - 15, PW, 15, 'F');

    // Title Headline
    doc.setTextColor(...PDF_COLORS.WHITE);
    doc.setFontSize(32);
    doc.setFont('Roboto', 'bold');
    doc.text('THANK YOU', PW / 2, 35, { align: 'center' });

    doc.setTextColor(...PDF_COLORS.CYAN_ACCENT);
    doc.setFontSize(12);
    doc.setFont('Roboto', 'bold');
    doc.text(`${data.gymInfo.name.toUpperCase()} — EXECUTIVE REPORT COMPLETE`, PW / 2, 48, { align: 'center' });

    // Generate Dynamic QR Code URL to fusionfit.vercel.app
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL('https://fusionfit.vercel.app', {
        margin: 1,
        width: 250,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      });
    } catch (e) {
      console.error('Failed to generate QR code for PDF:', e);
    }

    // QR Code Box (Centered)
    doc.setFillColor(...PDF_COLORS.NAVY_CARD);
    doc.setDrawColor(51, 65, 85);
    doc.setLineWidth(0.4);
    doc.roundedRect(88.5, 65, 120, 95, 3, 3, 'FD');

    if (qrDataUrl) {
      doc.addImage(qrDataUrl, 'PNG', 123.5, 72, 50, 50);
      doc.setTextColor(...PDF_COLORS.CYAN_ACCENT);
      doc.setFontSize(9.5);
      doc.setFont('Roboto', 'bold');
      doc.text('Scan to Visit fusionfit.vercel.app', 148.5, 138, { align: 'center' });
    }

    // Footer inside Accent Bar
    doc.setTextColor(...PDF_COLORS.WHITE);
    doc.setFontSize(9);
    doc.setFont('Roboto', 'bold');
    doc.text(`${data.gymInfo.name} ERP | fusionfit.vercel.app | Presentation Ready Report`, M, PH - 6);

    doc.text('redix.in', PW - M, PH - 6, { align: 'right' });
  }

  return doc.output('blob');
}
