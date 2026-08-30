import pptxgen from 'pptxgenjs';
import QRCode from 'qrcode';
import { FullPPTXReportData } from './pptx-data';

// Color Palette Constants for Corporate Gym Theme
const COLORS = {
  NAVY_DARK: '0F172A',     // Primary Slate Navy (#0F172A)
  BLUE_MAIN: '2563EB',     // Corporate Blue (#2563EB)
  CYAN_ACCENT: '0EA5E9',   // Vivid Cyan Accent (#0EA5E9)
  BG_LIGHT: 'F8FAFC',      // Off-white canvas (#F8FAFC)
  CARD_BG: 'FFFFFF',       // Clean white card (#FFFFFF)
  CARD_BORDER: 'E2E8F0',   // Subtle border (#E2E8F0)
  TEXT_MAIN: '0F172A',     // Main text
  TEXT_MUTED: '64748B',    // Muted text
  WHITE: 'FFFFFF',
  GREEN: '10B981',
  RED: 'EF4444',
  AMBER: 'F59E0B',
  PURPLE: '8B5CF6',
};

// Common Slide Header Helper
function addSlideHeader(slide: any, title: string, subtitle: string, data: FullPPTXReportData) {
  // Top Accent Bar
  slide.addShape('rect', {
    x: 0,
    y: 0,
    w: '100%',
    h: 0.1,
    fill: { color: COLORS.BLUE_MAIN },
    line: { color: COLORS.BLUE_MAIN }
  });

  // Header Title
  slide.addText(title, {
    x: 0.5,
    y: 0.22,
    w: 8.5,
    h: 0.4,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.NAVY_DARK
  });

  // Subtitle / Period Badge
  slide.addText(subtitle, {
    x: 0.5,
    y: 0.62,
    w: 8.5,
    h: 0.25,
    fontSize: 10,
    fontFace: 'Arial',
    color: COLORS.TEXT_MUTED
  });

  // Gym Name Badge (Top Right)
  slide.addText(data.gymInfo.name.toUpperCase(), {
    x: 8.5,
    y: 0.22,
    w: 4.33,
    h: 0.3,
    fontSize: 11,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.BLUE_MAIN,
    align: 'right'
  });
}

// Common Slide Footer Helper with redix.in Watermark
function addSlideFooter(slide: any, slideNum: number, totalSlides: number, data: FullPPTXReportData) {
  // Footer Line
  slide.addShape('line', {
    x: 0.5,
    y: 6.85,
    w: 12.33,
    h: 0,
    line: { color: COLORS.CARD_BORDER, width: 1 }
  });

  // Confidentiality Text
  slide.addText(data.metadata.confidentialText, {
    x: 0.5,
    y: 6.95,
    w: 5.2,
    h: 0.3,
    fontSize: 8,
    fontFace: 'Arial',
    color: COLORS.TEXT_MUTED
  });

  // Generated Date & Time | fusionfit.vercel.app
  slide.addText(`Gen: ${data.metadata.generatedAt} | fusionfit.vercel.app`, {
    x: 5.5,
    y: 6.95,
    w: 3.5,
    h: 0.3,
    fontSize: 8,
    fontFace: 'Arial',
    color: COLORS.TEXT_MUTED,
    align: 'right'
  });

  // Page Number
  slide.addText(`Slide ${slideNum} of ${totalSlides}`, {
    x: 9.0,
    y: 6.95,
    w: 1.8,
    h: 0.3,
    fontSize: 9,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.BLUE_MAIN,
    align: 'right'
  });

  // redix.in Watermark Hyperlink (Bottom Right Corner)
  slide.addText('redix.in', {
    x: 10.9,
    y: 6.95,
    w: 1.93,
    h: 0.3,
    fontSize: 8.5,
    fontFace: 'Arial',
    bold: true,
    italic: true,
    color: COLORS.BLUE_MAIN,
    align: 'right',
    hyperlink: { url: 'https://redix.in' }
  });
}

