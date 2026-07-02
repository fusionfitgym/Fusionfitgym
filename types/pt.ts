import { z } from 'zod';

// ── 1. Trainers ──────────────────────────────────────────────
export interface PTTrainer {
  id: string;
  auth_user_id?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  specialization?: string | null;
  availability?: string | null;
  working_hours?: string | null;
  commission_type: 'Percentage' | 'Fixed' | 'Per Session' | 'Per Package';
  commission_value: number;
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

export const ptTrainerSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  specialization: z.string().optional().or(z.literal('')),
  availability: z.string().optional().or(z.literal('')),
  working_hours: z.string().optional().or(z.literal('')),
  commission_type: z.enum(['Percentage', 'Fixed', 'Per Session', 'Per Package']),
  commission_value: z.coerce.number().min(0, 'Commission value must be 0 or greater'),
  status: z.enum(['Active', 'Inactive']),
  auth_user_id: z.string().optional().nullable(),
});

export type PTTrainerFormValues = z.infer<typeof ptTrainerSchema>;

// ── 2. Packages ──────────────────────────────────────────────
export interface PTPackage {
  id: string;
  package_name: string;
  description?: string | null;
  trainer_id?: string | null;
  number_of_sessions: number;
  duration: number; // in days
  price: number;
  discount: number;
  final_price: number;
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  trainer?: PTTrainer | null;
}

export const ptPackageSchema = z.object({
  package_name: z.string().min(2, 'Package name must be at least 2 characters'),
  description: z.string().optional().or(z.literal('')),
  trainer_id: z.string().optional().nullable(),
  number_of_sessions: z.coerce.number().int().min(1, 'Must purchase at least 1 session'),
  duration: z.coerce.number().int().min(1, 'Duration must be at least 1 day'),
  price: z.coerce.number().min(0, 'Price must be 0 or greater'),
  discount: z.coerce.number().min(0, 'Discount must be 0 or greater'),
  final_price: z.coerce.number().min(0, 'Final price must be 0 or greater'),
  status: z.enum(['Active', 'Inactive']),
});

export type PTPackageFormValues = z.infer<typeof ptPackageSchema>;

// ── 3. Clients ───────────────────────────────────────────────
export interface PTClient {
  id: string;
  member_id?: string | null;
  full_name: string;
  phone: string;
  email?: string | null;
  emergency_contact?: string | null;
  trainer_id?: string | null;
  package_id?: string | null;
  sessions_purchased: number;
  sessions_remaining: number;
  package_start_date: string;
  expiry_date: string;
  height?: number | null;
  weight?: number | null;
  body_fat?: number | null;
  goal?: string | null;
  medical_notes?: string | null;
  status: 'Active' | 'Inactive' | 'Expired';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
  trainer?: PTTrainer | null;
  package?: PTPackage | null;
}

export const ptClientSchema = z.object({
  member_id: z.string().optional().nullable(),
  full_name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(7, 'Enter a valid phone number'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  emergency_contact: z.string().optional().or(z.literal('')),
  trainer_id: z.string().optional().nullable(),
  package_id: z.string().optional().nullable(),
  sessions_purchased: z.coerce.number().int().min(0),
  sessions_remaining: z.coerce.number().int().min(0),
  package_start_date: z.string().min(1, 'Start date is required'),
  expiry_date: z.string().min(1, 'Expiry date is required'),
  height: z.coerce.number().optional().nullable(),
  weight: z.coerce.number().optional().nullable(),
  body_fat: z.coerce.number().optional().nullable(),
  goal: z.string().optional().or(z.literal('')),
  medical_notes: z.string().optional().or(z.literal('')),
  status: z.enum(['Active', 'Inactive', 'Expired']),
});

export type PTClientFormValues = z.infer<typeof ptClientSchema>;

// ── 4. Sessions ──────────────────────────────────────────────
export interface PTSession {
  id: string;
  client_id: string;
  trainer_id: string;
  session_date: string;
  session_time: string;
  duration: number; // in minutes
  workout_plan?: string | null;
  status: 'Scheduled' | 'Completed' | 'Missed' | 'Cancelled' | 'Rescheduled';
  is_recurring: boolean;
  recurrence_rule?: string | null;
  created_at?: string;
  updated_at?: string;
  client?: PTClient;
  trainer?: PTTrainer;
}

export const ptSessionSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  trainer_id: z.string().min(1, 'Trainer is required'),
  session_date: z.string().min(1, 'Date is required'),
  session_time: z.string().min(1, 'Time is required'),
  duration: z.coerce.number().int().min(1, 'Duration is required'),
  workout_plan: z.string().optional().or(z.literal('')),
  status: z.enum(['Scheduled', 'Completed', 'Missed', 'Cancelled', 'Rescheduled']),
  is_recurring: z.boolean().default(false),
  recurrence_rule: z.string().optional().nullable(),
});

export type PTSessionFormValues = z.infer<typeof ptSessionSchema>;

