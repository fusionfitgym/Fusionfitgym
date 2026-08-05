import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  const hasDecimals = amount % 1 !== 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function toLocalDateString(date: Date | string = new Date()): string {
  if (!date) return '';
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return date;
    }
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  let d: Date;
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, dayNum] = date.split('-').map(Number);
      d = new Date(y, m - 1, dayNum);
    } else {
      d = new Date(date);
    }
  } else {
    d = date;
  }
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function calculateAge(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function calculateBMI(weight: number, height: number): number {
  const heightM = height / 100;
  return parseFloat((weight / (heightM * heightM)).toFixed(1));
}

export function getBMICategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Underweight', color: '#60a5fa' };
  if (bmi < 25)   return { label: 'Normal',       color: '#4ade80' };
  if (bmi < 30)   return { label: 'Overweight',   color: '#fb923c' };
  return                  { label: 'Obese',        color: '#f87171' };
}

export function getMembershipExpiry(joinDate: string | null | undefined, plan: string | null | undefined): Date {
  if (!joinDate) return new Date();
  const d = new Date(joinDate);
  if (isNaN(d.getTime())) return new Date();
  switch (plan) {
    case 'Monthly':    d.setMonth(d.getMonth() + 1);  break;
    case 'Quarterly':  d.setMonth(d.getMonth() + 3);  break;
    case 'Biannual':   d.setMonth(d.getMonth() + 6);  break;
    case 'Annual':     d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export function isExpiringSoon(joinDate: string | null | undefined, plan: string | null | undefined, days = 7): boolean {
  if (!joinDate || !plan) return false;
  const expiry = getMembershipExpiry(joinDate, plan);
  if (isNaN(expiry.getTime())) return false;
  const now = new Date();
  const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}

export interface MonthlyCycleRange {
  startDate: Date;
  endDate: Date;
  startDateStr: string;
  endDateStr: string;
  formattedRange: string;
  startDayMonth: string;
  endDayMonth: string;
}

export function getMonthlyCycleRange(refDate: Date | string = new Date()): MonthlyCycleRange {
  let d: Date;
  if (typeof refDate === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(refDate)) {
      const [y, m, dayNum] = refDate.split('-').map(Number);
      d = new Date(y, m - 1, dayNum);
    } else {
      d = new Date(refDate);
    }
  } else {
    d = refDate;
  }
  if (isNaN(d.getTime())) {
    d = new Date();
  }

  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();

  let startYear = year;
  let startMonth = month;

  if (day < 4) {
    if (month === 0) {
      startYear = year - 1;
      startMonth = 11;
    } else {
      startMonth = month - 1;
    }
  }

  const startDate = new Date(startYear, startMonth, 4, 0, 0, 0, 0);
  const endYear = startMonth === 11 ? startYear + 1 : startYear;
  const endMonth = (startMonth + 1) % 12;
  const endDate = new Date(endYear, endMonth, 3, 23, 59, 59, 999);

  const pad = (n: number) => String(n).padStart(2, '0');
  const startDateStr = `${startDate.getFullYear()}-${pad(startDate.getMonth() + 1)}-${pad(startDate.getDate())}`;
  const endDateStr = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`;

  const formatShort = (date: Date) => date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return {
    startDate,
    endDate,
    startDateStr,
    endDateStr,
    formattedRange: `${formatShort(startDate)} – ${formatShort(endDate)}`,
    startDayMonth: startDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    endDayMonth: endDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
  };
}

export function isInvoiceInCycle(invoice: any, cycle: MonthlyCycleRange): boolean {
  if (!invoice) return false;
  const status = String(invoice.status || '').toLowerCase();
  if (status !== 'paid') return false;

  const rawDate = invoice.payment_date || invoice.created_at;
  if (!rawDate) return false;

  if (typeof rawDate === 'string') {
    const datePart = rawDate.split('T')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart >= cycle.startDateStr && datePart <= cycle.endDateStr;
    }
  }

  const d = new Date(rawDate);
  if (isNaN(d.getTime())) return false;
  return d >= cycle.startDate && d <= cycle.endDate;
}

