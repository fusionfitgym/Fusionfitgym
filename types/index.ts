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
  gender: 'Gents' | 'Ladies';
  duration: string;
  training_type: 'Weight Training Only' | 'Weight Training + Cardio' | 'Weight Training + Strength Training';
  membership_fee: number;
  parq_purchased: boolean;
  parq_fee: number;
  trainer_package: boolean;
  trainer_fee: number;
  admission_fee: number;
  machine_type: 'Gents' | 'Ladies';
  // Advanced billing fields
  locker_fee?: number;
  diet_plan_fee?: number;
  discount?: number;
  tax?: number;
  payment_method?: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Online Payment' | '';
  paid_amount?: number;
  pt_package_id?: string | null;
  // Legacy fields
  membership_plan?: 'Monthly' | 'Quarterly' | 'Biannual' | 'Annual' | null;
  join_date?: string | null;
  status: 'Active' | 'Inactive' | 'Expired' | 'Frozen';
  profile_photo?: string | null;
  biometric_user_id?: string | null;
  biometric_status?: 'ENABLED' | 'DISABLED' | 'BLOCKED' | 'DELETED' | 'PENDING' | null;
  biometric_last_sync?: string | null;
  biometric_last_verification?: string | null;
  biometric_last_device_response?: string | null;
  membership_status?: string | null;
  last_checkin?: string | null;
  sms_sent?: boolean;
  sms_sent_at?: string | null;
  sms_status?: string | null;
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
  biometric_status: z.string().optional().or(z.literal('')),
  membership_status: z.string().optional().or(z.literal('')),
  gender: z.enum(['Gents', 'Ladies']),
  duration: z.string().min(1, 'Duration is required'),
  training_type: z.enum(['Weight Training Only', 'Weight Training + Cardio', 'Weight Training + Strength Training']),
  membership_fee: z.coerce.number().min(0),
  parq_purchased: z.boolean(),
  parq_fee: z.coerce.number().min(0),
  trainer_package: z.boolean(),
  trainer_fee: z.coerce.number().min(0),
  admission_fee: z.coerce.number().min(0),
  machine_type: z.enum(['Gents', 'Ladies']),
  locker_fee: z.coerce.number().min(0).optional(),
  diet_plan_fee: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  payment_method: z.string().optional().or(z.literal('')),
  paid_amount: z.coerce.number().min(0).optional(),
  pt_package_id: z.string().uuid().nullable().optional().or(z.literal('')),
});

export type MemberFormValues = z.infer<typeof memberSchema>;

// ── Attendance Logs ──────────────────────────────────────────
export interface AttendanceLog {
  id: string;
  member_id: string;
  member_name: string;
  biometric_user_id: string;
  machine_type?: 'Gents' | 'Ladies';
  device_id?: string;
  punch_time: string;
  punch_type: 'checkin' | 'checkout';
  created_at?: string;
  member?: Member;
  sync_status?: string;
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
  status: 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending' | 'Overdue' | 'Cancelled';
  pdf_url?: string | null;
  invoice_token?: string | null;
  invoice_link?: string | null;
  notes?: string | null;
  created_at: string;
  membership_fee?: number;
  parq_fee?: number;
  trainer_fee?: number;
  admission_fee?: number;
  locker_fee?: number;
  diet_plan_fee?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  paid_amount?: number;
  balance_due?: number;
  payment_method?: string | null;
  transaction_id?: string | null;
  payment_date?: string | null;
  trainer_name?: string | null;
  membership_start_date?: string | null;
  membership_expiry_date?: string | null;
  member?: Pick<Member, 'full_name' | 'phone' | 'email' | 'address' | 'package_name' | 'package_duration' | 'package_price' | 'package_start_date' | 'package_end_date'>;
}

