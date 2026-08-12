import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PTClient, PTSession } from '@/types/pt';
import { GymSettings } from '@/types';
import { formatDate, toLocalDateString } from '@/lib/utils';
import { robotoRegular, robotoBold } from './robotoFonts';

export interface GeneratePTSchedulePDFOptions {
  client?: PTClient | null;
  sessions: PTSession[];
  title?: string;
  subtitle?: string;
  dateLabel?: string;
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

export async function generatePTSchedulePDF({
  client,
  sessions,
  title = 'PERSONAL TRAINING WORKOUT SCHEDULE',
  subtitle,
  dateLabel,
  settings,
}: GeneratePTSchedulePDFOptions): Promise<void> {
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

    doc.setDrawColor(11, 13, 18);
    doc.setLineWidth(0.8);
    doc.line(x + 2.5, y + size - 2.5, x + size - 2.5, y + 2.5);

    doc.setFillColor(11, 13, 18);
    doc.circle(x + 2.5, y + size - 2.5, 1.2, 'F');
    doc.circle(x + size - 2.5, y + 2.5, 1.2, 'F');
    doc.circle(x + 3.7, y + size - 3.7, 0.9, 'F');
    doc.circle(x + size - 3.7, y + 3.7, 0.9, 'F');
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

  // Right Header: Title
  doc.setTextColor(196, 145, 2); // Gold
  doc.setFontSize(13);
  doc.setFont('Roboto', 'bold');
  doc.text(title.toUpperCase(), PW - M, y + 5, { align: 'right' });

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.setFont('Roboto', 'normal');
  const genDateStr = formatDate(new Date().toISOString());
  doc.text(`Generated: ${genDateStr}${dateLabel ? ` | Period: ${dateLabel}` : ''}`, PW - M, y + 10.5, { align: 'right' });

  // Accent Line
  y = y + 24;
  doc.setDrawColor(212, 175, 55);
  doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y);

