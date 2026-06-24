import { z } from 'zod';

// ── Member ──────────────────────────────────────────────────
export interface Member {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  dob?: string | null;
  package_name: string;
  package_duration: string;
  package_price: number;
  package_start_date: string;
  package_end_date: string;
  // Legacy fields
  membership_plan?: 'Monthly' | 'Quarterly' | 'Biannual' | 'Annual' | null;
  join_date?: string | null;
  status: 'Active' | 'Inactive' | 'Expired' | 'Frozen';
  profile_photo?: string | null;
  biometric_user_id?: string | null;
  membership_status?: string | null;
  last_checkin?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const memberSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergency_contact: z.string().optional().or(z.literal('')),
  dob: z.string().min(1, 'Date of birth is required'),
  package_name: z.string().min(1, 'Package name is required'),
  package_duration: z.string().min(1, 'Package duration is required'),
  package_price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  package_start_date: z.string().min(1, 'Start date is required'),
  package_end_date: z.string().min(1, 'End date is required'),
  status: z.enum(['Active', 'Inactive', 'Expired', 'Frozen']),
  profile_photo: z.string().optional().or(z.literal('')),
  biometric_user_id: z.string().optional().or(z.literal(''))
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "Biometric User ID must contain numeric digits only",
    }),
  membership_status: z.string().optional().or(z.literal('')),
});

export type MemberFormValues = z.infer<typeof memberSchema>;

// ── Attendance Logs ──────────────────────────────────────────
export interface AttendanceLog {
  id: string;
  member_id: string;
  member_name: string;
  biometric_user_id: string;
  punch_time: string;
  punch_type: 'checkin' | 'checkout';
  created_at?: string;
  member?: Member;
}

// ── PAR-Q ───────────────────────────────────────────────────
export interface ParqResponse {
  id: string;
  member_id: string;
  answers: Record<string, boolean | string>;
  notes?: string | null;
  created_at: string;
  member?: Pick<Member, 'full_name' | 'phone'>;
}

export const PARQ_QUESTIONS = [
  {
    id: 'q1',
    text: 'Has your doctor ever said that you have a heart condition and that you should only do physical activity recommended by a doctor?',
  },
  {
    id: 'q2',
    text: 'Do you feel pain in your chest when you do physical activity?',
  },
  {
    id: 'q3',
    text: 'In the past month, have you had chest pain when you were not doing physical activity?',
  },
  {
    id: 'q4',
    text: 'Do you lose your balance because of dizziness or do you ever lose consciousness?',
  },
  {
    id: 'q5',
    text: 'Do you have a bone or joint problem (for example, back, knee or hip) that could be made worse by a change in your physical activity?',
  },
  {
    id: 'q6',
    text: 'Is your doctor currently prescribing drugs (for example, water pills) for your blood pressure or heart condition?',
  },
  {
    id: 'q7',
    text: 'Do you know of any other reason why you should not do physical activity?',
  },
];

export const parqSchema = z.object({
  member_id: z.string().uuid('Select a member'),
  q1: z.enum(['yes', 'no']),
  q2: z.enum(['yes', 'no']),
  q3: z.enum(['yes', 'no']),
  q4: z.enum(['yes', 'no']),
  q5: z.enum(['yes', 'no']),
  q6: z.enum(['yes', 'no']),
  q7: z.enum(['yes', 'no']),
  notes: z.string().optional().or(z.literal('')),
});

export type ParqFormValues = z.infer<typeof parqSchema>;

// ── Health Assessment ───────────────────────────────────────
export interface HealthAssessment {
  id: string;
  member_id: string;
  height?: number | null;
  weight?: number | null;
  bmi?: number | null;
  body_fat?: number | null;
  injuries?: string | null;
  medical_conditions?: string | null;
  notes?: string | null;
  created_at: string;
  member?: Pick<Member, 'full_name'>;
}

export const healthSchema = z.object({
  member_id: z.string().uuid('Select a member'),
  height: z.coerce.number().min(50).max(300).optional(),
  weight: z.coerce.number().min(10).max(500).optional(),
  body_fat: z.coerce.number().min(0).max(100).optional(),
  injuries: z.string().optional().or(z.literal('')),
  medical_conditions: z.string().optional().or(z.literal('')),
  notes: z.string().optional().or(z.literal('')),
});

export type HealthFormValues = z.infer<typeof healthSchema>;
export type HealthFormInput = z.input<typeof healthSchema>;

// ── Invoice ─────────────────────────────────────────────────
export interface Invoice {
  id: string;
  member_id: string;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  pdf_url?: string | null;
  notes?: string | null;
  created_at: string;
  member?: Pick<Member, 'full_name' | 'phone' | 'email' | 'address' | 'package_name' | 'package_duration' | 'package_price' | 'package_start_date' | 'package_end_date'>;
}

export const invoiceSchema = z.object({
  member_id: z.string().uuid('Select a member'),
  amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
  due_date: z.string().min(1, 'Due date is required'),
  status: z.enum(['Paid', 'Pending', 'Overdue']),
  notes: z.string().optional().or(z.literal('')),
});

export type InvoiceFormValues = z.infer<typeof invoiceSchema>;
export type InvoiceFormInput = z.input<typeof invoiceSchema>;

// ── Settings ────────────────────────────────────────────────
export interface GymSettings {
  gym_name: string;
  gym_phone: string;
  gym_email: string;
  gym_address: string;
  plan_monthly: string;
  plan_quarterly: string;
  plan_biannual: string;
  plan_annual: string;
  sms_provider_name: string;
  sms_api_url: string;
  sms_api_key: string;
  sms_sender_id: string;
  sms_enabled: boolean;
  gym_logo?: string;
}

// ── SMS Logs ────────────────────────────────────────────────
export interface SMSLog {
  id: string;
  member_id: string | null;
  phone: string;
  sms_type: string;
  message: string;
  status: string | null;
  provider_response: string | null;
  created_at: string;
  member?: {
    full_name: string;
  } | null;
}


export const MEMBERSHIP_PLANS = ['Monthly', 'Quarterly', 'Biannual', 'Annual'] as const;
export const MEMBER_STATUSES = ['Active', 'Inactive', 'Expired', 'Frozen'] as const;
export const INVOICE_STATUSES = ['Paid', 'Pending', 'Overdue'] as const;

// ── Biometric Devices & Sync Logs ────────────────────────────
export interface BiometricDevice {
  id: string;
  name: string;
  serial_number: string;
  ip_address?: string | null;
  status: 'Online' | 'Offline';
  last_sync?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface BiometricSyncLog {
  id: string;
  biometric_user_id: string;
  status: 'Success' | 'Failed';
  message: string;
  punch_time: string;
  created_at?: string;
}