// Helper to draw KPI Card
function addKPICard(
  slide: any,
  title: string,
  value: string | number,
  subtitle: string,
  x: number,
  y: number,
  w: number,
  h: number,
  accentColor: string = COLORS.BLUE_MAIN
) {
  // Card Container Box
  slide.addShape('rect', {
    x,
    y,
    w,
    h,
    fill: { color: COLORS.CARD_BG },
    line: { color: COLORS.CARD_BORDER, width: 1 }
  });

  // Left Accent Pillar
  slide.addShape('rect', {
    x,
    y,
    w: 0.1,
    h,
    fill: { color: accentColor },
    line: { color: accentColor }
  });

  // Title
  slide.addText(title.toUpperCase(), {
    x: x + 0.2,
    y: y + 0.15,
    w: w - 0.3,
    h: 0.25,
    fontSize: 9.5,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.TEXT_MUTED
  });

  // Metric Value
  slide.addText(String(value), {
    x: x + 0.2,
    y: y + 0.4,
    w: w - 0.3,
    h: 0.5,
    fontSize: 20,
    fontFace: 'Arial',
    bold: true,
    color: COLORS.NAVY_DARK
  });

  // Subtitle / Indicator
  slide.addText(subtitle, {
    x: x + 0.2,
    y: y + 0.9,
    w: w - 0.3,
    h: 0.2,
    fontSize: 8.5,
    fontFace: 'Arial',
    color: accentColor
  });
}

// ── Helper to format PPTX Table Header & Cell Rows ─────────────────────
function formatTableData(headers: string[], rowsData: (string | number)[][]) {
  const formattedHeader = headers.map(text => ({
    text,
    options: {
      fill: { color: COLORS.NAVY_DARK },
      color: COLORS.WHITE,
      bold: true,
      fontSize: 9.5,
      fontFace: 'Arial',
      align: 'center' as const
    }
  }));

  const formattedRows = rowsData.map(row =>
    row.map(cell => ({
      text: String(cell),
      options: {
        fontSize: 9,
        fontFace: 'Arial',
        color: COLORS.NAVY_DARK,
        align: 'center' as const
      }
    }))
  );

  return [formattedHeader, ...formattedRows] as any;
}

