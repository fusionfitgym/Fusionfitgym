import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Invoice, GymSettings } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export function generateInvoicePDF(invoice: Invoice, settings: GymSettings): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const member = invoice.member as { full_name: string; phone?: string; email?: string; address?: string; membership_plan?: string } | undefined;

  const PW = 210;
  const PH = 297;
  const M = 20; // margin

  // ── Header Background ─────────────────────────────────────
  doc.setFillColor(0, 0, 0);
  doc.rect(0, 0, PW, 50, 'F');

  // ── Gym Name ─────────────────────────────────────────────
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.gym_name.toUpperCase(), M, 22);

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.gym_address, M, 30);
  doc.text(`${settings.gym_phone}  |  ${settings.gym_email}`, M, 36);

  // ── INVOICE label ────────────────────────────────────────
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', PW - M, 20, { align: 'right' });

  doc.setTextColor(180, 180, 180);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.invoice_number, PW - M, 28, { align: 'right' });

  // Status badge
  const statusColors: Record<string, [number, number, number]> = {
    Paid:    [0, 128, 0],
    Pending: [180, 140, 0],
    Overdue: [200, 0, 0],
  };
  const [sr, sg, sb] = statusColors[invoice.status] ?? [100, 100, 100];
  doc.setFillColor(sr, sg, sb);
  doc.roundedRect(PW - M - 28, 31, 28, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(invoice.status.toUpperCase(), PW - M - 14, 36.5, { align: 'center' });

  // ── Bill To ──────────────────────────────────────────────
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('BILL TO', M, 64);

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(member?.full_name ?? 'Member', M, 72);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  if (member?.phone) doc.text(`Phone: ${member.phone}`, M, 79);
  if (member?.email) doc.text(`Email: ${member.email}`, M, 85);
  if (member?.address) doc.text(`Address: ${member.address}`, M, 91);

  // ── Invoice Details (right side) ─────────────────────────
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE DETAILS', PW - M, 64, { align: 'right' });

  const details = [
    ['Invoice #', invoice.invoice_number],
    ['Date',      formatDate(invoice.created_at)],
    ['Due Date',  formatDate(invoice.due_date)],
    ['Plan',      member?.membership_plan ?? '—'],
  ];
  details.forEach(([label, value], i) => {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 80);
    doc.text(label + ':', PW - M - 50, 72 + i * 8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    doc.text(value, PW - M, 72 + i * 8, { align: 'right' });
  });

  // ── Line separator ───────────────────────────────────────
  doc.setDrawColor(230, 230, 230);
  doc.line(M, 100, PW - M, 100);

  // ── Items Table ──────────────────────────────────────────
  autoTable(doc, {
    startY: 108,
    head: [['Description', 'Plan', 'Amount']],
    body: [
      [`${settings.gym_name} — Membership Fee`, member?.membership_plan ?? '—', formatCurrency(invoice.amount)],
    ],
    foot: [
      ['', 'TOTAL DUE', formatCurrency(invoice.amount)],
    ],
    headStyles: {
      fillColor: [0, 0, 0],
      textColor: [255, 215, 0],
      fontStyle: 'bold',
      fontSize: 9,
    },
    footStyles: {
      fillColor: [255, 215, 0],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      fontSize: 10,
    },
    bodyStyles: { fontSize: 9, textColor: [50, 50, 50] },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 40, halign: 'center' },
      2: { halign: 'right', fontStyle: 'bold' },
    },
    margin: { left: M, right: M },
    theme: 'grid',
    styles: { cellPadding: 5 },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });

  // ── Notes ────────────────────────────────────────────────
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (invoice.notes) {
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    doc.text('Notes:', M, finalY);
    doc.setTextColor(50, 50, 50);
    doc.text(invoice.notes, M, finalY + 6);
  }

  // ── Footer ───────────────────────────────────────────────
  doc.setFillColor(0, 0, 0);
  doc.rect(0, PH - 22, PW, 22, 'F');
  doc.setTextColor(255, 215, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Thank you for choosing ' + settings.gym_name + '!', PW / 2, PH - 12, { align: 'center' });
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text('This is a computer-generated invoice and does not require a signature.', PW / 2, PH - 6, { align: 'center' });

  // ── Save ─────────────────────────────────────────────────
  doc.save(`${invoice.invoice_number}.pdf`);
}
