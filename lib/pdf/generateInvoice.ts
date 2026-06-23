import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, GymSettings } from '@/types';
import { formatCurrency, formatDate, getMembershipExpiry } from '@/lib/utils';

export function generateInvoicePDF(invoice: Invoice, settings: GymSettings): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const member = invoice.member as {
    full_name: string;
    phone?: string;
    email?: string;
    address?: string;
    membership_plan?: string;
  } | undefined;

  const PW = 210;
  const PH = 297;
  const M = 15; // 15mm margin
  const CW = PW - 2 * M; // 180mm printable width

  // ── Helper to draw a luxury vector logo ──
  const drawGymLogo = (x: number, y: number, size: number) => {
    // Round rect background
    doc.setFillColor(212, 175, 55); // Premium Gold (#D4AF37)
    doc.roundedRect(x, y, size, size, 2.5, 2.5, 'F');

    // Barbell diagonal shaft
    doc.setDrawColor(11, 13, 18); // Rich Black (#0B0D12)
    doc.setLineWidth(0.8);
    doc.line(x + 2.5, y + size - 2.5, x + size - 2.5, y + 2.5);

    // Plates
    doc.setFillColor(11, 13, 18);
    doc.circle(x + 2.5, y + size - 2.5, 1.2, 'F');
    doc.circle(x + size - 2.5, y + 2.5, 1.2, 'F');
    doc.circle(x + 3.7, y + size - 3.7, 0.9, 'F');
    doc.circle(x + size - 3.7, y + 3.7, 0.9, 'F');
  };

  // ── Helper to draw status badge ──
  const drawStatusBadge = (x: number, y: number, status: string) => {
    let bg = [224, 242, 254];
    let text = [3, 105, 161];
    if (status === 'Paid') {
      bg = [222, 247, 236]; // #DEF7EC
      text = [3, 84, 63]; // #03543F
    } else if (status === 'Pending') {
      bg = [253, 246, 178]; // #FDF6B2
      text = [114, 59, 19]; // #723B13
    } else if (status === 'Overdue') {
      bg = [253, 232, 232]; // #FDE8E8
      text = [155, 28, 28]; // #9B1C1C
    }
    doc.setFillColor(bg[0], bg[1], bg[2]);
    doc.roundedRect(x, y, 22, 6, 1.5, 1.5, 'F');

    doc.setTextColor(text[0], text[1], text[2]);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(status.toUpperCase(), x + 11, y + 4.2, { align: 'center' });
  };

  // ── Header Section ─────────────────────────────────────────
  let y = 15;

  // Draw Logo (left aligned)
  drawGymLogo(M, y, 12);

  // Gym Name & Details
  doc.setTextColor(11, 13, 18); // Rich Black
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.gym_name.toUpperCase(), M + 15, y + 6);

  doc.setTextColor(100, 116, 139); // Slate Gray (#64748B)
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.gym_address, M + 15, y + 11);
  doc.text(`${settings.gym_phone}   |   ${settings.gym_email}`, M + 15, y + 15.5);

  // Right Side: INVOICE label
  doc.setTextColor(196, 145, 2); // Rich Dark Gold
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', PW - M, y + 5, { align: 'right' });

  // Bordered Invoice Number Card
  const invCardX = PW - M - 48;
  const invCardY = y + 8.5;
  const invCardW = 48;
  const invCardH = 8.5;
  
  doc.setFillColor(252, 251, 247); // #FCFBF7
  doc.setDrawColor(234, 209, 150); // Gold Border
  doc.setLineWidth(0.3);
  doc.roundedRect(invCardX, invCardY, invCardW, invCardH, 1.5, 1.5, 'FD');

  doc.setTextColor(30, 41, 59); // Charcoal
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(`INV NO:`, invCardX + 3, invCardY + 5.5);
  
  doc.setTextColor(11, 13, 18);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.invoice_number, invCardX + 45, invCardY + 5.5, { align: 'right' });

  // Status Badge next to invoice card
  drawStatusBadge(PW - M - 22, y + 18.5, invoice.status);
  
  // Print label "STATUS:" next to the status badge
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS:', PW - M - 24, y + 22.8, { align: 'right' });

  // Accent Line
  y = y + 27;
  doc.setDrawColor(212, 175, 55); // Gold Accent Line
  doc.setLineWidth(0.5);
  doc.line(M, y, PW - M, y);

  // ── Customer Section (Side-by-side cards) ───────────────────
  y = 48;
  const cardW = 86;
  const cardH = 36;
  const cardG = 8; // gap

  // Card 1: Member Information
  doc.setFillColor(252, 251, 247); // #FCFBF7
  doc.setDrawColor(226, 232, 240); // Slate Border
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, cardW, cardH, 2, 2, 'FD');

  // Card 1 Header bar
  doc.setFillColor(11, 13, 18); // Rich Black
  doc.roundedRect(M, y, cardW, 6.5, 2, 2, 'F');
  doc.rect(M, y + 4, cardW, 2.5, 'F'); // Overwrite bottom corners
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMBER INFORMATION', M + 4, y + 4.5);

  // Card 1 Details
  let cy = y + 11.5;
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text(member?.full_name ?? 'Member', M + 4, cy);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  if (member?.phone) {
    cy += 5;
    doc.text(`Phone: ${member.phone}`, M + 4, cy);
  }
  if (member?.email) {
    cy += 4.5;
    doc.text(`Email: ${member.email}`, M + 4, cy);
  }
  if (member?.address) {
    cy += 4.5;
    const addressLines = doc.splitTextToSize(member.address, cardW - 8);
    doc.text(addressLines[0], M + 4, cy);
    if (addressLines[1]) {
      cy += 3.5;
      doc.text(addressLines[1], M + 4, cy);
    }
  }

  // Card 2: Invoice Details
  const c2X = M + cardW + cardG;
  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(c2X, y, cardW, cardH, 2, 2, 'FD');

  // Card 2 Header bar
  doc.setFillColor(11, 13, 18);
  doc.roundedRect(c2X, y, cardW, 6.5, 2, 2, 'F');
  doc.rect(c2X, y + 4, cardW, 2.5, 'F'); // Overwrite bottom corners
  doc.setTextColor(212, 175, 55); // Gold
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS', c2X + 4, y + 4.5);

  // Card 2 Details
  const invoiceDetails = [
    ['Invoice No', invoice.invoice_number],
    ['Invoice Date', formatDate(invoice.created_at)],
    ['Due Date', formatDate(invoice.due_date)],
    ['Membership Plan', member?.membership_plan ?? '—']
  ];

  cy = y + 11.5;
  invoiceDetails.forEach(([label, val]) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(label + ':', c2X + 4, cy);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(val, c2X + cardW - 4, cy, { align: 'right' });
    cy += 5.2;
  });

  // ── Membership Summary Section ───────────────────────────────
  y = 89;
  const summaryW = CW;
  const summaryH = 19;

  // Highlighted box with gold left border
  doc.setFillColor(250, 247, 240); // Premium cream/light gold background (#FAF7F0)
  doc.setDrawColor(212, 175, 55); // Gold border
  doc.setLineWidth(0.4);
  doc.roundedRect(M, y, summaryW, summaryH, 1.5, 1.5, 'F');
  
  // Left border line only
  doc.setLineWidth(1.2);
  doc.line(M, y, M, y + summaryH);

  // Outline rest of the card shape
  doc.setDrawColor(234, 209, 150);
  doc.setLineWidth(0.2);
  doc.line(M, y, M + summaryW, y);
  doc.line(M + summaryW, y, M + summaryW, y + summaryH);
  doc.line(M, y + summaryH, M + summaryW, y + summaryH);

  // Section Title
  doc.setTextColor(196, 145, 2); // Gold
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text('MEMBERSHIP SUMMARY', M + 4, y + 4.5);

  // Compute duration and package type
  const plan = member?.membership_plan;
  let duration = '—';
  let packageType = 'Gym Membership';
  
  if (plan === 'Monthly') {
    duration = '1 Month';
    packageType = 'Standard Monthly Package';
  } else if (plan === 'Quarterly') {
    duration = '3 Months';
    packageType = 'Pro Quarterly Package';
  } else if (plan === 'Biannual') {
    duration = '6 Months';
    packageType = 'Elite Biannual Package';
  } else if (plan === 'Annual') {
    duration = '1 Year';
    packageType = 'VIP Gold Annual Package';
  }

  const startDate = formatDate(invoice.created_at);
  const expiryDateObj = getMembershipExpiry(invoice.created_at, plan);
  const expiryDate = formatDate(expiryDateObj);

  const colW = summaryW / 5;
  const summaryCols = [
    { label: 'PLAN', value: plan ?? '—' },
    { label: 'DURATION', value: duration },
    { label: 'PACKAGE TYPE', value: packageType },
    { label: 'START DATE', value: startDate },
    { label: 'EXPIRY DATE', value: expiryDate }
  ];

  doc.setFontSize(7.5);
  summaryCols.forEach((col, i) => {
    const colX = M + i * colW;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(col.label, colX + 4, y + 10);
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 13, 18);
    if (col.label === 'PACKAGE TYPE') {
      doc.setFontSize(7);
      const textWidth = doc.getTextWidth(col.value);
      if (textWidth > colW - 5) {
        doc.text(col.value.replace(' Package', ''), colX + 4, y + 14.5);
      } else {
        doc.text(col.value, colX + 4, y + 14.5);
      }
      doc.setFontSize(7.5);
    } else {
      doc.text(col.value, colX + 4, y + 14.5);
    }
  });

  // ── Items Table ──────────────────────────────────────────────
  autoTable(doc, {
    startY: 114,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: [
      [
        `Membership Fee — ${member?.membership_plan ?? 'Monthly'} Plan\nGym Membership & Cardio Access`,
        '1',
        formatCurrency(invoice.amount),
        formatCurrency(invoice.amount)
      ]
    ],
    headStyles: {
      fillColor: [11, 13, 18], // Rich Black
      textColor: [212, 175, 55], // Gold
      fontStyle: 'bold',
      fontSize: 8.5,
    },
    columnStyles: {
      0: { cellWidth: 90, halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [30, 41, 59], // Slate Dark
      cellPadding: 4,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: 'grid',
    styles: {
      lineColor: [226, 232, 240], // Light slate gray grid lines
      lineWidth: 0.1,
    },
    margin: { left: M, right: M, bottom: 30, top: 20 },
    didDrawPage: () => {
      // Draw footer on every page automatically
      const pageHeight = doc.internal.pageSize.height || PH;
      const pageWidth = doc.internal.pageSize.width || PW;
      
      // Footer block
      doc.setFillColor(11, 13, 18); // Rich Black
      doc.rect(0, pageHeight - 26, pageWidth, 26, 'F');

      // Top Accent Gold Line in Footer
      doc.setDrawColor(212, 175, 55); // Gold
      doc.setLineWidth(0.6);
      doc.line(0, pageHeight - 26, pageWidth, pageHeight - 26);

      // Thank You Message
      doc.setTextColor(212, 175, 55); // Gold
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'bold');
      doc.text('Thank you for choosing Fusion Fit Multi Gym', pageWidth / 2, pageHeight - 19, { align: 'center' });

      // Contact Info
      doc.setTextColor(156, 163, 175); // Light Gray
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      const contactText = `Website: www.fusionfitgym.com    |    Phone: ${settings.gym_phone}    |    Email: ${settings.gym_email}`;
      doc.text(contactText, pageWidth / 2, pageHeight - 13, { align: 'center' });

      // Disclaimer
      doc.setTextColor(107, 114, 128); // Muted Gray
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'italic');
      doc.text('This invoice was generated automatically by Fusion Fit Management System.', pageWidth / 2, pageHeight - 7, { align: 'center' });
    }
  });

  // ── Notes and Summary ────────────────────────────────────────
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  
  // Left Column: Notes Section
  if (invoice.notes) {
    doc.setFillColor(252, 251, 247);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, finalY, 100, 26, 1.5, 1.5, 'FD');

    // Title
    doc.setTextColor(196, 145, 2); // Gold
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE NOTES', M + 4, finalY + 4.5);

    // Notes text
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, 92);
    doc.text(noteLines, M + 4, finalY + 9.5);
  }

  // Right Column: Summary Box
  const summaryBoxX = PW - M - 72;
  const summaryBoxW = 72;
  const summaryBoxH = 34;

  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(234, 209, 150); // Gold Border
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxW, summaryBoxH, 2, 2, 'FD');

  const rightAlignX = PW - M - 4;
  const leftLabelX = summaryBoxX + 4;
  let sy = finalY + 5.5;

  // Subtotal
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('Subtotal:', leftLabelX, sy);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(invoice.amount), rightAlignX, sy, { align: 'right' });
  
  // Discount
  sy += 4.8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Discount:', leftLabelX, sy);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(0), rightAlignX, sy, { align: 'right' });

  // Tax
  sy += 4.8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Tax (0%):', leftLabelX, sy);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(formatCurrency(0), rightAlignX, sy, { align: 'right' });

  // Divider inside summary box
  sy += 2.5;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(summaryBoxX + 3, sy, PW - M - 3, sy);

  // Amount Due Box (Black background and Gold text)
  const dueBoxY = sy + 1.5;
  const dueBoxH = 12;
  doc.setFillColor(11, 13, 18); // Rich Black
  doc.roundedRect(summaryBoxX + 2, dueBoxY, summaryBoxW - 4, dueBoxH, 1.2, 1.2, 'F');

  doc.setTextColor(212, 175, 55); // Gold Text
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('AMOUNT DUE', summaryBoxX + 5, dueBoxY + 7.5);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(formatCurrency(invoice.amount), rightAlignX - 5, dueBoxY + 8.2, { align: 'right' });

  // ── Save ─────────────────────────────────────────────────
  doc.save(`${invoice.invoice_number}.pdf`);
}
