import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, GymSettings } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { robotoRegular, robotoBold } from './robotoFonts';
import { generateQRCodeDataUrl } from '@/lib/qr';
import { buildInvoicePublicUrl } from '@/lib/invoice-links';

// Helper to load image asynchronously in browser environment
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only request CORS headers if the image is loaded from an external origin
    if (url.startsWith('http') || url.startsWith('//')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

export async function generateInvoicePDF(invoice: Invoice, settings: GymSettings): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Register Roboto fonts
  doc.addFileToVFS('Roboto-Regular.ttf', robotoRegular);
  doc.addFileToVFS('Roboto-Bold.ttf', robotoBold);
  doc.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
  doc.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');

  const formatWithCurrency = (amount: number): string => {
    const formatted = formatCurrency(amount);
    const customSymbol = settings.invoice_currency || '₹';
    if (customSymbol !== '₹') {
      return formatted.replace('₹', customSymbol);
    }
    return formatted;
  };

  const member = invoice.member as {
    full_name: string;
    phone?: string;
    email?: string;
    address?: string;
    package_name?: string;
    package_duration?: string;
    package_price?: number;
    package_start_date?: string;
    package_end_date?: string;
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
    doc.setFont('Roboto', 'bold');
    doc.text(status.toUpperCase(), x + 11, y + 4.2, { align: 'center' });
  };

  // ── Header Section ─────────────────────────────────────────
  let y = 15;

  // Load custom logo with fallbacks
  let logoImg: HTMLImageElement | null = null;
  if (settings.gym_logo) {
    try {
      logoImg = await loadImage(settings.gym_logo);
    } catch (err) {
      console.warn('Failed to load custom gym logo from settings:', err);
    }
  }

  if (!logoImg) {
    try {
      logoImg = await loadImage('/Logo.jpeg');
    } catch (err) {
      console.warn('Failed to load default logo /Logo.jpeg:', err);
    }
  }

  // Draw Logo or Fallback Dumbbell Icon
  const logoSize = logoImg ? 20 : 12;
  if (logoImg) {
    try {
      // Sharp image rendering for premium branding
      doc.addImage(logoImg, 'JPEG', M, y, logoSize, logoSize);
    } catch (err) {
      console.warn('Failed to add custom logo to jsPDF, falling back to vector logo:', err);
      drawGymLogo(M, y, 12);
    }
  } else {
    drawGymLogo(M, y, logoSize);
  }

  // Gym Name & Details Alignment
  const textX = M + logoSize + 4; // Spacing after logo (4mm gap)

  doc.setTextColor(11, 13, 18); // Rich Black
  doc.setFontSize(18);
  doc.setFont('Roboto', 'bold');
  doc.text(settings.gym_name.toUpperCase(), textX, y + (logoImg ? 5.5 : 4.5));

  doc.setTextColor(100, 116, 139); // Slate Gray (#64748B)
  doc.setFontSize(8.5);
  doc.setFont('Roboto', 'normal');
  doc.text(settings.gym_address, textX, y + (logoImg ? 11 : 9.5));
  doc.text(`${settings.gym_phone}   |   ${settings.gym_email}`, textX, y + (logoImg ? 16.5 : 14));

  // Right Side: INVOICE label
  doc.setTextColor(196, 145, 2); // Rich Dark Gold
  doc.setFontSize(22);
  doc.setFont('Roboto', 'bold');
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
  doc.setFont('Roboto', 'bold');
  doc.text(`INV NO:`, invCardX + 3, invCardY + 5.5);
  
  doc.setTextColor(11, 13, 18);
  doc.setFont('Roboto', 'bold');
  doc.text(invoice.invoice_number, invCardX + 45, invCardY + 5.5, { align: 'right' });

  // Status Badge next to invoice card
  drawStatusBadge(PW - M - 22, y + 18.5, invoice.status);
  
  // Print label "STATUS:" next to the status badge
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
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
  doc.setFont('Roboto', 'bold');
  doc.text('MEMBER INFORMATION', M + 4, y + 4.5);

  // Card 1 Details
  let cy = y + 11.5;
  doc.setTextColor(11, 13, 18);
  doc.setFontSize(9.5);
  doc.setFont('Roboto', 'bold');
  doc.text(member?.full_name ?? 'Member', M + 4, cy);

  doc.setFontSize(8);
  doc.setFont('Roboto', 'normal');
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
  doc.setFont('Roboto', 'bold');
  doc.text('INVOICE DETAILS', c2X + 4, y + 4.5);

  // Card 2 Details
  const invoiceDetails = [
    ['Invoice No', invoice.invoice_number],
    ['Invoice Date', formatDate(invoice.created_at)],
    ['Due Date', formatDate(invoice.due_date)],
    ['Package Name', member?.package_name ?? '—']
  ];

  cy = y + 11.5;
  invoiceDetails.forEach(([label, val]) => {
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.text(label + ':', c2X + 4, cy);

    doc.setFont('Roboto', 'normal');
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
  doc.setFont('Roboto', 'bold');
  doc.text('MEMBERSHIP SUMMARY', M + 4, y + 4.5);

  // Compute duration and package details
  const duration = member?.package_duration ?? '—';
  const plan = member?.package_name ?? '—';
  const startDate = formatDate(invoice.membership_start_date || member?.package_start_date || invoice.created_at);
  const expiryDate = formatDate(invoice.membership_expiry_date || member?.package_end_date);
  const paymentDate = invoice.payment_date ? formatDate(invoice.payment_date) : '—';
  const nextDueDate = formatDate(invoice.due_date);

  const colW = summaryW / 6;
  const summaryCols = [
    { label: 'PLAN', value: plan },
    { label: 'DURATION', value: duration },
    { label: 'START DATE', value: startDate },
    { label: 'EXPIRY DATE', value: expiryDate },
    { label: 'PAYMENT DATE', value: paymentDate },
    { label: 'NEXT DUE DATE', value: nextDueDate }
  ];

  doc.setFontSize(7);
  summaryCols.forEach((col, i) => {
    const colX = M + i * colW;
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    doc.text(col.label, colX + 2, y + 10);
    
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(11, 13, 18);
    if (col.label === 'PLAN') {
      doc.setFontSize(6.2);
      const textWidth = doc.getTextWidth(col.value);
      if (textWidth > colW - 3) {
        doc.text(col.value.substring(0, 16) + '..', colX + 2, y + 14.5);
      } else {
        doc.text(col.value, colX + 2, y + 14.5);
      }
      doc.setFontSize(7);
    } else {
      doc.text(col.value, colX + 2, y + 14.5);
    }
  });

  // ── Items Table ──────────────────────────────────────────────
  const membershipFee = invoice.membership_fee || 0;
  const parqFee = invoice.parq_fee || 0;
  const trainerFee = invoice.trainer_fee || 0;
  const admissionFee = invoice.admission_fee || 0;
  const lockerFee = invoice.locker_fee || 0;
  const dietPlanFee = invoice.diet_plan_fee || 0;

  const tableBody: any[] = [];

  if (membershipFee > 0) {
    tableBody.push([
      `Membership Fee — ${member?.package_name ?? 'Gym Membership'}`,
      '1',
      formatWithCurrency(membershipFee),
      formatWithCurrency(membershipFee)
    ]);
  }

  if (parqFee > 0) {
    tableBody.push([
      `PAR-Q Fee`,
      '1',
      formatWithCurrency(parqFee),
      formatWithCurrency(parqFee)
    ]);
  }

  if (trainerFee > 0) {
    tableBody.push([
      `Personal Training Fee${invoice.trainer_name ? ` (${invoice.trainer_name})` : ''}`,
      '1',
      formatWithCurrency(trainerFee),
      formatWithCurrency(trainerFee)
    ]);
  }

  if (admissionFee > 0) {
    tableBody.push([
      `Admission Fee`,
      '1',
      formatWithCurrency(admissionFee),
      formatWithCurrency(admissionFee)
    ]);
  }

  if (lockerFee > 0) {
    tableBody.push([
      `Locker Fee`,
      '1',
      formatWithCurrency(lockerFee),
      formatWithCurrency(lockerFee)
    ]);
  }

  if (dietPlanFee > 0) {
    tableBody.push([
      `Diet Plan Fee`,
      '1',
      formatWithCurrency(dietPlanFee),
      formatWithCurrency(dietPlanFee)
    ]);
  }

  autoTable(doc, {
    startY: 114,
    head: [['Description', 'Qty', 'Unit Price', 'Amount']],
    body: tableBody,
    headStyles: {
      fillColor: [11, 13, 18], // Rich Black
      textColor: [212, 175, 55], // Gold
      fontStyle: 'bold',
      fontSize: 8.5,
      font: 'Roboto',
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
      font: 'Roboto',
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
    },
    theme: 'grid',
    styles: {
      lineColor: [226, 232, 240], // Light slate gray grid lines
      lineWidth: 0.1,
      font: 'Roboto',
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
      doc.setFont('Roboto', 'bold');
      doc.text('Thank you for choosing Fusion Fit Multi Gym', pageWidth / 2, pageHeight - 19, { align: 'center' });

      // Contact Info
      doc.setTextColor(156, 163, 175); // Light Gray
      doc.setFontSize(7.5);
      doc.setFont('Roboto', 'normal');
      const contactText = `Website: fusionfitgym.vercel.app    |    Phone: ${settings.gym_phone}    |    Email: ${settings.gym_email}`;
      doc.text(contactText, pageWidth / 2, pageHeight - 13, { align: 'center' });

      // Disclaimer
      doc.setTextColor(107, 114, 128); // Muted Gray
      doc.setFontSize(6.5);
      doc.setFont('Roboto', 'normal'); // Changed from italic to avoid needing Roboto-Italic font
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
    doc.roundedRect(M, finalY, 100, 20, 1.5, 1.5, 'FD');

    // Title
    doc.setTextColor(196, 145, 2); // Gold
    doc.setFontSize(8);
    doc.setFont('Roboto', 'bold');
    doc.text('INVOICE NOTES', M + 4, finalY + 4.5);

    // Notes text
    doc.setTextColor(71, 85, 105);
    doc.setFontSize(7.5);
    doc.setFont('Roboto', 'normal');
    const noteLines = doc.splitTextToSize(invoice.notes, 92);
    doc.text(noteLines, M + 4, finalY + 9.5);
  }

  // Left Column: QR Code Online Verification Card
  const qrBoxY = invoice.notes ? finalY + 22 : finalY;
  const publicInvoiceUrl = buildInvoicePublicUrl(invoice.invoice_token || invoice.id);
  const qrDataUrl = generateQRCodeDataUrl(publicInvoiceUrl, { size: 100, margin: 1 });

  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(234, 209, 150);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, qrBoxY, 100, 22, 1.5, 1.5, 'FD');

  try {
    doc.addImage(qrDataUrl, 'SVG', M + 2, qrBoxY + 2, 18, 18);
  } catch (qrErr) {
    console.warn('Failed to render QR Code SVG in jsPDF:', qrErr);
  }

  doc.setTextColor(196, 145, 2); // Gold
  doc.setFontSize(7.5);
  doc.setFont('Roboto', 'bold');
  doc.text('SCAN QR CODE TO VIEW INVOICE ONLINE', M + 22, qrBoxY + 5.5);

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(6.5);
  doc.setFont('Roboto', 'normal');
  doc.text('Scan with smartphone camera to view digital receipt & status.', M + 22, qrBoxY + 10);

  doc.setTextColor(3, 105, 161);
  const truncatedUrl = publicInvoiceUrl.length > 44 ? publicInvoiceUrl.substring(0, 42) + '...' : publicInvoiceUrl;
  doc.text(truncatedUrl, M + 22, qrBoxY + 15);

  // Right Column: Summary Box
  const summaryBoxX = PW - M - 72;
  const summaryBoxW = 72;
  const hasTax = (invoice.tax || 0) > 0;
  const summaryBoxH = hasTax ? 44 : 39.2;

  doc.setFillColor(252, 251, 247);
  doc.setDrawColor(234, 209, 150); // Gold Border
  doc.setLineWidth(0.3);
  doc.roundedRect(summaryBoxX, finalY, summaryBoxW, summaryBoxH, 2, 2, 'FD');

  const rightAlignX = PW - M - 4;
  const leftLabelX = summaryBoxX + 4;
  let sy = finalY + 5.5;

  const subtotal = invoice.subtotal || invoice.amount;
  const discount = invoice.discount || 0;
  const tax = invoice.tax || 0;
  const grandTotal = invoice.amount;
  const paidAmount = invoice.paid_amount || 0;
  const balanceDue = invoice.balance_due !== undefined ? invoice.balance_due : (grandTotal - paidAmount);

  // Subtotal
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  doc.text('Subtotal:', leftLabelX, sy);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(formatWithCurrency(subtotal), rightAlignX, sy, { align: 'right' });
  
  // Discount
  sy += 4.8;
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Discount:', leftLabelX, sy);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(discount > 0 ? `-${formatWithCurrency(discount)}` : formatWithCurrency(0), rightAlignX, sy, { align: 'right' });

  // Tax
  if (hasTax) {
    sy += 4.8;
    doc.setFont('Roboto', 'bold');
    doc.setTextColor(100, 116, 139);
    const taxPercentStr = settings.invoice_gst_percent ? ` (${settings.invoice_gst_percent}%)` : '';
    doc.text(`Tax${taxPercentStr}:`, leftLabelX, sy);
    doc.setFont('Roboto', 'normal');
    doc.setTextColor(30, 41, 59);
    doc.text(formatWithCurrency(tax), rightAlignX, sy, { align: 'right' });
  }

  // Paid Amount
  sy += 4.8;
  doc.setFont('Roboto', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('Paid Amount:', leftLabelX, sy);
  doc.setFont('Roboto', 'normal');
  doc.setTextColor(30, 84, 63);
  doc.text(formatWithCurrency(paidAmount), rightAlignX, sy, { align: 'right' });

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
  doc.setFont('Roboto', 'bold');
  doc.text('BALANCE DUE', summaryBoxX + 5, dueBoxY + 7.5);

  doc.setFontSize(11);
  doc.setFont('Roboto', 'bold');
  doc.text(formatWithCurrency(balanceDue), rightAlignX - 5, dueBoxY + 8.2, { align: 'right' });

  // ── Save ─────────────────────────────────────────────────
  doc.save(`${invoice.invoice_number}.pdf`);
}