export const invoiceSchema = z.object({
  member_id: z.string().uuid('Select a member'),
  amount: z.coerce.number().min(0, 'Amount must be 0 or greater'),
  due_date: z.string().min(1, 'Due date is required'),
  status: z.enum(['Paid', 'Partially Paid', 'Unpaid', 'Pending', 'Overdue', 'Cancelled']),
  notes: z.string().optional().or(z.literal('')),
  locker_fee: z.coerce.number().min(0).optional(),
  diet_plan_fee: z.coerce.number().min(0).optional(),
  subtotal: z.coerce.number().min(0).optional(),
  discount: z.coerce.number().min(0).optional(),
  tax: z.coerce.number().min(0).optional(),
  paid_amount: z.coerce.number().min(0).optional(),
  balance_due: z.coerce.number().min(0).optional(),
  payment_method: z.string().optional().nullable(),
  transaction_id: z.string().optional().nullable(),
  payment_date: z.string().optional().nullable(),
  trainer_name: z.string().optional().nullable(),
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
  plan_ladies_wt_1m?: string;
  plan_ladies_ws_1m?: string;
  plan_ladies_wt_3m?: string;
  plan_ladies_ws_3m?: string;
  plan_ladies_wt_6m?: string;
  plan_ladies_ws_6m?: string;
  plan_gents_wt_1m?: string;
  plan_gents_wc_1m?: string;
  plan_gents_wt_3m?: string;
  plan_gents_wc_3m?: string;
  plan_gents_wt_6m?: string;
  plan_gents_wc_6m?: string;
  sms_provider_name?: string;
  sms_api_url?: string;
  sms_api_key?: string;
  sms_sender_id?: string;
  sms_enabled: boolean;
  gym_logo?: string;
  sms_automation_new_member?: boolean;
  sms_automation_expires_7?: boolean;
  sms_automation_expires_3?: boolean;
  sms_automation_expires_today?: boolean;
  sms_automation_expired?: boolean;
  sms_automation_invoice?: boolean;
  sms_automation_payment?: boolean;
  // Invoice generation settings
  invoice_prefix?: string;
  invoice_starting_number?: string;
  invoice_gst_percent?: string;
  invoice_currency?: string;
  invoice_footer?: string;
  invoice_terms?: string;
  invoice_auto_generation?: boolean;
  default_welcome_template?: string;
  sms_textbee_enabled?: boolean;
}

// ── SMS Logs ────────────────────────────────────────────────
export interface SMSLog {
  id: string;
  member_id: string | null;
  phone?: string;
  phone_number?: string;
  sms_type?: string;
  message_type?: string;
  message: string;
  status: string | null;
  provider_response?: string | null;
  device_id?: string | null;
  sent_at?: string | null;
  last_resend_at?: string | null;
  resend_count?: number;
  created_at: string;
  member?: {
    full_name: string;
  } | null;
  provider?: string | null;
  provider_message_id?: string | null;
  provider_metadata?: Record<string, any> | null;
  notification_key?: string | null;
  last_attempt_at?: string | null;
  attempt_count?: number;
}


export const MEMBERSHIP_PLANS = ['Daily Pass', '1 Month', '3 Months', '6 Months', 'Cardio'] as const;
export const MEMBER_STATUSES = ['Active', 'Inactive', 'Expired', 'Frozen'] as const;
export const INVOICE_STATUSES = ['Paid', 'Partially Paid', 'Unpaid', 'Pending', 'Overdue', 'Cancelled'] as const;

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
  machine_type?: 'Gents' | 'Ladies';
  status: 'Success' | 'Failed';
  message: string;
  punch_time: string;
  created_at?: string;
}

export interface BiometricAction {
  id: string;
  member_id: string;
  biometric_id: string;
  action: 'enable' | 'disable';
  status: 'pending' | 'completed' | 'failed';
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

// ── Staff (Trainers & Janitors) ──────────────────────────────
export interface Staff {
  id: string;
  employee_id: string;
  full_name: string;
  role: 'Trainer' | 'Janitor';
  gender?: 'Male' | 'Female' | 'Other' | null;
  dob?: string | null;
  phone: string;
  email?: string | null;
  address?: string | null;
  emergency_contact?: string | null;
  profile_photo?: string | null;
  salary?: number | null;
  joining_date: string;
  shift?: 'Morning' | 'Evening' | 'Night' | 'Full Day' | null;
  status: 'Active' | 'Inactive';
  // Trainer-specific
  specialization?: string | null;
  experience?: number | null;
  certifications?: string | null;
  // Janitor-specific
  cleaning_area?: string | null;
  working_shift?: string | null;
  // Common
  notes?: string | null;
  biometric_gents_id?: string | null;
  biometric_ladies_id?: string | null;
  biometric_status?: 'ENABLED' | 'DISABLED' | 'BLOCKED' | 'DELETED' | 'PENDING' | null;
  biometric_last_sync?: string | null;
  biometric_last_verification?: string | null;
  biometric_last_device_response?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const STAFF_ROLES = ['Trainer', 'Janitor'] as const;
export const STAFF_STATUSES = ['Active', 'Inactive'] as const;
export const STAFF_SHIFTS = ['Morning', 'Evening', 'Night', 'Full Day'] as const;
export const STAFF_GENDERS = ['Male', 'Female', 'Other'] as const;

export const staffSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  role: z.enum(['Trainer', 'Janitor']),
  gender: z.enum(['Male', 'Female', 'Other']).optional().or(z.literal('')),
  dob: z.string().optional().or(z.literal('')),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  emergency_contact: z.string().optional().or(z.literal('')),
  profile_photo: z.string().optional().or(z.literal('')),
  employee_id: z.string().optional().or(z.literal('')),
  salary: z.coerce.number().min(0).optional().or(z.literal('')),
  joining_date: z.string().min(1, 'Joining date is required'),
  shift: z.enum(['Morning', 'Evening', 'Night', 'Full Day']).optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive']),
  biometric_gents_id: z.string().optional().or(z.literal(''))
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "Biometric Gents ID must contain numeric digits only",
    }),
  biometric_ladies_id: z.string().optional().or(z.literal(''))
    .refine((val) => !val || /^\d+$/.test(val), {
      message: "Biometric Ladies ID must contain numeric digits only",
    }),
  // Trainer-specific
  specialization: z.string().optional().or(z.literal('')),
  experience: z.coerce.number().min(0).optional().or(z.literal('')),
  certifications: z.string().optional().or(z.literal('')),
  // Janitor-specific
  cleaning_area: z.string().optional().or(z.literal('')),
  working_shift: z.string().optional().or(z.literal('')),
  // Common
  notes: z.string().optional().or(z.literal('')),
});

export type StaffFormValues = z.infer<typeof staffSchema>;
export type StaffFormInput = z.input<typeof staffSchema>;