// ── 5. Progress Tracking ─────────────────────────────────────
export interface PTProgress {
  id: string;
  client_id: string;
  date: string;
  weight?: number | null;
  height?: number | null;
  bmi?: number | null;
  body_fat?: number | null;
  chest?: number | null;
  waist?: number | null;
  arms?: number | null;
  legs?: number | null;
  photo_before?: string | null;
  photo_after?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export const ptProgressSchema = z.object({
  client_id: z.string().min(1),
  date: z.string().min(1),
  weight: z.coerce.number().optional().nullable(),
  height: z.coerce.number().optional().nullable(),
  bmi: z.coerce.number().optional().nullable(),
  body_fat: z.coerce.number().optional().nullable(),
  chest: z.coerce.number().optional().nullable(),
  waist: z.coerce.number().optional().nullable(),
  arms: z.coerce.number().optional().nullable(),
  legs: z.coerce.number().optional().nullable(),
  photo_before: z.string().optional().nullable(),
  photo_after: z.string().optional().nullable(),
  notes: z.string().optional().or(z.literal('')),
});

export type PTProgressFormValues = z.infer<typeof ptProgressSchema>;

// ── 6. Invoices ──────────────────────────────────────────────
export interface PTInvoice {
  id: string;
  client_id: string;
  invoice_number: string;
  invoice_date: string;
  trainer_id?: string | null;
  package_id?: string | null;
  package_name: string;
  sessions_included: number;
  sessions_remaining_at_invoice: number;
  price: number;
  discount: number;
  gst_amount: number;
  tax_amount: number;
  final_amount: number;
  payment_method?: string | null;
  paid_amount: number;
  balance_due: number;
  due_date: string;
  next_due_date?: string | null;
  status: 'Paid' | 'Pending' | 'Overdue';
  terms_conditions?: string | null;
  created_at?: string;
  updated_at?: string;
  client?: PTClient;
  trainer?: PTTrainer;
}

export const ptInvoiceSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  invoice_date: z.string().min(1, 'Invoice date is required'),
  trainer_id: z.string().optional().nullable(),
  package_id: z.string().optional().nullable(),
  package_name: z.string().min(1, 'Package name is required'),
  sessions_included: z.coerce.number().int().min(1),
  sessions_remaining_at_invoice: z.coerce.number().int().min(0),
  price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0),
  gst_amount: z.coerce.number().min(0),
  tax_amount: z.coerce.number().min(0),
  final_amount: z.coerce.number().min(0),
  payment_method: z.string().optional().nullable(),
  paid_amount: z.coerce.number().min(0),
  balance_due: z.coerce.number().min(0),
  due_date: z.string().min(1, 'Due date is required'),
  next_due_date: z.string().optional().nullable(),
  status: z.enum(['Paid', 'Pending', 'Overdue']),
  terms_conditions: z.string().optional().or(z.literal('')),
});

export type PTInvoiceFormValues = z.infer<typeof ptInvoiceSchema>;

// ── 7. Payments ──────────────────────────────────────────────
export interface PTPayment {
  id: string;
  client_id: string;
  invoice_id?: string | null;
  amount_paid: number;
  payment_date: string;
  payment_method: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer' | 'Split Payment' | 'Partial Payment';
  split_details?: Record<string, number> | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  client?: PTClient;
  invoice?: PTInvoice;
}

export const ptPaymentSchema = z.object({
  client_id: z.string().min(1, 'Client is required'),
  invoice_id: z.string().optional().nullable(),
  amount_paid: z.coerce.number().min(1, 'Amount paid must be greater than 0'),
  payment_date: z.string().min(1, 'Payment date is required'),
  payment_method: z.enum(['Cash', 'UPI', 'Card', 'Bank Transfer', 'Split Payment', 'Partial Payment']),
  split_details: z.record(z.string(), z.coerce.number()).optional().nullable(),
  notes: z.string().optional().or(z.literal('')),
});

export type PTPaymentFormValues = z.infer<typeof ptPaymentSchema>;

// ── 8. Commissions ───────────────────────────────────────────
export interface PTCommission {
  id: string;
  trainer_id: string;
  client_id?: string | null;
  session_id?: string | null;
  invoice_id?: string | null;
  amount: number;
  commission_date: string;
  status: 'Pending' | 'Paid';
  paid_date?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
  trainer?: PTTrainer;
  client?: PTClient;
  session?: PTSession;
  invoice?: PTInvoice;
}

// ── 9. Notifications ─────────────────────────────────────────
export interface PTNotification {
  id: string;
  client_id?: string | null;
  trainer_id?: string | null;
  type: 'Upcoming Session' | 'Missed Session' | 'Package Expiry' | 'Low Remaining Sessions' | 'Pending Payment' | 'Trainer Schedule Reminder';
  message: string;
  is_read: boolean;
  created_at?: string;
  client?: PTClient;
  trainer?: PTTrainer;
}
