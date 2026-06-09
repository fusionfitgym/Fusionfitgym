import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
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

export function getMembershipExpiry(joinDate: string, plan: string): Date {
  const d = new Date(joinDate);
  switch (plan) {
    case 'Monthly':    d.setMonth(d.getMonth() + 1);  break;
    case 'Quarterly':  d.setMonth(d.getMonth() + 3);  break;
    case 'Biannual':   d.setMonth(d.getMonth() + 6);  break;
    case 'Annual':     d.setFullYear(d.getFullYear() + 1); break;
  }
  return d;
}

export function isExpiringSoon(joinDate: string, plan: string, days = 7): boolean {
  const expiry = getMembershipExpiry(joinDate, plan);
  const now = new Date();
  const diff = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= days;
}