// ── Main Presentation Generator Function ─────────────────────────────
export async function generatePowerPointReport(data: FullPPTXReportData): Promise<Blob> {
  const pres = new pptxgen();

  // Explicit Widescreen 16:9 HD layout (13.333 x 7.5 inches)
  pres.defineLayout({ name: 'LAYOUT_16x9_HD', width: 13.333, height: 7.5 });
  pres.layout = 'LAYOUT_16x9_HD';

  pres.title = `${data.gymInfo.name} Executive PowerPoint Report`;
  pres.author = data.metadata.generatedBy;
  pres.company = data.gymInfo.name;

  const totalSlides = 15;

  // -------------------------------------------------------------------
  // SLIDE 1: Cover Page
  // -------------------------------------------------------------------
  {
    const slide1 = pres.addSlide();
    // Background Dark Slate Navy
    slide1.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
      fill: { color: COLORS.NAVY_DARK }
    });

    // Decorative Left Accent Bar
    slide1.addShape('rect', {
      x: 0,
      y: 0,
      w: 0.35,
      h: '100%',
      fill: { color: COLORS.BLUE_MAIN }
    });

    slide1.addShape('rect', {
      x: 0.35,
      y: 0,
      w: 0.08,
      h: '100%',
      fill: { color: COLORS.CYAN_ACCENT }
    });

    // Gym Name & Badge
    slide1.addText(data.gymInfo.name.toUpperCase(), {
      x: 0.8,
      y: 0.8,
      w: 11.7,
      h: 0.4,
      fontSize: 16,
      fontFace: 'Arial',
      bold: true,
      color: COLORS.CYAN_ACCENT,
      charSpacing: 2
    });

    // Main Report Title
    slide1.addText(data.metadata.reportTitle, {
      x: 0.8,
      y: 1.4,
      w: 11.7,
      h: 1.4,
      fontSize: 32,
      fontFace: 'Arial',
      bold: true,
      color: COLORS.WHITE
    });

    // Subtitle / Tagline
    slide1.addText('Comprehensive Business Intelligence, Member Analytics & Revenue Performance', {
      x: 0.8,
      y: 2.9,
      w: 11.7,
      h: 0.4,
      fontSize: 13,
      fontFace: 'Arial',
      color: '94A3B8'
    });

    // Details Grid Card (Bottom Area)
    slide1.addShape('rect', {
      x: 0.8,
      y: 3.6,
      w: 11.73,
      h: 2.8,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 }
    });

    const metaItems = [
      { label: 'REPORT PERIOD', val: data.metadata.periodLabel },
      { label: 'GENERATED ON', val: data.metadata.generatedAt },
      { label: 'GENERATED BY', val: data.metadata.generatedBy },
      { label: 'PORTAL / WEBSITE', val: 'fusionfit.vercel.app' }
    ];

    metaItems.forEach((item, idx) => {
      const col = idx % 2;
      const row = Math.floor(idx / 2);
      const mx = 1.2 + col * 5.8;
      const my = 3.9 + row * 1.1;

      slide1.addText(item.label, {
        x: mx,
        y: my,
        w: 5.2,
        h: 0.25,
        fontSize: 9,
        fontFace: 'Arial',
        bold: true,
        color: COLORS.CYAN_ACCENT
      });

      slide1.addText(item.val, {
        x: mx,
        y: my + 0.28,
        w: 5.2,
        h: 0.4,
        fontSize: 13,
        fontFace: 'Arial',
        bold: true,
        color: COLORS.WHITE
      });
    });

    // Confidentiality Footer
    slide1.addText(data.metadata.confidentialText, {
      x: 0.8,
      y: 6.9,
      w: 9.0,
      h: 0.3,
      fontSize: 8.5,
      fontFace: 'Arial',
      color: COLORS.TEXT_MUTED
    });

    // redix.in Watermark Hyperlink (Bottom Right)
    slide1.addText('redix.in', {
      x: 10.8,
      y: 6.9,
      w: 1.73,
      h: 0.3,
      fontSize: 8.5,
      fontFace: 'Arial',
      bold: true,
      italic: true,
      color: COLORS.CYAN_ACCENT,
      align: 'right',
      hyperlink: { url: 'https://redix.in' }
    });
  }

  // -------------------------------------------------------------------
  // SLIDE 2: Executive Dashboard (10 KPI Cards)
  // -------------------------------------------------------------------
  {
    const slide2 = pres.addSlide();
    addSlideHeader(slide2, 'Slide 2 — Executive Dashboard', 'Key Business Performance Indicators at a Glance', data);

    const kpis = [
      { title: 'Total Members', val: data.kpis.totalMembers, sub: 'Registered DB', color: COLORS.BLUE_MAIN },
      { title: 'Active Members', val: data.kpis.activeMembers, sub: `${Math.round((data.kpis.activeMembers / data.kpis.totalMembers) * 100)}% Active Ratio`, color: COLORS.GREEN },
      { title: 'Expired Members', val: data.kpis.expiredMembers, sub: 'Needs Renewal', color: COLORS.RED },
      { title: 'Frozen Members', val: data.kpis.frozenMembers, sub: 'On Hold', color: COLORS.AMBER },
      { title: 'New Members', val: `+${data.kpis.newMembersPeriod}`, sub: 'Joined This Period', color: COLORS.CYAN_ACCENT },
      { title: 'Renewals', val: data.kpis.renewalsPeriod, sub: 'Successful Renewals', color: COLORS.GREEN },
      { title: 'Today Attendance', val: data.kpis.todayAttendance, sub: 'Check-ins Today', color: COLORS.PURPLE },
      { title: 'Total Revenue', val: `₹${(data.kpis.totalRevenuePeriod / 1000).toFixed(0)}k`, sub: 'Realized Revenue', color: COLORS.BLUE_MAIN },
      { title: 'Pending Dues', val: `₹${(data.kpis.pendingPaymentsAmount / 1000).toFixed(0)}k`, sub: 'Outstanding Dues', color: COLORS.RED },
      { title: 'PT Clients', val: data.kpis.ptClientsCount, sub: 'Personal Training', color: COLORS.PURPLE }
    ];

    // Grid: 5 columns x 2 rows cleanly fitting within 13.333" x 7.5"
    kpis.forEach((kpi, idx) => {
      const col = idx % 5;
      const row = Math.floor(idx / 5);
      const x = 0.5 + col * 2.5;
      const y = 1.15 + row * 2.7;
      addKPICard(slide2, kpi.title, kpi.val, kpi.sub, x, y, 2.30, 2.45, kpi.color);
    });

    addSlideFooter(slide2, 2, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 3: Membership Overview
  // -------------------------------------------------------------------
  {
    const slide3 = pres.addSlide();
    addSlideHeader(slide3, 'Slide 3 — Membership Overview', 'Status Breakdown, Join Trends & Renewal Performance', data);

    // Pie Chart: Status Breakdown
    const pieData = [
      {
        name: 'Member Status',
        labels: data.membershipOverview.statusCounts.map(s => s.name),
        values: data.membershipOverview.statusCounts.map(s => s.count)
      }
    ];
    slide3.addChart(pres.ChartType.pie, pieData, {
      x: 0.5,
      y: 1.1,
      w: 5.9,
      h: 3.1,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Member Status Distribution',
      chartColors: [COLORS.GREEN, COLORS.RED, COLORS.AMBER, COLORS.TEXT_MUTED]
    });

    // Bar Chart: Monthly Join Trend
    const barData = [
      {
        name: 'New Joins',
        labels: data.membershipOverview.monthlyJoinTrend.map(t => t.month),
        values: data.membershipOverview.monthlyJoinTrend.map(t => t.joins)
      },
      {
        name: 'Renewals',
        labels: data.membershipOverview.monthlyJoinTrend.map(t => t.month),
        values: data.membershipOverview.monthlyJoinTrend.map(t => t.renewals)
      }
    ];
    slide3.addChart(pres.ChartType.bar, barData, {
      x: 6.8,
      y: 1.1,
      w: 6.03,
      h: 3.1,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Monthly New Joins & Renewals Trend',
      chartColors: [COLORS.BLUE_MAIN, COLORS.GREEN]
    });

    // Table: Monthly Breakdown
    const headers = ['Month', 'New Members', 'Renewals', 'Expired Members'];
    const rows = data.membershipOverview.monthlyJoinTrend.map(t => [
      t.month,
      t.joins,
      t.renewals,
      t.expired
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide3.addTable(formattedTable, {
      x: 0.5,
      y: 4.4,
      w: 12.33,
      colW: [3.0, 3.1, 3.1, 3.13],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    addSlideFooter(slide3, 3, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 4: Gender Analytics
  // -------------------------------------------------------------------
  {
    const slide4 = pres.addSlide();
    addSlideHeader(slide4, 'Slide 4 — Gender Analytics', 'Demographic Distribution & Attendance by Gender', data);

    // Pie Chart: Gender Distribution
    const genderPieData = [
      {
        name: 'Gender',
        labels: data.genderAnalytics.counts.map(g => `${g.gender} (${g.percentage}%)`),
        values: data.genderAnalytics.counts.map(g => g.count)
      }
    ];
    slide4.addChart(pres.ChartType.pie, genderPieData, {
      x: 0.5,
      y: 1.1,
      w: 5.9,
      h: 3.3,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Gender Distribution Ratio',
      chartColors: [COLORS.BLUE_MAIN, COLORS.PURPLE]
    });

    // Bar Chart: Attendance by Gender
    const genderAttData = [
      {
        name: 'Attendance',
        labels: data.genderAnalytics.attendanceByGender.map(a => a.gender),
        values: data.genderAnalytics.attendanceByGender.map(a => a.attendance)
      }
    ];
    slide4.addChart(pres.ChartType.bar, genderAttData, {
      x: 6.8,
      y: 1.1,
      w: 6.03,
      h: 3.3,
      showLegend: false,
      showTitle: true,
      title: 'Monthly Attendance Check-ins by Gender',
      chartColors: [COLORS.CYAN_ACCENT]
    });

    // KPI Summary Tiles (Bottom)
    data.genderAnalytics.counts.forEach((g, idx) => {
      const x = 0.5 + idx * 6.3;
      addKPICard(slide4, `${g.gender} Members`, `${g.count} Members`, `${g.percentage}% of Total Gym Members`, x, 4.6, 6.03, 1.9, idx === 0 ? COLORS.BLUE_MAIN : COLORS.PURPLE);
    });

    addSlideFooter(slide4, 4, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 5: Package Analytics
  // -------------------------------------------------------------------
  {
    const slide5 = pres.addSlide();
    addSlideHeader(slide5, 'Slide 5 — Package Analytics', 'Package Distribution & Revenue Contribution', data);

    // Pie Chart: Distribution of packages purchased
    const pkgPie = [
      {
        name: 'Packages',
        labels: data.packageAnalytics.packageDistribution.map(p => p.name),
        values: data.packageAnalytics.packageDistribution.map(p => p.membersCount)
      }
    ];
    slide5.addChart(pres.ChartType.pie, pkgPie, {
      x: 0.5,
      y: 1.1,
      w: 5.8,
      h: 5.3,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Package Subscription Share',
      chartColors: [COLORS.BLUE_MAIN, COLORS.CYAN_ACCENT, COLORS.PURPLE, COLORS.GREEN, COLORS.AMBER]
    });

    // Table: Package Breakdown
    const headers = ['Package Name', 'Enrolled Members', 'Revenue (₹)', 'Average Duration'];
    const rows = data.packageAnalytics.packageTable.map(p => [
      p.name,
      p.members,
      `₹${p.revenue.toLocaleString('en-IN')}`,
      p.avgDuration
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide5.addTable(formattedTable, {
      x: 6.6,
      y: 1.1,
      w: 6.23,
      colW: [2.2, 1.3, 1.4, 1.33],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    addSlideFooter(slide5, 5, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 6: Personal Training (PT)
  // -------------------------------------------------------------------
  {
    const slide6 = pres.addSlide();
    addSlideHeader(slide6, 'Slide 6 — Personal Training (PT)', 'PT Enrolment, Gender Split & Top Performing Trainers', data);

    // Top KPIs Row
    addKPICard(slide6, 'Total PT Clients', data.ptAnalytics.totalPTClients, 'Active & Completed', 0.5, 1.1, 2.88, 1.6, COLORS.PURPLE);
    addKPICard(slide6, 'Male PT Clients', data.ptAnalytics.malePTClients, 'Gents Training', 3.65, 1.1, 2.88, 1.6, COLORS.BLUE_MAIN);
    addKPICard(slide6, 'Female PT Clients', data.ptAnalytics.femalePTClients, 'Ladies Training', 6.8, 1.1, 2.88, 1.6, COLORS.AMBER);
    addKPICard(slide6, 'Active PT Plans', data.ptAnalytics.activePT, 'Ongoing Sessions', 9.95, 1.1, 2.88, 1.6, COLORS.GREEN);

    // Pie Chart: PT Male vs Female
    const ptPie = [
      {
        name: 'PT Gender',
        labels: data.ptAnalytics.genderPie.map(g => g.gender),
        values: data.ptAnalytics.genderPie.map(g => g.count)
      }
    ];
    slide6.addChart(pres.ChartType.pie, ptPie, {
      x: 0.5,
      y: 2.9,
      w: 5.9,
      h: 3.7,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'PT Client Gender Breakdown',
      chartColors: [COLORS.BLUE_MAIN, COLORS.AMBER]
    });

    // Bar Chart: Top Trainers by PT Clients
    const trainerBar = [
      {
        name: 'PT Clients',
        labels: data.ptAnalytics.topTrainers.map(t => t.name),
        values: data.ptAnalytics.topTrainers.map(t => t.clientCount)
      }
    ];
    slide6.addChart(pres.ChartType.bar, trainerBar, {
      x: 6.8,
      y: 2.9,
      w: 6.03,
      h: 3.7,
      showLegend: false,
      showTitle: true,
      title: 'Top Trainers by Active PT Clients',
      chartColors: [COLORS.PURPLE]
    });

    addSlideFooter(slide6, 6, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 7: Revenue Analysis
  // -------------------------------------------------------------------
  {
    const slide7 = pres.addSlide();
    addSlideHeader(slide7, 'Slide 7 — Revenue Analysis', 'Financial Performance, Revenue Streams & Monthly Growth', data);

    // Large Hero KPI Card
    addKPICard(slide7, 'TOTAL REVENUE GENERATED', `₹${data.revenueAnalysis.totalRevenue.toLocaleString('en-IN')}`, 'Realized Receipts for Evaluated Period', 0.5, 1.1, 12.33, 1.5, COLORS.GREEN);

    // Pie Chart: Revenue Sources
    const revPie = [
      {
        name: 'Sources',
        labels: data.revenueAnalysis.sources.map(s => s.source),
        values: data.revenueAnalysis.sources.map(s => s.amount)
      }
    ];
    slide7.addChart(pres.ChartType.pie, revPie, {
      x: 0.5,
      y: 2.8,
      w: 5.9,
      h: 3.8,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Revenue Stream Breakdown',
      chartColors: [COLORS.GREEN, COLORS.BLUE_MAIN, COLORS.CYAN_ACCENT, COLORS.PURPLE]
    });

    // Bar Chart: Monthly Revenue
    const revBar = [
      {
        name: 'Revenue (₹)',
        labels: data.revenueAnalysis.monthlyRevenue.map(m => m.month),
        values: data.revenueAnalysis.monthlyRevenue.map(m => m.amount)
      }
    ];
    slide7.addChart(pres.ChartType.bar, revBar, {
      x: 6.8,
      y: 2.8,
      w: 6.03,
      h: 3.8,
      showLegend: false,
      showTitle: true,
      title: 'Monthly Revenue Realization (₹)',
      chartColors: [COLORS.BLUE_MAIN]
    });

    addSlideFooter(slide7, 7, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 8: Attendance Analytics & Peak Hour Heatmap
  // -------------------------------------------------------------------
  {
    const slide8 = pres.addSlide();
    addSlideHeader(slide8, 'Slide 8 — Attendance Analytics', 'Daily Footfall, Weekly Summary & Peak Hour Heatmap', data);

    // Attendance KPIs Top Row
    addKPICard(slide8, "Today's Attendance", data.attendanceAnalytics.todayCount, 'Check-ins Today', 0.5, 1.1, 3.93, 1.6, COLORS.BLUE_MAIN);
    addKPICard(slide8, 'Weekly Attendance', data.attendanceAnalytics.weeklyCount, 'Last 7 Days Footfall', 4.7, 1.1, 3.93, 1.6, COLORS.CYAN_ACCENT);
    addKPICard(slide8, 'Monthly Attendance', data.attendanceAnalytics.monthlyCount, 'Total Monthly Punch Logs', 8.9, 1.1, 3.93, 1.6, COLORS.PURPLE);

    // Peak Hour Heatmap (Hourly Bar Chart)
    const peakChart = [
      {
        name: 'Check-ins',
        labels: data.attendanceAnalytics.peakHoursHeatmap.map(p => p.hour),
        values: data.attendanceAnalytics.peakHoursHeatmap.map(p => p.count)
      }
    ];
    slide8.addChart(pres.ChartType.bar, peakChart, {
      x: 0.5,
      y: 2.9,
      w: 12.33,
      h: 3.7,
      showLegend: false,
      showTitle: true,
      title: 'Peak Hour Footfall Heatmap (Hourly Check-ins 06:00 AM – 09:00 PM)',
      chartColors: [COLORS.BLUE_MAIN]
    });

    addSlideFooter(slide8, 8, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 9: Top Members Spotlight
  // -------------------------------------------------------------------
  {
    const slide9 = pres.addSlide();
    addSlideHeader(slide9, 'Slide 9 — Top Members Spotlight', 'Recognizing Most Frequent & Dedicated Gym Members', data);

    const headers = ['Member Name', 'Member ID', 'Package', 'Join Date', 'Total Visits', 'Last Visit'];
    const rows = data.topMembers.map(m => [
      m.name,
      m.memberId,
      m.packageName,
      m.joinDate,
      `${m.totalVisits} Check-ins`,
      m.lastVisit
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide9.addTable(formattedTable, {
      x: 0.5,
      y: 1.2,
      w: 12.33,
      colW: [2.6, 1.8, 2.5, 1.8, 1.83, 1.8],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    addSlideFooter(slide9, 9, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 10: Expiring Memberships
  // -------------------------------------------------------------------
  {
    const slide10 = pres.addSlide();
    addSlideHeader(slide10, 'Slide 10 — Expiring Memberships', '30-Day Renewal Pipeline & Urgent Follow-up List', data);

    // KPI Cards
    addKPICard(slide10, 'Expiring in 7 Days', data.expiringMemberships.in7Days, 'Critical Follow-up', 0.5, 1.1, 3.93, 1.6, COLORS.RED);
    addKPICard(slide10, 'Expiring in 15 Days', data.expiringMemberships.in15Days, 'High Priority', 4.7, 1.1, 3.93, 1.6, COLORS.AMBER);
    addKPICard(slide10, 'Expiring in 30 Days', data.expiringMemberships.in30Days, 'Renewal Pipeline', 8.9, 1.1, 3.93, 1.6, COLORS.BLUE_MAIN);

    // Table
    const headers = ['Member Name', 'Phone Number', 'Current Package', 'Expiry Date', 'Days Remaining'];
    const rows = data.expiringMemberships.list.slice(0, 8).map(m => [
      m.name,
      m.phone,
      m.packageName,
      m.expiryDate,
      `${m.daysRemaining} Days`
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide10.addTable(formattedTable, {
      x: 0.5,
      y: 2.9,
      w: 12.33,
      colW: [2.8, 2.4, 2.7, 2.3, 2.13],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    addSlideFooter(slide10, 10, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 11: Payment Report
  // -------------------------------------------------------------------
  {
    const slide11 = pres.addSlide();
    addSlideHeader(slide11, 'Slide 11 — Payment & Dues Report', 'Paid Receipts, Outstanding Dues & Pending Invoices', data);

    // KPIs Top Row
    addKPICard(slide11, 'Paid Revenue', `₹${data.paymentReport.paidAmount.toLocaleString('en-IN')}`, 'Cleared Payments', 0.5, 1.1, 3.93, 1.6, COLORS.GREEN);
    addKPICard(slide11, 'Pending Dues', `₹${data.paymentReport.pendingAmount.toLocaleString('en-IN')}`, 'Awaiting Clearance', 4.7, 1.1, 3.93, 1.6, COLORS.AMBER);
    addKPICard(slide11, 'Overdue Amount', `₹${data.paymentReport.overdueAmount.toLocaleString('en-IN')}`, 'Overdue Invoices', 8.9, 1.1, 3.93, 1.6, COLORS.RED);

    // Table of Pending Dues
    const headers = ['Member Name', 'Phone Number', 'Outstanding Amount (₹)', 'Due Date', 'Status'];
    const rows = data.paymentReport.pendingMembersTable.map(p => [
      p.name,
      p.phone,
      `₹${p.amount.toLocaleString('en-IN')}`,
      p.dueDate,
      p.status
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide11.addTable(formattedTable, {
      x: 0.5,
      y: 2.9,
      w: 12.33,
      colW: [2.8, 2.4, 2.7, 2.3, 2.13],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    addSlideFooter(slide11, 11, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 12: Trainer Performance Leaderboard
  // -------------------------------------------------------------------
  {
    const slide12 = pres.addSlide();
    addSlideHeader(slide12, 'Slide 12 — Trainer Performance Leaderboard', 'Staff Productivity, Member Assignments & PT Revenue Generation', data);

    // Table of Trainers
    const headers = ['Trainer Name', 'Role', 'Members', 'PT Clients', 'Sessions', 'Revenue (₹)'];
    const rows = data.trainerPerformance.trainers.map(t => [
      t.name,
      t.role,
      t.totalMembers,
      t.ptClients,
      t.sessionsCount,
      `₹${t.revenue.toLocaleString('en-IN')}`
    ]);

    const formattedTable = formatTableData(headers, rows);
    slide12.addTable(formattedTable, {
      x: 0.5,
      y: 1.2,
      w: 6.3,
      colW: [1.7, 1.0, 0.9, 0.8, 0.9, 1.0],
      border: { pt: 1, color: COLORS.CARD_BORDER },
      fill: { color: COLORS.CARD_BG }
    });

    // Bar Chart: Top Trainers Revenue Ranking
    const trainerRevBar = [
      {
        name: 'Revenue (₹)',
        labels: data.trainerPerformance.topTrainersBar.map(t => t.name),
        values: data.trainerPerformance.topTrainersBar.map(t => t.revenue)
      }
    ];
    slide12.addChart(pres.ChartType.bar, trainerRevBar, {
      x: 7.1,
      y: 1.2,
      w: 5.73,
      h: 5.4,
      showLegend: false,
      showTitle: true,
      title: 'Trainer Revenue Ranking (₹)',
      chartColors: [COLORS.BLUE_MAIN]
    });

    addSlideFooter(slide12, 12, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 13: Member Demographics
  // -------------------------------------------------------------------
  {
    const slide13 = pres.addSlide();
    addSlideHeader(slide13, 'Slide 13 — Member Demographics', 'Age Distribution, Occupation Insights & Area Spread', data);

    // Pie Chart: Age Groups
    const agePie = [
      {
        name: 'Age Groups',
        labels: data.demographics.ageGroups.map(a => a.group),
        values: data.demographics.ageGroups.map(a => a.count)
      }
    ];
    slide13.addChart(pres.ChartType.pie, agePie, {
      x: 0.5,
      y: 1.2,
      w: 5.9,
      h: 5.4,
      showLegend: true,
      legendPos: 'b',
      showTitle: true,
      title: 'Age Group Distribution',
      chartColors: [COLORS.BLUE_MAIN, COLORS.CYAN_ACCENT, COLORS.PURPLE, COLORS.GREEN, COLORS.AMBER]
    });

    // Bar Chart: Occupations
    const occBar = [
      {
        name: 'Members',
        labels: data.demographics.occupations.map(o => o.occupation),
        values: data.demographics.occupations.map(o => o.count)
      }
    ];
    slide13.addChart(pres.ChartType.bar, occBar, {
      x: 6.8,
      y: 1.2,
      w: 6.03,
      h: 5.4,
      showLegend: false,
      showTitle: true,
      title: 'Member Occupation Profiles',
      chartColors: [COLORS.CYAN_ACCENT]
    });

    addSlideFooter(slide13, 13, totalSlides, data);
  }

  // -------------------------------------------------------------------
  // SLIDE 14: Member List (With Auto-Pagination across slides)
  // -------------------------------------------------------------------
  {
    const rowsPerPage = 9;
    const memberItems = data.memberList;
    const totalMemberPages = Math.ceil(memberItems.length / rowsPerPage) || 1;

    for (let page = 0; page < totalMemberPages; page++) {
      const slide14 = pres.addSlide();
      const pageTitle = totalMemberPages > 1 
        ? `Slide 14 — Member Master List (Page ${page + 1} of ${totalMemberPages})`
        : 'Slide 14 — Member Master List';

      addSlideHeader(slide14, pageTitle, 'Comprehensive Registry of Active & Enrolled Gym Members', data);

      const headers = ['Member ID', 'Full Name', 'Gender', 'Age', 'Phone', 'Package', 'Status', 'PT Status', 'Expiry Date', 'Att %'];
      const pageItems = memberItems.slice(page * rowsPerPage, (page + 1) * rowsPerPage);

      const rows = pageItems.map(m => [
        m.memberId,
        m.name,
        m.gender,
        m.age,
        m.phone,
        m.packageName,
        m.status,
        m.ptStatus,
        m.expiryDate,
        `${m.attendancePercent}%`
      ]);

      const formattedTable = formatTableData(headers, rows);
      slide14.addTable(formattedTable, {
        x: 0.5,
        y: 1.2,
        w: 12.33,
        colW: [1.2, 2.0, 0.8, 0.6, 1.6, 1.8, 1.1, 1.1, 1.13, 1.0],
        border: { pt: 1, color: COLORS.CARD_BORDER },
        fill: { color: COLORS.CARD_BG }
      });

      addSlideFooter(slide14, 14, totalSlides, data);
    }
  }



  // -------------------------------------------------------------------
  // SLIDE 16: Closing Page
  // -------------------------------------------------------------------
  {
    const slide16 = pres.addSlide();

    // Dark Background Canvas
    slide16.addShape('rect', {
      x: 0,
      y: 0,
      w: '100%',
      h: '100%',
      fill: { color: COLORS.NAVY_DARK }
    });

    // Decorative Bottom Accent Bar
    slide16.addShape('rect', {
      x: 0,
      y: 6.7,
      w: '100%',
      h: 0.8,
      fill: { color: COLORS.BLUE_MAIN }
    });

    // Main Thank You Headline
    slide16.addText('THANK YOU', {
      x: 0.5,
      y: 0.8,
      w: 12.33,
      h: 0.9,
      fontSize: 42,
      fontFace: 'Arial',
      bold: true,
      color: COLORS.WHITE,
      align: 'center',
      charSpacing: 4
    });

    slide16.addText(`${data.gymInfo.name.toUpperCase()} — EXECUTIVE REPORT COMPLETE`, {
      x: 0.5,
      y: 1.8,
      w: 12.33,
      h: 0.4,
      fontSize: 13,
      fontFace: 'Arial',
      bold: true,
      color: COLORS.CYAN_ACCENT,
      align: 'center'
    });

    // Generate Dynamic QR Code URL to fusionfit.vercel.app
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL('https://fusionfit.vercel.app', {
        margin: 1,
        width: 250,
        color: { dark: '#0F172A', light: '#FFFFFF' }
      });
    } catch (e) {
      console.error('Failed to generate QR code for PPTX:', e);
    }

    // QR Code Card (Centered)
    slide16.addShape('rect', {
      x: 3.92,
      y: 2.6,
      w: 5.5,
      h: 3.4,
      fill: { color: '1E293B' },
      line: { color: '334155', width: 1 }
    });

    if (qrDataUrl) {
      slide16.addImage({
        data: qrDataUrl,
        x: 5.56,
        y: 2.85,
        w: 2.2,
        h: 2.2
      });

      slide16.addText('Scan to Visit fusionfit.vercel.app', {
        x: 3.92,
        y: 5.2,
        w: 5.5,
        h: 0.3,
        fontSize: 10,
        fontFace: 'Arial',
        bold: true,
        color: COLORS.CYAN_ACCENT,
        align: 'center'
      });
    }

    // Footer Text inside Blue Accent Bar
    slide16.addText(`${data.gymInfo.name} ERP | fusionfit.vercel.app | Presentation Ready Report`, {
      x: 0.5,
      y: 6.9,
      w: 9.5,
      h: 0.4,
      fontSize: 10,
      fontFace: 'Arial',
      bold: true,
      color: COLORS.WHITE,
      align: 'left'
    });

    // redix.in Watermark Hyperlink (Bottom Right inside bar)
    slide16.addText('redix.in', {
      x: 10.8,
      y: 6.9,
      w: 1.93,
      h: 0.4,
      fontSize: 10,
      fontFace: 'Arial',
      bold: true,
      italic: true,
      color: COLORS.WHITE,
      align: 'right',
      hyperlink: { url: 'https://redix.in' }
    });
  }

  // Export File as Blob
  const pptxBlob = (await pres.write({ outputType: 'blob' })) as Blob;
  return pptxBlob;
}
