import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PTClient, PTProgress, PTDailyWorkout, PTSession } from '@/types/pt';
import { GymSettings } from '@/types';
import { formatDate } from '@/lib/utils';
import { robotoRegular, robotoBold } from './robotoFonts';

export interface GeneratePTProgressPDFOptions {
  client: PTClient;
  progressLogs: PTProgress[];
  dailyWorkouts?: PTDailyWorkout[];
  sessions?: PTSession[];
  settings?: GymSettings;
}

// Helper to load image asynchronously in browser environment
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (url.startsWith('http') || url.startsWith('//')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export async function generatePTProgressPDF({
  client,
  progressLogs,
  dailyWorkouts = [],
  sessions = [],
  settings,
}: GeneratePTProgressPDFOptions): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Register Roboto fonts
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFileToVFS('Roboto-Bold.ttf', robotoBold);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  const PW = 210;
  const PH = 297;
  const M = 15; // 15mm margin
  const CW = PW - 2 * M; // 180mm printable width

  const gymName = settings?.gym_name || 'Fusion Fit Multi Gym';
  const gymAddress = settings?.gym_address || '123 Fitness Street, MG Road, Bangalore';
  const gymPhone = settings?.gym_phone || '+91 98765 43210';
  const gymEmail = settings?.gym_email || 'info@fusionfitgym.com';

  // Vector Logo Helper
  const drawGymLogo = (x: number, y: number, size: number) => {
    doc.setFillColor(212, 175, 55); // Premium Gold (#D4AF37)
    doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F');

    doc.setDrawColor(11, 13, 18); // Rich Black
    doc.setLineWidth(0.8);
    doc.line(x + 2.5, y + size - 2.5, x + size - 2.5, y + 2.5);

    doc.setFillColor(11, 13, 18);
    doc.circle(x + 2.5, y + size - 2.5, 1.2, 'F');
    doc.circle(x + size - 2.5, y + 2.5, 1.2, 'F');
    doc.circle(x + 3.7, y + size - 3.7, 0.9, 'F');
    doc.circle(x + size - 3.7, y + 3.7, 0.9, 'F');
  };

  // Status Badge Helper
  const drawStatusBadge = (x: number, y: number, status: string) => {
    let bg = [224, 242, 254];
    let text = [3, 105, 161];
    if (status === 'Active') {
      bg = [222, 247, 236]; // #DEF7EC
      text = [3, 84, 63]; // #03543F
    } else if (status === 'Expired') {
      bg = [253, 232, 232];
      text = [155, 28, 28];
    }
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y, 22, 6, 1.5, 1.5, 'F');

    doc.setTextColor(text[0], text[1], text[2]);
    doc.setFontSize(7.5);
    doc.setFont('Roboto', 'bold');
    doc.text(status.toUpperCase(), x + 11, y + 4.2, { align: 'center' });
  };

  // ── Header Section ─────────────────────────────────────────
  let y = 15;

  let logoImg: HTMLImageElement | null = null;
  if (settings?.gym_logo) {
    try {
      logoImg = await loadImage(settings.gym_logo);
    } catch {
      // fallback
    }
  }
  if (!logoImg) {
    try {
      logoImg = await loadImage('/Logo.jpeg');
    } catch {
      // fallback
    }
  }

  const logoSize = logoImg ? 20 : 12;
  if (logoImg) {
    try {
      doc.addImage(logoImg, 'JPEG', M, y, logoSize, logoSize);
    } catch {
      drawGymLogo(M, y, 12);
    }
  } else {
    drawGymLogo(M, y, logoSize);
  }

  const textX = M + logoSize + 4;
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(16);
  doc.setFont('Roboto', 'bold');
  doc.text(gymName.toUpperCase(), textX, y + (logoImg ? 5.5 : 4.5));

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8.5);
  doc.setFont('Roboto', 'normal');
  doc.text(gymAddress, textX, y + (logoImg ? 11 : 9.5));
  doc.text(`${gymPhone}   |   ${gymEmail}`, textX, y + (logoImg ? 16.5 : 14));

  // Right Header: Report Title
  doc.setTextColor(196, 145, 2); // Gold
  doc.setFontSize(14);
  doc.setFont('Roboto', 'bold');
  doc.text('PT MEMBER PROGRESS REPORT', PW - M, y + 5, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('Roboto', 'normal');
  const reportDateStr = formatDate(new Date().toISOString());
  doc.text(`Generated: ${reportDateStr}`, PW - M, y + 10.5, { align: 'right' });

  // Accent Line
  y = y + 24;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y);

  // ── Member Overview Section ──────────────────────────────────
  y = 45;
  const cardW = 110;
  const cardH = 38;

  // Left Card: Member Info
  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, cardW, cardH, 2, 2, 'FD');

  doc.setFillColor(11, 13, 18);
  doc.roundedRect(M, y, cardW, 6.5, 2, 2, 'F');
  doc.rect(M, y + 4, cardW, 2.5, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('MEMBER & TRAINING DETAILS', M + 4, y + 4.5);

  let cy = y + 11.5;
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(11);
  doc.setFont('Roboto', 'bold');
  doc.text(client.full_name, M + 4, cy);

  doc.setFontSize(8);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(71, 85, 105);

  cy += 5;
  doc.text(`Phone: ${client.phone}${client.email ? `  |  Email: ${client.email}` : ''}`, M + 4, cy);
  cy += 4.5;
  doc.text(`Assigned Trainer: ${client.trainer?.full_name || 'Not Assigned'}`, M + 4, cy);
  cy += 4.5;
  doc.text(`Package: ${client.package?.package_name || 'Custom Package'}  |  Expiry: ${formatDate(client.expiry_date)}`, M + 4, cy);
  if (client.goal) {
    cy += 4.5;
    doc.text(`Goal: ${client.goal}`, M + 4, cy);
  }

  // Right Card: Sessions & Status Box
  const rCardX = M + cardW + 6;
  const rCardW = CW - cardW - 6;
  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.roundedRect(rCardX, y, rCardW, cardH, 2, 2, 'FD');

  doc.setFillColor(11, 13, 18);
  doc.roundedRect(rCardX, y, rCardW, 6.5, 2, 2, 'F');
  doc.rect(rCardX, y + 4, rCardW, 2.5, 'F');
  doc.setTextColor(212, 175, 55);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('SESSION SUMMARY', rCardX + 4, y + 4.5);

  drawStatusBadge(PW - M - 24, y + 1.2, client.status);

  cy = y + 13;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('Sessions Remaining:', rCardX + 4, cy);

  doc.setTextColor(196, 145, 2);
  doc.setFontSize(14);
  doc.setFont('Roboto', 'bold');
  doc.text(`${client.sessions_remaining}`, rCardX + rCardW - 4, cy + 1, { align: 'right' });

  cy += 7;
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('Sessions Purchased:', rCardX + 4, cy);

  doc.setTextColor(11, 13, 18);
  doc.setFontSize(9);
  doc.setFont('Roboto', 'bold');
  doc.text(`${client.sessions_purchased}`, rCardX + rCardW - 4, cy, { align: 'right' });

  cy += 6;
  const sessionsCompleted = Math.max(0, client.sessions_purchased - client.sessions_remaining);
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('Sessions Completed:', rCardX + 4, cy);

  doc.setTextColor(3, 84, 63);
  doc.setFontSize(9);
  doc.setFont('Roboto', 'bold');
  doc.text(`${sessionsCompleted}`, rCardX + rCardW - 4, cy, { align: 'right' });

  // ── Biometrics Metrics KPI Grid ──────────────────────────────
  y = 88;
  const latestLog = progressLogs[0];
  const oldestLog = progressLogs[progressLogs.length - 1];

  const currentWeight = latestLog?.weight ?? client.weight ?? null;
  const initialWeight = oldestLog?.weight ?? client.weight ?? null;
  let weightDiffStr = '—';
  if (currentWeight && initialWeight && progressLogs.length > 1) {
    const diff = Number((currentWeight - initialWeight).toFixed(1));
    weightDiffStr = diff > 0 ? `+${diff} kg` : `${diff} kg`;
  }

  const currentBodyFat = latestLog?.body_fat ?? client.body_fat ?? null;
  const initialBodyFat = oldestLog?.body_fat ?? client.body_fat ?? null;
  let fatDiffStr = '—';
  if (currentBodyFat && initialBodyFat && progressLogs.length > 1) {
    const diff = Number((currentBodyFat - initialBodyFat).toFixed(1));
    fatDiffStr = diff > 0 ? `+${diff}%` : `${diff}%`;
  }

  const currentBMI = latestLog?.bmi ?? '—';
  const currentHeight = latestLog?.height ?? client.height ?? '—';

  const kpiBoxW = CW / 4 - 3;
  const kpiBoxH = 18;
  const kpis = [
    { label: 'WEIGHT (CURRENT)', val: currentWeight ? `${currentWeight} kg` : '—', sub: `Change: ${weightDiffStr}` },
    { label: 'BODY FAT %', val: currentBodyFat ? `${currentBodyFat}%` : '—', sub: `Change: ${fatDiffStr}` },
    { label: 'BMI SCORE', val: `${currentBMI}`, sub: 'Body Mass Index' },
    { label: 'HEIGHT', val: currentHeight !== '—' ? `${currentHeight} cm` : '—', sub: 'Baseline Height' }
  ];

  kpis.forEach((kpi, idx) => {
    const kx = M + idx * (kpiBoxW + 4);
    doc.setFillColor(250, 247, 240);
    doc.setDrawColor(234, 209, 150);
    doc.setLineWidth(0.3);
    doc.roundedRect(kx, y, kpiBoxW, kpiBoxH, 1.5, 1.5, 'FD');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(6.5);
    doc.setFont('Roboto', 'bold');
    doc.text(kpi.label, kx + 3, y + 4.5);

    doc.setTextColor(11, 13, 18);
    doc.setFontSize(10);
    doc.setFont('Roboto', 'bold');
    doc.text(kpi.val, kx + 3, y + 10.5);

    doc.setTextColor(196, 145, 2);
    doc.setFontSize(6.5);
    doc.setFont('Roboto', 'normal');
    doc.text(kpi.sub, kx + 3, y + 15);
  });

  // ── 1. Biometrics History Table ─────────────────────────────
  y = 112;
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text('BIOMETRIC MEASUREMENTS TIMELINE', M, y);

  const progTableBody = progressLogs.map(log => [
    formatDate(log.date),
    log.weight ? `${log.weight} kg` : '—',
    log.bmi ? String(log.bmi) : '—',
    log.body_fat ? `${log.body_fat}%` : '—',
    log.chest ? `${log.chest} cm` : '—',
    log.waist ? `${log.waist} cm` : '—',
    log.arms ? `${log.arms} cm` : '—',
    log.legs ? `${log.legs} cm` : '—',
    log.notes || '—'
  ]);

  if (progTableBody.length === 0) {
    progTableBody.push(['No progress logs recorded yet.', '—', '—', '—', '—', '—', '—', '—', '—']);
  }

  autoTable(doc, {
    startY: y + 3,
    head: [['Date', 'Weight', 'BMI', 'Body Fat', 'Chest', 'Waist', 'Arms', 'Legs', 'Notes']],
    body: progTableBody,
    headStyles: {
      fillColor: [11, 13, 18],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 8,
      font: 'Roboto',
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'left' },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 16, halign: 'center' },
      8: { cellWidth: 41, halign: 'left' },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 3,
      font: 'Roboto',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: 'grid',
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'Roboto',
    },
    margin: { left: M, right: M, bottom: 25, top: 20 },
  });

  // ── 2. Daily Workout Logs Table ─────────────────────────────
  let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (nextY > PH - 40) {
    doc.addPage();
    nextY = 20;
  }

  doc.setTextColor(11, 13, 18);
  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text('DAILY WORKOUT ROUTINES & EXERCISES', M, nextY);

  const workoutTableBody = dailyWorkouts.map(w => [
    formatDate(w.workout_date),
    w.title,
    w.muscle_group || 'Full Body',
    w.duration ? `${w.duration} m` : '—',
    w.calories_burned ? `${w.calories_burned} kcal` : '—',
    w.intensity || 'Moderate',
    w.exercises ? `${w.exercises}${w.notes ? `\nNotes: ${w.notes}` : ''}` : (w.notes || '—')
  ]);

  if (workoutTableBody.length === 0) {
    workoutTableBody.push(['No daily workouts logged yet.', '—', '—', '—', '—', '—', '—']);
  }

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Date', 'Workout Title', 'Muscle Group', 'Duration', 'Burned', 'Intensity', 'Exercises & Notes']],
    body: workoutTableBody,
    headStyles: {
      fillColor: [11, 13, 18],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 8,
      font: 'Roboto',
    },
    columnStyles: {
      0: { cellWidth: 24, halign: 'left' },
      1: { cellWidth: 32, halign: 'left' },
      2: { cellWidth: 24, halign: 'left' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: 20, halign: 'center' },
      6: { cellWidth: 46, halign: 'left' },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 3,
      font: 'Roboto',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: 'grid',
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'Roboto',
    },
    margin: { left: M, right: M, bottom: 25, top: 20 },
  });

  // ── 3. Sessions Log Table ───────────────────────────────────
  nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (nextY > PH - 40) {
    doc.addPage();
    nextY = 20;
  }

  doc.setTextColor(11, 13, 18);
  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text('PT SESSION ATTENDANCE HISTORY', M, nextY);

  const sessionTableBody = sessions.map(s => [
    `${formatDate(s.session_date)} ${s.session_time}`,
    s.trainer?.full_name || 'Assigned Trainer',
    `${s.duration} mins`,
    s.status,
    s.workout_plan || '—'
  ]);

  if (sessionTableBody.length === 0) {
    sessionTableBody.push(['No training sessions scheduled yet.', '—', '—', '—', '—']);
  }

  autoTable(doc, {
    startY: nextY + 3,
    head: [['Date & Time', 'Trainer Name', 'Duration', 'Status', 'Workout Plan']],
    body: sessionTableBody,
    headStyles: {
      fillColor: [11, 13, 18],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 8,
      font: 'Roboto',
    },
    columnStyles: {
      0: { cellWidth: 35, halign: 'left' },
      1: { cellWidth: 35, halign: 'left' },
      2: { cellWidth: 20, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 66, halign: 'left' },
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 3,
      font: 'Roboto',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: 'grid',
    styles: {
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
      font: 'Roboto',
    },
    margin: { left: M, right: M, bottom: 25, top: 20 },
    didDrawPage: (data) => {
      // Draw footer on every page automatically
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = data.pageNumber;

      const pageHeight = doc.internal.pageSize.height || PH;
      const pageWidth = doc.internal.pageSize.width || PW;

      // Footer block
      doc.setFillColor(11, 13, 18);
      doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');

      // Gold line
      doc.setDrawColor(212, 175, 55);
      doc.setLineWidth(0.5);
      doc.line(0, pageHeight - 20, pageWidth, pageHeight - 20);

      // Text
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(8);
      doc.setFont('Roboto', 'bold');
      doc.text(gymName, M, pageHeight - 12);

      doc.setTextColor(156, 163, 175);
      doc.setFontSize(7);
      doc.setFont('Roboto', 'normal');
      doc.text(`Phone: ${gymPhone} | Email: ${gymEmail}`, M, pageHeight - 6);

      // Page numbers on right
      doc.setTextColor(212, 175, 55);
      doc.setFontSize(7.5);
      doc.setFont('Roboto', 'bold');
      doc.text(`Page ${currentPage} of ${pageCount}`, pageWidth - M, pageHeight - 9, { align: 'right' });
    }
  });

  const sanitizedFileName = (client.full_name || 'PT_Member').replace(/[^a-zA-Z0-9_\-]/g, '_');
  doc.save(`PT_Progress_Report_${sanitizedFileName}.pdf`);
}