  // ── Member / Client Section (if specific client) ───────────
  y = 45;
  if (client) {
    const cardW = CW;
    const cardH = 34;

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
    doc.text('CLIENT & PERSONAL TRAINING INFORMATION', M + 4, y + 4.5);

    let cy = y + 12;
    doc.setTextColor(11, 13, 18);
    doc.setFontSize(11);
    doc.setFont('Roboto', 'bold');
    doc.text(client.full_name, M + 4, cy);

    doc.setFontSize(8);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(71, 85, 105);

    cy += 5;
    doc.text(`Phone: ${client.phone} ${client.email ? ` | Email: ${client.email}` : ''}`, M + 4, cy);
    cy += 4.5;
    doc.text(`Assigned Trainer: ${client.trainer?.full_name || 'Not Assigned'}  |  Package: ${client.package?.package_name || 'Custom PT Package'}`, M + 4, cy);

    // Sessions stats on right side of card
    const rX = M + CW - 65;
    doc.setFontSize(8);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Sessions Remaining:', rX, y + 12);
    doc.setTextColor(196, 145, 2);
    doc.setFontSize(12);
    doc.text(`${client.sessions_remaining}`, M + CW - 6, y + 12, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Total Purchased:', rX, y + 18);
    doc.setTextColor(11, 13, 18);
    doc.setFontSize(9);
    doc.text(`${client.sessions_purchased}`, M + CW - 6, y + 18, { align: 'right' });

    doc.setFontSize(8);
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text('Package Expiry:', rX, y + 24);
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(8.5);
    doc.text(formatDate(client.expiry_date), M + CW - 6, y + 24, { align: 'right' });

    y += cardH + 8;
  } else {
    y = 44;
  }

  // ── Scheduled Workouts Table ─────────────────────────────
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(10);
  doc.setFont('Roboto', 'bold');
  doc.text(subtitle || (client ? `SCHEDULED WORKOUTS FOR ${client.full_name.toUpperCase()}` : 'SCHEDULED PERSONAL TRAINING SESSIONS'), M, y);

  // Deduplicate sessions before generating PDF rows
  const uniqueSessionsMap = new Map<string, PTSession>();
  sessions.forEach(s => {
    const key = `${s.client_id || 'client'}_${s.session_date}_${s.session_time}_${s.workout_plan || ''}`;
    if (!uniqueSessionsMap.has(key)) {
      uniqueSessionsMap.set(key, s);
    }
  });
  const dedupedSessions = Array.from(uniqueSessionsMap.values());

  // Sort sessions by date and time
  const sortedSessions = dedupedSessions.sort((a, b) => {
    const d1 = `${a.session_date} ${a.session_time}`;
    const d2 = `${b.session_date} ${b.session_time}`;
    return d1.localeCompare(d2);
  });

  const isMultiClient = !client;

  const tableHead = isMultiClient
    ? [['Date', 'Time', 'Client Name', 'Trainer', 'Duration', 'Status', 'Workout Routine / Plan']]
    : [['Date', 'Time', 'Duration', 'Trainer', 'Status', 'Workout Routine / Plan']];

  const tableBody = sortedSessions.map((s) => {
    const dateFormatted = formatDate(s.session_date);
    const timeStr = s.session_time || '—';
    const trainerName = s.trainer?.full_name || 'Assigned Trainer';
    const dur = `${s.duration} mins`;
    const status = s.status;
    const plan = s.workout_plan || 'General Workout';

    if (isMultiClient) {
      const clientName = s.client?.full_name || 'Client';
      return [dateFormatted, timeStr, clientName, trainerName, dur, status, plan];
    } else {
      return [dateFormatted, timeStr, dur, trainerName, status, plan];
    }
  });

  if (tableBody.length === 0) {
    if (isMultiClient) {
      tableBody.push(['No sessions scheduled', '—', '—', '—', '—', '—', '—']);
    } else {
      tableBody.push(['No sessions scheduled', '—', '—', '—', '—', '—']);
    }
  }

  const columnStyles: Record<number, any> = isMultiClient
    ? {
        0: { cellWidth: 24, halign: 'left' },
        1: { cellWidth: 16, halign: 'center' },
        2: { cellWidth: 32, halign: 'left' },
        3: { cellWidth: 28, halign: 'left' },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 22, halign: 'center' },
        6: { cellWidth: 40, halign: 'left' },
      }
    : {
        0: { cellWidth: 26, halign: 'left' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 20, halign: 'center' },
        3: { cellWidth: 32, halign: 'left' },
        4: { cellWidth: 24, halign: 'center' },
        5: { cellWidth: 60, halign: 'left' },
      };

  autoTable(doc, {
    startY: y + 3,
    head: tableHead,
    body: tableBody,
    headStyles: {
      fillColor: [11, 13, 18],
      textColor: [212, 175, 55],
      fontStyle: 'bold',
      fontSize: 8,
      font: 'Roboto',
    },
    columnStyles: columnStyles,
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
    margin: { left: M, right: M, bottom: 35, top: 20 },
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
    },
  });

  // ── Client Guidelines / Notes Box ─────────────────────────
  let nextY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  if (nextY > PH - 45) {
    doc.addPage();
    nextY = 20;
  }

  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(234, 209, 150);
  doc.setLineWidth(0.3);
  const notesH = 26;
  doc.roundedRect(M, nextY, CW, notesH, 1.5, 1.5, 'FD');

  doc.setTextColor(196, 145, 2);
  doc.setFontSize(8);
  doc.setFont('Roboto', 'bold');
  doc.text('IMPORTANT GUIDELINES FOR CLIENTS:', M + 4, nextY + 5);

  doc.setTextColor(71, 85, 105);
  doc.setFontSize(7.2);
  doc.setFont('Roboto', 'normal');
  doc.text('1. Please arrive 10 minutes prior to your scheduled session time with appropriate fitness gear.', M + 4, nextY + 10);
  doc.text('2. Stay hydrated during sessions and follow trainer safety instructions at all times.', M + 4, nextY + 14.5);
  doc.text('3. If you need to reschedule or cancel a session, please notify your trainer at least 4 hours prior.', M + 4, nextY + 19);
  doc.text('4. For support or schedule adjustments, contact gym administration.', M + 4, nextY + 23.5);

  // Download PDF file
  const clientSanitized = client ? client.full_name.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'All_Clients';
  const fileName = `PT_Schedule_${clientSanitized}_${toLocalDateString(new Date())}.pdf`;
  doc.save(fileName);
}
