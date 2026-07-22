'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Member, Invoice, AttendanceLog, GymSettings, SMSLog, HealthAssessment, ParqResponse, BiometricDevice, Staff, MembershipRenewal } from '@/types';
import {
  PTTrainer,
  PTPackage,
  PTClient,
  PTSession,
  PTPayment,
  PTInvoice,
  PTCommission,
  PTNotification,
  PTProgress
} from '@/types/pt';

// Import local JSON demo data
import dashboardData from '@/src/demo-data/dashboard.json';
import membersData from '@/src/demo-data/members.json';
import trainersData from '@/src/demo-data/trainers.json';
import attendanceData from '@/src/demo-data/attendance.json';
import membershipsData from '@/src/demo-data/memberships.json';
import paymentsData from '@/src/demo-data/payments.json';
import expensesData from '@/src/demo-data/expenses.json';
import callLogsData from '@/src/demo-data/call_logs.json';
import notificationsData from '@/src/demo-data/notifications.json';
import staffData from '@/src/demo-data/staff.json';

interface DemoStateContextType {
  members: Member[];
  invoices: Invoice[];
  attendance: AttendanceLog[];
  trainers: any[];
  expenses: any[];
  callLogs: any[];
  notifications: any[];
  settings: GymSettings;
  devices: BiometricDevice[];
  smsLogs: SMSLog[];
  healthAssessments: HealthAssessment[];
  parqResponses: ParqResponse[];
  staff: Staff[];
  renewals: MembershipRenewal[];

  // PT States
  ptTrainers: PTTrainer[];
  ptPackages: PTPackage[];
  ptClients: PTClient[];
  ptSessions: PTSession[];
  ptPayments: PTPayment[];
  ptInvoices: PTInvoice[];
  ptCommissions: PTCommission[];
  ptNotifications: PTNotification[];
  ptProgress: PTProgress[];

  // Mutators
  getMembers: () => Member[];
  getMemberById: (id: string) => Member | null;
  createMember: (values: any) => { data?: Member; error?: string; invoiceId?: string | null };
  updateMember: (id: string, values: any) => { data?: Member; error?: string };
  renewMember: (params: any) => { success: boolean; member?: Member; invoiceId?: string; invoiceNumber?: string; error?: string };
  getMemberRenewals: (memberId: string) => MembershipRenewal[];
  deleteMember: (id: string) => void;
  getMembersPaginated: (args: any) => { members: Member[]; totalCount: number };
  
  getInvoicesByMember: (memberId: string) => Invoice[];
  getInvoiceById: (id: string) => Invoice | null;
  createInvoice: (values: any) => Invoice;
  updateInvoiceStatus: (id: string, status: Invoice['status']) => Invoice | null;
  duplicateInvoice: (id: string) => { data?: Invoice; error?: string };
  cancelInvoice: (id: string) => { success: boolean; error?: string };
  recordAdditionalPayment: (id: string, amount: number, paymentMethod: string, transactionId?: string) => { success: boolean; error?: string };
  
  getAttendanceHistory: (args: { member_id?: string; device_id?: string }) => AttendanceLog[];
  getAttendanceAnalytics: () => any;
  deleteAttendanceLog: (id: string) => void;
  
  getSMSLogsByMember: (memberId: string) => SMSLog[];
  sendSMSAction: (memberId: string, message: string, type?: string) => Promise<{ success: boolean; error?: string }>;
  
  getSettings: () => GymSettings;
  saveSettings: (values: GymSettings) => void;

  getHealthByMember: (memberId: string) => HealthAssessment[];
  getHealthById: (id: string) => HealthAssessment | null;
  createHealthAssessment: (values: any) => HealthAssessment;
  
  getParqByMember: (memberId: string) => ParqResponse[];
  getParqById: (id: string) => ParqResponse | null;
  createParqResponse: (values: any) => ParqResponse;

  // Staff mutators
  getStaff: (args?: { search?: string; role?: string; status?: string; page?: number; limit?: number }) => { staff: Staff[]; totalCount: number };
  getStaffById: (id: string) => Staff | null;
  createStaff: (values: any) => { data?: Staff; error?: string };
  updateStaff: (id: string, values: any) => { data?: Staff; error?: string };
  deleteStaff: (id: string) => void;
  getStaffStats: () => { total: number; trainers: number; janitors: number; active: number };
  staffAttendance: any[];
  getStaffAttendanceHistory: (args?: { search?: string; role?: string; status?: string; timeframe?: string }) => any[];
  getStaffAttendanceTodayStats: () => { present: number; trainers: number; janitors: number; total: number };

  // PT Mutators
  getPTTrainers: () => PTTrainer[];
  getPTTrainerById: (id: string) => PTTrainer | null;
  createPTTrainer: (values: any) => { data?: PTTrainer; error?: string };
  updatePTTrainer: (id: string, values: any) => { data?: PTTrainer; error?: string };
  deletePTTrainer: (id: string) => void;

  getPTPackages: () => PTPackage[];
  getPTPackageById: (id: string) => PTPackage | null;
  createPTPackage: (values: any) => { data?: PTPackage; error?: string };
  updatePTPackage: (id: string, values: any) => { data?: PTPackage; error?: string };
  deletePTPackage: (id: string) => void;

  getPTClients: () => PTClient[];
  getPTClientById: (id: string) => PTClient | null;
  createPTClient: (values: any) => { data?: PTClient; error?: string };
  updatePTClient: (id: string, values: any) => { data?: PTClient; error?: string };
  deletePTClient: (id: string) => void;

  getPTSessions: () => PTSession[];
  getPTSessionById: (id: string) => PTSession | null;
  createPTSession: (values: any) => { data?: PTSession; error?: string };
  updatePTSession: (id: string, values: any) => { data?: PTSession; error?: string };
  deletePTSession: (id: string) => void;

  getPTSessionAttendance: (sessionId: string) => any[];
  markPTSessionAttendance: (sessionId: string, clientId: string, trainerId: string, date: string, status: any) => { success: boolean };

  getPTProgress: (clientId: string) => PTProgress[];
  createPTProgress: (values: any) => { data?: PTProgress; error?: string };
  deletePTProgress: (id: string) => void;

  getPTInvoices: () => PTInvoice[];
  getPTInvoiceById: (id: string) => PTInvoice | null;
  createPTInvoice: (values: any) => { data?: PTInvoice; error?: string };
  updatePTInvoice: (id: string, values: any) => { data?: PTInvoice; error?: string };

  getPTPayments: () => PTPayment[];
  createPTPayment: (values: any) => { data?: PTPayment; error?: string };

  getPTCommissions: () => PTCommission[];
  payPTCommission: (id: string) => { success: boolean };

  getPTNotifications: () => PTNotification[];
  markPTNotificationAsRead: (id: string) => void;

  getPTDashboardStats: () => any;
}

const DemoStateContext = createContext<DemoStateContextType | undefined>(undefined);

export function DemoStateProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<Member[]>(membersData as Member[]);
  const [invoices, setInvoices] = useState<Invoice[]>(paymentsData as Invoice[]);
  const [attendance, setAttendance] = useState<AttendanceLog[]>(attendanceData as AttendanceLog[]);
  const [trainers, setTrainers] = useState<any[]>(trainersData);
  const [expenses, setExpenses] = useState<any[]>(expensesData);
  const [callLogs, setCallLogs] = useState<any[]>(callLogsData);
  const [notifications, setNotifications] = useState<any[]>(notificationsData);
  const [staff, setStaff] = useState<Staff[]>(() => {
    const data = [...staffData] as Staff[];
    if (data[0]) { data[0].biometric_gents_id = '2051'; data[0].biometric_ladies_id = '2051'; }
    if (data[1]) { data[1].biometric_gents_id = '2052'; data[1].biometric_ladies_id = '2052'; }
    if (data[3]) { data[3].biometric_gents_id = '2053'; data[3].biometric_ladies_id = '2053'; }
    return data;
  });

  useEffect(() => {
    // Run auto-expiry check on demo members when provider mounts
    const todayStr = '2026-06-30'; // Demo date
    setMembers(prev => prev.map(m => {
      const isExpired = m.status === 'Active' && m.duration !== 'Daily Pass' && m.package_end_date && m.package_end_date < todayStr;
      if (isExpired) {
        return {
          ...m,
          status: 'Expired',
          biometric_status: 'DISABLED'
        };
      }
      // Set default biometric_status to ENABLED for others if undefined
      if (m.biometric_status === undefined) {
        return {
          ...m,
          biometric_status: m.status === 'Active' ? 'ENABLED' : 'DISABLED'
        };
      }
      return m;
    }));
  }, []);
  
  const [staffAttendance, setStaffAttendance] = useState<any[]>(() => {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    return [
      {
        id: 'mock-staff-att-1',
        staff_id: 'demo-staff-uuid-0001',
        full_name: 'Arun Krishnan',
        role: 'Trainer',
        biometric_user_id: '2051',
        date: today,
        check_in: today + 'T06:05:00.000Z',
        check_out: today + 'T14:10:00.000Z',
        status: 'Present',
        working_hours: 8.08,
        overtime_hours: 0.08,
        late_arrival_minutes: 5,
        shift: 'Morning'
      },
      {
        id: 'mock-staff-att-2',
        staff_id: 'demo-staff-uuid-0002',
        full_name: 'Deepa Menon',
        role: 'Trainer',
        biometric_user_id: '2052',
        date: today,
        check_in: today + 'T16:02:00.000Z',
        check_out: null,
        status: 'Present',
        working_hours: null,
        overtime_hours: null,
        late_arrival_minutes: 2,
        shift: 'Evening'
      },
      {
        id: 'mock-staff-att-3',
        staff_id: 'demo-staff-uuid-0004',
        full_name: 'Suresh Pillai',
        role: 'Janitor',
        biometric_user_id: '2053',
        date: today,
        check_in: today + 'T06:20:00.000Z',
        check_out: today + 'T14:00:00.000Z',
        status: 'Late',
        working_hours: 7.67,
        overtime_hours: 0,
        late_arrival_minutes: 20,
        shift: 'Morning'
      },
      {
        id: 'mock-staff-att-4',
        staff_id: 'demo-staff-uuid-0001',
        full_name: 'Arun Krishnan',
        role: 'Trainer',
        biometric_user_id: '2051',
        date: yesterday,
        check_in: yesterday + 'T06:00:00.000Z',
        check_out: yesterday + 'T14:00:00.000Z',
        status: 'Present',
        working_hours: 8.00,
        overtime_hours: 0.00,
        late_arrival_minutes: 0,
        shift: 'Morning'
      },
      {
        id: 'mock-staff-att-5',
        staff_id: 'demo-staff-uuid-0002',
        full_name: 'Deepa Menon',
        role: 'Trainer',
        biometric_user_id: '2052',
        date: yesterday,
        check_in: yesterday + 'T16:30:00.000Z',
        check_out: yesterday + 'T22:30:00.000Z',
        status: 'Late',
        working_hours: 6.00,
        overtime_hours: 0.00,
        late_arrival_minutes: 30,
        shift: 'Evening'
      }
    ];
  });
  
  const [settings, setSettings] = useState<GymSettings>({
    gym_name: 'FusionFit Gym (Demo)',
    gym_phone: '+91 98765 43210',
    gym_email: 'demo@redix.media',
    gym_address: '123 Fitness Street, Bangalore, Karnataka 560001',
    plan_monthly: '1500',
    plan_quarterly: '4000',
    plan_biannual: '7500',
    plan_annual: '14000',
    plan_ladies_wt_1m: '1000',
    plan_ladies_ws_1m: '1300',
    plan_ladies_wt_3m: '2750',
    plan_ladies_ws_3m: '3600',
    plan_ladies_wt_6m: '5800',
    plan_ladies_ws_6m: '7300',
    plan_gents_wt_1m: '1000',
    plan_gents_wc_1m: '1300',
    plan_gents_wt_3m: '2850',
    plan_gents_wc_3m: '3750',
    plan_gents_wt_6m: '5750',
    plan_gents_wc_6m: '7500',
    sms_provider_name: 'Fast2SMS',
    sms_enabled: true,
    sms_automation_new_member: true,
    sms_automation_expires_7: true,
    sms_automation_expires_3: true,
    sms_automation_expires_today: true,
    sms_automation_expired: true,
    sms_automation_invoice: true,
    sms_automation_payment: true
  });

  const [devices, setDevices] = useState<BiometricDevice[]>([
    { id: 'dev-1', name: 'Main Gents Entrance', serial_number: 'GENTS-MAIN-001', status: 'Online', last_sync: new Date().toISOString() },
    { id: 'dev-2', name: 'Main Ladies Entrance', serial_number: 'LADIES-MAIN-002', status: 'Online', last_sync: new Date().toISOString() }
  ]);

  const [smsLogs, setSmsLogs] = useState<SMSLog[]>([]);
  const [healthAssessments, setHealthAssessments] = useState<HealthAssessment[]>([]);
  const [parqResponses, setParqResponses] = useState<ParqResponse[]>([]);
  const [renewals, setRenewals] = useState<MembershipRenewal[]>([
    {
      id: 'demo-renewal-1',
      member_id: 'demo-member-uuid-0004',
      renewal_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      previous_package: '1 Month',
      new_package: '3 Months',
      previous_start_date: '2025-05-01',
      previous_end_date: '2025-06-01',
      new_start_date: '2025-06-01',
      new_end_date: '2025-09-01',
      invoice_number: 'INV-2025-000044',
      amount: 2750,
      discount: 0,
      payment_method: 'UPI',
      renewed_by: 'Admin User',
      notes: 'Renewed for 3 months package',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    }
  ]);


  // ── PT State Initializers with Mock Data ─────────────────────
  const [ptTrainers, setPtTrainers] = useState<PTTrainer[]>([
    {
      id: 'rohan-trainer',
      full_name: 'Rohan Sharma',
      phone: '+91 98000 00011',
      email: 'rohan.trainer@fusionfit.com',
      specialization: 'Weight Loss, Strength Training',
      availability: 'Mon - Sat',
      working_hours: '06:00 - 11:00, 17:00 - 21:00',
      commission_type: 'Percentage',
      commission_value: 20,
      status: 'Active',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'karan-trainer',
      full_name: 'Karan Malhotra',
      phone: '+91 98000 00022',
      email: 'karan.trainer@fusionfit.com',
      specialization: 'Bodybuilding, Athlete Prep',
      availability: 'Mon - Fri',
      working_hours: '07:00 - 12:00, 16:00 - 20:00',
      commission_type: 'Per Session',
      commission_value: 300,
      status: 'Active',
      created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]);

  const [ptPackages, setPtPackages] = useState<PTPackage[]>([
    {
      id: 'pkg-1',
      package_name: '12 Sessions Package',
      description: 'Standard 12 personal training sessions pack',
      trainer_id: null,
      number_of_sessions: 12,
      duration: 30,
      price: 6000,
      discount: 0,
      final_price: 6000,
      status: 'Active',
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pkg-2',
      package_name: '24 Sessions Package',
      description: 'Standard 24 personal training sessions pack',
      trainer_id: null,
      number_of_sessions: 24,
      duration: 60,
      price: 11000,
      discount: 1000,
      final_price: 10000,
      status: 'Active',
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pkg-3',
      package_name: 'Weight Loss Program',
      description: 'Specialized fat loss program with tailored nutrition guidance',
      trainer_id: 'rohan-trainer',
      number_of_sessions: 24,
      duration: 60,
      price: 18000,
      discount: 2000,
      final_price: 16000,
      status: 'Active',
      created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]);

  const [ptClients, setPtClients] = useState<PTClient[]>([
    {
      id: 'pt-client-1',
      member_id: 'demo-member-uuid-0001', // Arjun Sharma
      full_name: 'Arjun Sharma',
      phone: '+91 98001 11111',
      email: 'arjun@email.com',
      emergency_contact: '+91 98001 99999',
      trainer_id: 'rohan-trainer',
      package_id: 'pkg-1',
      sessions_purchased: 12,
      sessions_remaining: 8,
      package_start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      height: 178,
      weight: 85,
      body_fat: 24,
      goal: 'Fat loss and core strength',
      medical_notes: 'Mild lower back stiffness',
      status: 'Active',
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pt-client-2',
      member_id: 'demo-member-uuid-0002', // Priya Nair
      full_name: 'Priya Nair',
      phone: '+91 98002 22222',
      email: 'priya@email.com',
      emergency_contact: '+91 98002 99999',
      trainer_id: 'karan-trainer',
      package_id: 'pkg-3',
      sessions_purchased: 24,
      sessions_remaining: 24,
      package_start_date: new Date().toISOString().split('T')[0],
      expiry_date: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      height: 162,
      weight: 68,
      body_fat: 30,
      goal: 'Weight reduction and cardiovascular endurance',
      medical_notes: 'None',
      status: 'Active',
      created_at: new Date().toISOString(),
    }
  ]);

  const [ptSessions, setPtSessions] = useState<PTSession[]>([
    {
      id: 'sess-1',
      client_id: 'pt-client-1',
      trainer_id: 'rohan-trainer',
      session_date: new Date().toISOString().split('T')[0],
      session_time: '07:00',
      duration: 60,
      workout_plan: 'Lower body strength training (Squats, Lunges, Leg curls)',
      status: 'Scheduled',
      is_recurring: false,
    },
    {
      id: 'sess-2',
      client_id: 'pt-client-1',
      trainer_id: 'rohan-trainer',
      session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      session_time: '07:00',
      duration: 60,
      workout_plan: 'Upper body hypertrophy (Bench Press, Row, Shoulder Press)',
      status: 'Completed',
      is_recurring: false,
    },
    {
      id: 'sess-3',
      client_id: 'pt-client-1',
      trainer_id: 'rohan-trainer',
      session_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      session_time: '07:00',
      duration: 60,
      workout_plan: 'Active cardio and core conditioning',
      status: 'Completed',
      is_recurring: false,
    }
  ]);

  const [ptPayments, setPtPayments] = useState<PTPayment[]>([
    {
      id: 'pay-1',
      client_id: 'pt-client-1',
      invoice_id: 'pt-inv-1',
      amount_paid: 6000,
      payment_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      payment_method: 'UPI',
      notes: 'Paid fully via Google Pay',
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]);

  const [ptInvoices, setPtInvoices] = useState<PTInvoice[]>([
    {
      id: 'pt-inv-1',
      client_id: 'pt-client-1',
      invoice_number: 'PT-INV-1001',
      invoice_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      trainer_id: 'rohan-trainer',
      package_id: 'pkg-1',
      package_name: '12 Sessions Package',
      sessions_included: 12,
      sessions_remaining_at_invoice: 12,
      price: 6000,
      discount: 0,
      gst_amount: 0,
      tax_amount: 0,
      final_amount: 6000,
      payment_method: 'UPI',
      paid_amount: 6000,
      balance_due: 0,
      due_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Paid',
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'pt-inv-2',
      client_id: 'pt-client-2',
      invoice_number: 'PT-INV-1002',
      invoice_date: new Date().toISOString().split('T')[0],
      trainer_id: 'karan-trainer',
      package_id: 'pkg-3',
      package_name: 'Weight Loss Program',
      sessions_included: 24,
      sessions_remaining_at_invoice: 24,
      price: 18000,
      discount: 2000,
      gst_amount: 0,
      tax_amount: 0,
      final_amount: 16000,
      payment_method: null,
      paid_amount: 0,
      balance_due: 16000,
      due_date: new Date().toISOString().split('T')[0],
      status: 'Pending',
      created_at: new Date().toISOString(),
    }
  ]);

  const [ptCommissions, setPtCommissions] = useState<PTCommission[]>([
    {
      id: 'comm-1',
      trainer_id: 'rohan-trainer',
      client_id: 'pt-client-1',
      invoice_id: 'pt-inv-1',
      amount: 1200, // 20% of 6000
      commission_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Paid',
      paid_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
    }
  ]);

  const [ptNotifications, setPtNotifications] = useState<PTNotification[]>([
    {
      id: 'notif-1',
      client_id: 'pt-client-1',
      trainer_id: 'rohan-trainer',
      type: 'Low Remaining Sessions',
      message: 'Client Arjun Sharma has only 8 sessions remaining in their 12 Sessions Package.',
      is_read: false,
      created_at: new Date().toISOString(),
    }
  ]);

  const [ptProgress, setPtProgress] = useState<PTProgress[]>([
    {
      id: 'prog-1',
      client_id: 'pt-client-1',
      date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      weight: 85.0,
      height: 178,
      bmi: 26.8,
      body_fat: 24,
      chest: 102,
      waist: 94,
      arms: 35,
      legs: 56,
      photo_before: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400',
      notes: 'Starting physical benchmarks.',
    },
    {
      id: 'prog-2',
      client_id: 'pt-client-1',
      date: new Date().toISOString().split('T')[0],
      weight: 83.2,
      height: 178,
      bmi: 26.3,
      body_fat: 22.5,
      chest: 101,
      waist: 91,
      arms: 35.5,
      legs: 55.5,
      photo_after: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400',
      notes: 'Noticeable reduction in waist size. Strength has increased.',
    }
  ]);

  // Mutators implementation
  const getMembers = () => members;
  
  const getMemberById = (id: string) => {
    return members.find(m => m.id === id) || null;
  };

  const createMember = (values: any) => {
    const newMember: Member = {
      ...values,
      id: `demo-member-uuid-${(members.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setMembers(prev => [newMember, ...prev]);

    let invoiceId: string | null = null;
    if (settings.invoice_auto_generation !== false) {
      const membershipFee = Number(newMember.membership_fee || 0);
      const parqFee = Number(newMember.parq_fee || 0);
      const trainerFee = Number(newMember.trainer_fee || 0);
      const admissionFee = Number(newMember.admission_fee || 0);
      const lockerFee = Number(newMember.locker_fee || 0);
      const dietPlanFee = Number(newMember.diet_plan_fee || 0);

      const subtotal = membershipFee + parqFee + trainerFee + admissionFee + lockerFee + dietPlanFee;
      
      const taxRate = 0;
      const taxAmount = 0;
      
      const discountAmount = Number(values.discount || 0);
      const grandTotal = Math.max(0, subtotal + taxAmount - discountAmount);

      const paidVal = Number(values.paid_amount || 0);
      const balanceDue = Math.max(0, grandTotal - paidVal);

      let invoiceStatus: Invoice['status'] = 'Pending';
      if (paidVal >= grandTotal && grandTotal > 0) {
        invoiceStatus = 'Paid';
      } else if (paidVal > 0) {
        invoiceStatus = 'Partially Paid';
      }

      const prefix = settings.invoice_prefix || 'INV';
      const year = new Date().getFullYear();
      const seq = invoices.length + 1;
      const invNum = `${prefix}-${year}-${seq.toString().padStart(6, '0')}`;

      const newInvoice: Invoice = {
        id: `demo-invoice-uuid-${(invoices.length + 1).toString().padStart(4, '0')}`,
        member_id: newMember.id,
        invoice_number: invNum,
        amount: grandTotal,
        due_date: newMember.package_end_date, // Next Due Date = Expiry Date
        status: invoiceStatus,
        created_at: new Date().toISOString(),
        membership_fee: membershipFee,
        parq_fee: parqFee,
        admission_fee: admissionFee,
        trainer_fee: trainerFee,
        locker_fee: lockerFee,
        diet_plan_fee: dietPlanFee,
        subtotal,
        discount: discountAmount,
        tax: taxAmount,
        paid_amount: paidVal,
        balance_due: balanceDue,
        payment_method: values.payment_method || null,
        transaction_id: null,
        payment_date: paidVal > 0 ? new Date().toISOString() : null,
        membership_start_date: newMember.package_start_date,
        membership_expiry_date: newMember.package_end_date,
        member: {
          full_name: newMember.full_name,
          phone: newMember.phone,
          email: newMember.email,
          address: newMember.address,
          package_name: newMember.package_name,
          package_duration: newMember.package_duration,
          package_price: newMember.package_price,
          package_start_date: newMember.package_start_date,
          package_end_date: newMember.package_end_date
        }
      };

      setInvoices(prev => [newInvoice, ...prev]);
      invoiceId = newInvoice.id;
    }

    return { data: newMember, invoiceId };
  };

  const updateMember = (id: string, values: any) => {
    let updated: Member | undefined;
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        // Biometric status transitions based on new status
        let nextBiometricStatus = m.biometric_status || 'ENABLED';
        if (values.status) {
          nextBiometricStatus = values.status === 'Active' ? 'ENABLED' : 'DISABLED';
        }
        updated = { 
          ...m, 
          ...values, 
          biometric_status: nextBiometricStatus,
          updated_at: new Date().toISOString() 
        };

        // If the package validity shifted or status is reactivated to Active, auto-generate renewal invoice
        const isPlanRenewed = (values.package_start_date && values.package_start_date !== m.package_start_date) || (values.package_end_date && values.package_end_date !== m.package_end_date);
        const isStatusActivated = (m.status === 'Expired' || m.status === 'Inactive') && values.status === 'Active';

        if ((isPlanRenewed || isStatusActivated) && updated) {
          // Auto generate invoice in demo
          if (settings.invoice_auto_generation !== false) {
            const membershipFee = Number(updated.membership_fee || 0);
            const parqFee = Number(updated.parq_fee || 0);
            const trainerFee = Number(updated.trainer_fee || 0);
            const admissionFee = Number(updated.admission_fee || 0);
            const lockerFee = Number(updated.locker_fee || 0);
            const dietPlanFee = Number(updated.diet_plan_fee || 0);

            const subtotal = membershipFee + parqFee + trainerFee + admissionFee + lockerFee + dietPlanFee;
            const grandTotal = subtotal;

            const prefix = settings.invoice_prefix || 'INV';
            const year = new Date().getFullYear();
            const seq = invoices.length + 1;
            const invNum = `${prefix}-${year}-${seq.toString().padStart(6, '0')}`;

            const newInvoice: Invoice = {
              id: `demo-invoice-uuid-${(invoices.length + 1).toString().padStart(4, '0')}`,
              member_id: updated.id,
              invoice_number: invNum,
              amount: grandTotal,
              due_date: updated.package_end_date, // Next Due Date = Expiry Date
              status: 'Pending',
              created_at: new Date().toISOString(),
              membership_fee: membershipFee,
              parq_fee: parqFee,
              admission_fee: admissionFee,
              trainer_fee: trainerFee,
              locker_fee: lockerFee,
              diet_plan_fee: dietPlanFee,
              subtotal,
              discount: 0,
              tax: 0,
              paid_amount: 0,
              balance_due: grandTotal,
              payment_method: null,
              transaction_id: null,
              payment_date: null,
              membership_start_date: updated.package_start_date,
              membership_expiry_date: updated.package_end_date,
              member: {
                full_name: updated.full_name,
                phone: updated.phone,
                email: updated.email,
                address: updated.address,
                package_name: updated.package_name,
                package_duration: updated.package_duration,
                package_price: updated.package_price,
                package_start_date: updated.package_start_date,
                package_end_date: updated.package_end_date
              }
            };
            setInvoices(prevInv => [newInvoice, ...prevInv]);
          }
        }

        return updated;
      }
      return m;
    }) as Member[]);
    return updated ? { data: updated } : { error: 'Member not found' };
  };

  const renewMember = (params: any) => {
    const member = members.find(m => m.id === params.memberId);
    if (!member) return { success: false, error: 'Member not found' };

    const previousPackage = member.package_name || member.duration || 'Standard';
    const previousStartDate = member.package_start_date;
    const previousEndDate = member.package_end_date;

    const invNum = `INV-${new Date().getFullYear()}-${(invoices.length + 1).toString().padStart(6, '0')}`;
    const invoiceId = `demo-invoice-uuid-${(invoices.length + 1).toString().padStart(4, '0')}`;

    const discountVal = Number(params.discount || 0);
    const taxVal = Number(params.tax || 0);
    const finalAmountVal = Number(params.finalAmount || (params.packagePrice - discountVal + taxVal));

    const newInvoice: Invoice = {
      id: invoiceId,
      member_id: member.id,
      invoice_number: invNum,
      amount: finalAmountVal,
      due_date: params.endDate,
      status: 'Paid',
      notes: params.notes ? `Membership Renewal: ${params.notes}` : `Membership Renewal (${params.packageName})`,
      membership_fee: Number(params.packagePrice),
      subtotal: Number(params.packagePrice),
      discount: discountVal,
      tax: taxVal,
      paid_amount: finalAmountVal,
      balance_due: 0,
      payment_method: params.paymentMethod,
      payment_date: new Date().toISOString(),
      membership_start_date: params.startDate,
      membership_expiry_date: params.endDate,
      created_at: new Date().toISOString(),
      member: {
        full_name: member.full_name,
        phone: member.phone,
        email: member.email,
        address: member.address,
        package_name: params.packageName,
        package_duration: params.duration,
        package_price: Number(params.packagePrice),
        package_start_date: params.startDate,
        package_end_date: params.endDate
      }
    };

    setInvoices(prev => [newInvoice, ...prev]);

    let updated: Member | undefined;
    setMembers(prev => prev.map(m => {
      if (m.id === params.memberId) {
        updated = {
          ...m,
          package_name: params.packageName,
          package_duration: params.duration,
          duration: params.duration,
          training_type: params.trainingType,
          package_price: Number(params.packagePrice),
          membership_fee: Number(params.packagePrice),
          package_start_date: params.startDate,
          package_end_date: params.endDate,
          status: 'Active',
          biometric_status: 'ENABLED',
          updated_at: new Date().toISOString()
        };
        return updated;
      }
      return m;
    }));

    const newRenewal: MembershipRenewal = {
      id: `demo-renewal-${Date.now()}`,
      member_id: member.id,
      invoice_id: invoiceId,
      renewal_date: new Date().toISOString(),
      previous_package: previousPackage,
      new_package: params.packageName,
      previous_start_date: previousStartDate,
      previous_end_date: previousEndDate,
      new_start_date: params.startDate,
      new_end_date: params.endDate,
      invoice_number: invNum,
      amount: finalAmountVal,
      discount: discountVal,
      payment_method: params.paymentMethod,
      renewed_by: 'Staff',
      notes: params.notes || null,
      created_at: new Date().toISOString()
    };

    setRenewals(prev => [newRenewal, ...prev]);

    return {
      success: true,
      member: updated || member,
      invoiceId,
      invoiceNumber: invNum
    };
  };

  const getMemberRenewals = (memberId: string) => {
    return renewals.filter(r => r.member_id === memberId);
  };


  const deleteMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const deleteAttendanceLog = (id: string) => {
    setAttendance(prev => prev.filter(a => a.id !== id));
  };

  const getMembersPaginated = (args: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    plan?: string;
    machine?: string;
  }) => {
    const page = args.page || 1;
    const limit = args.limit || 10;
    const search = args.search || '';
    const status = args.status || 'All';
    const plan = args.plan || 'All';
    const machine = args.machine || 'All';

    let filtered = [...members];
    
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(m => 
        m.full_name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q))
      );
    }
    
    if (status && status !== 'All') {
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayTime = today.getTime();

      if (status === 'Expiring in 7 Days') {
        filtered = filtered.filter(m => {
          if (m.status !== 'Active' || m.duration === 'Daily Pass' || !m.package_end_date) return false;
          const exp = new Date(m.package_end_date);
          exp.setHours(0,0,0,0);
          const diffDays = Math.ceil((exp.getTime() - todayTime) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 7;
        });
      } else if (status === 'Expiring in 30 Days') {
        filtered = filtered.filter(m => {
          if (m.status !== 'Active' || m.duration === 'Daily Pass' || !m.package_end_date) return false;
          const exp = new Date(m.package_end_date);
          exp.setHours(0,0,0,0);
          const diffDays = Math.ceil((exp.getTime() - todayTime) / (1000 * 60 * 60 * 24));
          return diffDays >= 0 && diffDays <= 30;
        });
      } else if (status === 'Renewed This Month') {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
        const renewedMemberIds = new Set(
          renewals
            .filter(r => new Date(r.renewal_date).getTime() >= startOfMonth)
            .map(r => r.member_id)
        );
        filtered = filtered.filter(m => renewedMemberIds.has(m.id));
      } else {
        filtered = filtered.filter(m => m.status === status);
      }
    }
    
    if (plan && plan !== 'All') {
      filtered = filtered.filter(m => m.package_name.toLowerCase().includes(plan.toLowerCase()));
    }
    
    if (machine && machine !== 'All') {
      filtered = filtered.filter(m => m.machine_type === machine);
    }

    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      members: paginated,
      totalCount: filtered.length
    };
  };

  const getInvoicesByMember = (memberId: string) => {
    return invoices.filter(i => i.member_id === memberId);
  };

  const getInvoiceById = (id: string) => {
    return invoices.find(i => i.id === id) || null;
  };

  const createInvoice = (values: any) => {
    const member = getMemberById(values.member_id);
    const newInvoice: Invoice = {
      ...values,
      id: `demo-invoice-uuid-${(invoices.length + 1).toString().padStart(4, '0')}`,
      invoice_number: `INV-${(1000 + invoices.length + 1)}`,
      created_at: new Date().toISOString(),
      member: member ? {
        full_name: member.full_name,
        phone: member.phone,
        email: member.email,
        address: member.address,
        package_name: member.package_name,
        package_duration: member.package_duration,
        package_price: member.package_price,
        package_start_date: member.package_start_date,
        package_end_date: member.package_end_date
      } : undefined
    };
    setInvoices(prev => [newInvoice, ...prev]);
    return newInvoice;
  };

  const updateInvoiceStatus = (id: string, status: Invoice['status']) => {
    let updated: Invoice | null = null;
    setInvoices(prev => prev.map(i => {
      if (i.id === id) {
        let balance_due = i.balance_due;
        let paid_amount = i.paid_amount;
        if (status === 'Paid') {
          paid_amount = i.amount;
          balance_due = 0;
        } else if (status === 'Pending' || status === 'Unpaid') {
          paid_amount = 0;
          balance_due = i.amount;
        } else if (status === 'Cancelled') {
          balance_due = 0;
        }
        updated = { ...i, status, paid_amount, balance_due };
        return updated;
      }
      return i;
    }));
    return updated;
  };

  const duplicateInvoice = (id: string) => {
    const original = invoices.find(i => i.id === id);
    if (!original) return { error: 'Invoice not found' };
    const prefix = settings.invoice_prefix || 'INV';
    const year = new Date().getFullYear();
    const seq = invoices.length + 1;
    const invNum = `${prefix}-${year}-${seq.toString().padStart(6, '0')}`;
    const newInvoice: Invoice = {
      ...original,
      id: `demo-invoice-uuid-${(invoices.length + 1).toString().padStart(4, '0')}`,
      invoice_number: invNum,
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: 'Pending',
      notes: original.notes ? `Cloned from ${original.invoice_number}. ${original.notes}` : `Cloned from ${original.invoice_number}`,
      paid_amount: 0,
      balance_due: original.amount,
      payment_method: null,
      transaction_id: null,
      payment_date: null,
      created_at: new Date().toISOString()
    };
    setInvoices(prev => [newInvoice, ...prev]);
    return { data: newInvoice };
  };

  const cancelInvoice = (id: string) => {
    setInvoices(prev => prev.map(i => i.id === id ? { ...i, status: 'Cancelled', balance_due: 0 } : i));
    return { success: true };
  };

  const recordAdditionalPayment = (id: string, amount: number, paymentMethod: string, transactionId?: string) => {
    setInvoices(prev => prev.map(i => {
      if (i.id === id) {
        const currentPaid = Number(i.paid_amount || 0);
        const newPaid = currentPaid + amount;
        const totalAmount = Number(i.amount);
        const newBalance = Math.max(0, totalAmount - newPaid);
        let status: Invoice['status'] = 'Partially Paid';
        if (newPaid >= totalAmount) {
          status = 'Paid';
        }
        return {
          ...i,
          paid_amount: newPaid,
          balance_due: newBalance,
          status,
          payment_method: paymentMethod,
          transaction_id: transactionId || i.transaction_id || null,
          payment_date: new Date().toISOString()
        };
      }
      return i;
    }));
    return { success: true };
  };

  const getAttendanceHistory = (args: { member_id?: string; device_id?: string }) => {
    let filtered = [...attendance];
    if (args.member_id) {
      filtered = filtered.filter(log => log.member_id === args.member_id);
    }
    if (args.device_id) {
      filtered = filtered.filter(log => log.biometric_user_id === args.device_id || log.device_id === args.device_id);
    }
    // Sort descending by punch time
    return filtered.sort((a, b) => new Date(b.punch_time).getTime() - new Date(a.punch_time).getTime());
  };

  const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

  const getAttendanceAnalytics = () => {
    // Generate simple occupancy and checkin stats for today
    const checkinLogs = attendance.filter(log => {
      if (log.punch_type !== 'checkin' || !log.punch_time) return false;
      const date = new Date(log.punch_time);
      const todayDate = new Date(2026, 5, 30); // Demo default today
      return date.toDateString() === todayDate.toDateString();
    });

    const checkouts = attendance.filter(log => {
      if (log.punch_type !== 'checkout' || !log.punch_time) return false;
      const date = new Date(log.punch_time);
      const todayDate = new Date(2026, 5, 30);
      return date.toDateString() === todayDate.toDateString();
    });

    // Compute occupancy (checkins - checkouts)
    const occupancy = Math.max(0, checkinLogs.length - checkouts.length) || 8;

    // Hourly distribution for trend (dummy logs)
    const hourlyDistribution = Array.from({ length: 24 }).map((_, hour) => {
      let count = 0;
      if (hour >= 6 && hour <= 9) count = rand(5, 15);
      else if (hour >= 17 && hour <= 20) count = rand(8, 22);
      else if (hour >= 10 && hour <= 16) count = rand(2, 6);
      return { hour: `${hour}:00`, count };
    });

    return {
      occupancy: occupancy,
      checkins: checkinLogs.length || 18,
      hourlyDistribution
    };
  };

  const getSMSLogsByMember = (memberId: string) => {
    return smsLogs.filter(log => log.member_id === memberId);
  };

  const sendSMSAction = async (memberId: string, message: string, type?: string) => {
    const member = getMemberById(memberId);
    const newLog: SMSLog = {
      id: `demo-sms-uuid-${(smsLogs.length + 1).toString().padStart(4, '0')}`,
      member_id: memberId,
      phone: member?.phone || '',
      message: message,
      status: 'Sent',
      sent_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      member: member ? { full_name: member.full_name } : null
    };
    setSmsLogs(prev => [newLog, ...prev]);
    return { success: true };
  };

  const getSettings = () => settings;
  const saveSettings = (values: GymSettings) => {
    setSettings(values);
  };

  const getHealthByMember = (memberId: string) => {
    return healthAssessments.filter(h => h.member_id === memberId);
  };

  const getHealthById = (id: string) => {
    return healthAssessments.find(h => h.id === id) || null;
  };

  const createHealthAssessment = (values: any) => {
    const newAss: HealthAssessment = {
      ...values,
      id: `demo-health-uuid-${(healthAssessments.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString()
    };
    setHealthAssessments(prev => [newAss, ...prev]);
    return newAss;
  };

  const getParqByMember = (memberId: string) => {
    return parqResponses.filter(p => p.member_id === memberId);
  };

  const getParqById = (id: string) => {
    return parqResponses.find(p => p.id === id) || null;
  };

  const createParqResponse = (values: any) => {
    const newParq: ParqResponse = {
      id: `demo-parq-uuid-${(parqResponses.length + 1).toString().padStart(4, '0')}`,
      member_id: values.member_id,
      answers: values,
      notes: values.notes,
      created_at: new Date().toISOString()
    };
    setParqResponses(prev => [newParq, ...prev]);
    return newParq;
  };

  // Staff mutators
  const getStaff = (args: { search?: string; role?: string; status?: string; page?: number; limit?: number } = {}) => {
    const { search = '', role = 'All', status = 'All', page = 1, limit = 10 } = args;
    let filtered = [...staff];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.employee_id.toLowerCase().includes(q) ||
        (s.email && s.email.toLowerCase().includes(q))
      );
    }
    if (role && role !== 'All') filtered = filtered.filter(s => s.role === role);
    if (status && status !== 'All') filtered = filtered.filter(s => s.status === status);
    const offset = (page - 1) * limit;
    return { staff: filtered.slice(offset, offset + limit), totalCount: filtered.length };
  };

  const getStaffById = (id: string) => staff.find(s => s.id === id) || null;

  const createStaff = (values: any) => {
    if (values.biometric_gents_id) {
      if (!/^\d+$/.test(values.biometric_gents_id)) {
        return { error: 'Biometric Gents ID must contain numeric digits only' };
      }
      const duplicate = staff.some(s => s.biometric_gents_id === values.biometric_gents_id);
      if (duplicate) {
        return { error: `Biometric Gents ID ${values.biometric_gents_id} is already assigned.` };
      }
    }
    if (values.biometric_ladies_id) {
      if (!/^\d+$/.test(values.biometric_ladies_id)) {
        return { error: 'Biometric Ladies ID must contain numeric digits only' };
      }
      const duplicate = staff.some(s => s.biometric_ladies_id === values.biometric_ladies_id);
      if (duplicate) {
        return { error: `Biometric Ladies ID ${values.biometric_ladies_id} is already assigned.` };
      }
    }
    const newStaff: Staff = {
      ...values,
      id: `demo-staff-uuid-${(staff.length + 1).toString().padStart(4, '0')}`,
      employee_id: values.employee_id || `EMP-${(1000 + staff.length + 1)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setStaff(prev => [newStaff, ...prev]);
    return { data: newStaff };
  };

  const updateStaff = (id: string, values: any) => {
    if (values.biometric_gents_id) {
      if (!/^\d+$/.test(values.biometric_gents_id)) {
        return { error: 'Biometric Gents ID must contain numeric digits only' };
      }
      const duplicate = staff.some(s => s.biometric_gents_id === values.biometric_gents_id && s.id !== id);
      if (duplicate) {
        return { error: `Biometric Gents ID ${values.biometric_gents_id} is already assigned.` };
      }
    }
    if (values.biometric_ladies_id) {
      if (!/^\d+$/.test(values.biometric_ladies_id)) {
        return { error: 'Biometric Ladies ID must contain numeric digits only' };
      }
      const duplicate = staff.some(s => s.biometric_ladies_id === values.biometric_ladies_id && s.id !== id);
      if (duplicate) {
        return { error: `Biometric Ladies ID ${values.biometric_ladies_id} is already assigned.` };
      }
    }
    let updated: Staff | undefined;
    setStaff(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...values, updated_at: new Date().toISOString() };
        return updated;
      }
      return s;
    }) as Staff[]);
    return updated ? { data: updated } : { error: 'Staff not found' };
  };

  const deleteStaff = (id: string) => setStaff(prev => prev.filter(s => s.id !== id));

  const getStaffStats = () => ({
    total: staff.length,
    trainers: staff.filter(s => s.role === 'Trainer').length,
    janitors: staff.filter(s => s.role === 'Janitor').length,
    active: staff.filter(s => s.status === 'Active').length,
  });

  // ── PT Mutators Implementation ──────────────────────────────
  const getPTTrainers = () => ptTrainers;
  const getPTTrainerById = (id: string) => ptTrainers.find(t => t.id === id) || null;
  const createPTTrainer = (values: any) => {
    const newTrainer: PTTrainer = {
      ...values,
      id: `pt-trainer-uuid-${(ptTrainers.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtTrainers(prev => [newTrainer, ...prev]);
    return { data: newTrainer };
  };
  const updatePTTrainer = (id: string, values: any) => {
    let updated: PTTrainer | undefined;
    setPtTrainers(prev => prev.map(t => {
      if (t.id === id) {
        updated = { ...t, ...values, updated_at: new Date().toISOString() };
        return updated;
      }
      return t;
    }) as PTTrainer[]);
    return updated ? { data: updated } : { error: 'Trainer not found' };
  };
  const deletePTTrainer = (id: string) => {
    setPtTrainers(prev => prev.filter(t => t.id !== id));
  };

  const getPTPackages = () => {
    return ptPackages.map(pkg => ({
      ...pkg,
      trainer: pkg.trainer_id ? ptTrainers.find(t => t.id === pkg.trainer_id) : null
    }));
  };
  const getPTPackageById = (id: string) => {
    const pkg = ptPackages.find(p => p.id === id);
    if (!pkg) return null;
    return {
      ...pkg,
      trainer: pkg.trainer_id ? ptTrainers.find(t => t.id === pkg.trainer_id) : null
    };
  };
  const createPTPackage = (values: any) => {
    const newPkg: PTPackage = {
      ...values,
      id: `pt-pkg-uuid-${(ptPackages.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtPackages(prev => [newPkg, ...prev]);
    return { data: newPkg };
  };
  const updatePTPackage = (id: string, values: any) => {
    let updated: PTPackage | undefined;
    setPtPackages(prev => prev.map(p => {
      if (p.id === id) {
        updated = { ...p, ...values, updated_at: new Date().toISOString() };
        return updated;
      }
      return p;
    }) as PTPackage[]);
    return updated ? { data: updated } : { error: 'Package not found' };
  };
  const deletePTPackage = (id: string) => {
    setPtPackages(prev => prev.filter(p => p.id !== id));
  };

  const getPTClients = () => {
    return ptClients.map(c => ({
      ...c,
      trainer: c.trainer_id ? ptTrainers.find(t => t.id === c.trainer_id) : null,
      package: c.package_id ? ptPackages.find(p => p.id === c.package_id) : null
    }));
  };
  const getPTClientById = (id: string) => {
    const client = ptClients.find(c => c.id === id);
    if (!client) return null;
    return {
      ...client,
      trainer: client.trainer_id ? ptTrainers.find(t => t.id === client.trainer_id) : null,
      package: client.package_id ? ptPackages.find(p => p.id === client.package_id) : null
    };
  };
  const createPTClient = (values: any) => {
    const newClient: PTClient = {
      ...values,
      id: `pt-client-uuid-${(ptClients.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtClients(prev => [newClient, ...prev]);
    return { data: newClient };
  };
  const updatePTClient = (id: string, values: any) => {
    let updated: PTClient | undefined;
    setPtClients(prev => prev.map(c => {
      if (c.id === id) {
        updated = { ...c, ...values, updated_at: new Date().toISOString() };
        return updated;
      }
      return c;
    }) as PTClient[]);
    return updated ? { data: updated } : { error: 'Client not found' };
  };
  const deletePTClient = (id: string) => {
    setPtClients(prev => prev.filter(c => c.id !== id));
  };

  const getPTSessions = () => {
    return ptSessions.map(s => ({
      ...s,
      client: ptClients.find(c => c.id === s.client_id)!,
      trainer: ptTrainers.find(t => t.id === s.trainer_id)!
    }));
  };
  const getPTSessionById = (id: string) => {
    const sess = ptSessions.find(s => s.id === id);
    if (!sess) return null;
    return {
      ...sess,
      client: ptClients.find(c => c.id === sess.client_id)!,
      trainer: ptTrainers.find(t => t.id === sess.trainer_id)!
    };
  };
  const createPTSession = (values: any) => {
    const newSess: PTSession = {
      ...values,
      id: `pt-sess-uuid-${(ptSessions.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtSessions(prev => [newSess, ...prev]);
    return { data: newSess };
  };
  const updatePTSession = (id: string, values: any) => {
    let updated: PTSession | undefined;
    setPtSessions(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...values, updated_at: new Date().toISOString() };
        if (values.status === 'Completed' && s.status !== 'Completed') {
          setPtClients(prevC => prevC.map(c => {
            if (c.id === s.client_id) {
              return { ...c, sessions_remaining: Math.max(0, c.sessions_remaining - 1) };
            }
            return c;
          }));
        }
        return updated;
      }
      return s;
    }) as PTSession[]);
    return updated ? { data: updated } : { error: 'Session not found' };
  };
  const deletePTSession = (id: string) => {
    setPtSessions(prev => prev.filter(s => s.id !== id));
  };

  const getPTSessionAttendance = (sessionId: string) => {
    return [{
      id: 'demo-att-1',
      session_id: sessionId,
      status: 'Present'
    }];
  };

  const markPTSessionAttendance = (
    sessionId: string,
    clientId: string,
    trainerId: string,
    date: string,
    status: 'Present' | 'Absent' | 'Cancelled' | 'Late'
  ) => {
    let sessionStatus: any = 'Scheduled';
    if (status === 'Present' || status === 'Late') {
      sessionStatus = 'Completed';
      setPtClients(prev => prev.map(c => {
        if (c.id === clientId) {
          return { ...c, sessions_remaining: Math.max(0, c.sessions_remaining - 1) };
        }
        return c;
      }));

      const trainer = ptTrainers.find(t => t.id === trainerId);
      if (trainer && trainer.commission_type === 'Per Session') {
        const newComm: PTCommission = {
          id: `demo-comm-uuid-${Date.now()}`,
          trainer_id: trainerId,
          client_id: clientId,
          session_id: sessionId,
          amount: trainer.commission_value,
          commission_date: date,
          status: 'Pending',
          created_at: new Date().toISOString(),
        };
        setPtCommissions(prev => [newComm, ...prev]);
      }
    } else if (status === 'Absent') {
      sessionStatus = 'Missed';
    } else if (status === 'Cancelled') {
      sessionStatus = 'Cancelled';
    }

    setPtSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, status: sessionStatus };
      }
      return s;
    }));

    return { success: true };
  };

  const getPTProgress = (clientId: string) => {
    return ptProgress.filter(p => p.client_id === clientId).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };
  const createPTProgress = (values: any) => {
    const newProg: PTProgress = {
      ...values,
      id: `pt-prog-uuid-${(ptProgress.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtProgress(prev => [newProg, ...prev]);
    return { data: newProg };
  };
  const deletePTProgress = (id: string) => {
    setPtProgress(prev => prev.filter(p => p.id !== id));
  };

  const getPTInvoices = () => {
    return ptInvoices.map(i => ({
      ...i,
      client: ptClients.find(c => c.id === i.client_id)!
    }));
  };
  const getPTInvoiceById = (id: string) => {
    const inv = ptInvoices.find(i => i.id === id);
    if (!inv) return null;
    return {
      ...inv,
      client: ptClients.find(c => c.id === inv.client_id)!,
      trainer: inv.trainer_id ? ptTrainers.find(t => t.id === inv.trainer_id) : undefined
    };
  };
  const createPTInvoice = (values: any) => {
    const nextNum = 1000 + ptInvoices.length + 1;
    const newInv: PTInvoice = {
      ...values,
      id: `pt-inv-uuid-${(ptInvoices.length + 1).toString().padStart(4, '0')}`,
      invoice_number: `PT-INV-${nextNum}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtInvoices(prev => [newInv, ...prev]);
    return { data: newInv };
  };
  const updatePTInvoice = (id: string, values: any) => {
    let updated: PTInvoice | undefined;
    setPtInvoices(prev => prev.map(i => {
      if (i.id === id) {
        updated = { ...i, ...values, updated_at: new Date().toISOString() };
        if (values.status === 'Paid' && i.status !== 'Paid') {
          const trainer = i.trainer_id ? ptTrainers.find(t => t.id === i.trainer_id) : null;
          if (trainer && (trainer.commission_type === 'Percentage' || trainer.commission_type === 'Fixed' || trainer.commission_type === 'Per Package')) {
            let commAmount = trainer.commission_value;
            if (trainer.commission_type === 'Percentage') {
              commAmount = (updated!.final_amount * trainer.commission_value) / 100.0;
            }
            const newComm: PTCommission = {
              id: `demo-comm-uuid-${Date.now()}`,
              trainer_id: trainer.id,
              client_id: i.client_id,
              invoice_id: i.id,
              amount: commAmount,
              commission_date: new Date().toISOString().split('T')[0],
              status: 'Pending',
              created_at: new Date().toISOString()
            };
            setPtCommissions(prev => [newComm, ...prev]);
          }
        }
        return updated;
      }
      return i;
    }) as PTInvoice[]);
    return updated ? { data: updated } : { error: 'Invoice not found' };
  };

  const getPTPayments = () => {
    return ptPayments.map(p => ({
      ...p,
      client: ptClients.find(c => c.id === p.client_id)!,
      invoice: p.invoice_id ? ptInvoices.find(i => i.id === p.invoice_id) : undefined
    }));
  };
  const createPTPayment = (values: any) => {
    const newPay: PTPayment = {
      ...values,
      id: `pt-pay-uuid-${(ptPayments.length + 1).toString().padStart(4, '0')}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setPtPayments(prev => [newPay, ...prev]);

    if (values.invoice_id) {
      updatePTInvoice(values.invoice_id, {
        status: 'Paid',
        paid_amount: values.amount_paid,
        balance_due: 0
      });
    }

    return { data: newPay };
  };

  const getPTCommissions = () => {
    return ptCommissions.map(c => ({
      ...c,
      trainer: ptTrainers.find(t => t.id === c.trainer_id)!,
      client: c.client_id ? ptClients.find(cl => cl.id === c.client_id) : undefined,
      session: c.session_id ? ptSessions.find(s => s.id === c.session_id) : undefined,
      invoice: c.invoice_id ? ptInvoices.find(i => i.id === c.invoice_id) : undefined
    }));
  };
  const payPTCommission = (id: string) => {
    setPtCommissions(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: 'Paid', paid_date: new Date().toISOString().split('T')[0] };
      }
      return c;
    }));
    return { success: true };
  };

  const getPTNotifications = () => ptNotifications;
  const markPTNotificationAsRead = (id: string) => {
    setPtNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const getPTDashboardStats = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const activeClientsCount = ptClients.filter(c => c.status === 'Active').length;
    const todaySessionsCount = ptSessions.filter(s => s.session_date === todayStr).length;
    const completedSessionsCount = ptSessions.filter(s => s.status === 'Completed').length;
    const remainingSessionsCount = ptClients.filter(c => c.status === 'Active').reduce((acc, c) => acc + c.sessions_remaining, 0);

    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const monthlyRevenue = ptPayments
      .filter(p => {
        const pDate = new Date(p.payment_date);
        return pDate.getFullYear() === curYear && pDate.getMonth() === curMonth;
      })
      .reduce((acc, curr) => acc + Number(curr.amount_paid), 0);

    const pendingPaymentsAmount = ptInvoices.filter(i => i.status === 'Pending').reduce((acc, curr) => acc + Number(curr.balance_due), 0);
    const trainerCommissionPending = ptCommissions.filter(c => c.status === 'Pending').reduce((acc, curr) => acc + Number(curr.amount), 0);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    const expiringPackagesCount = ptClients.filter(c => c.status === 'Active' && c.expiry_date >= todayStr && c.expiry_date <= nextWeekStr).length;

    return {
      activeClients: activeClientsCount,
      todaySessions: todaySessionsCount,
      completedSessions: completedSessionsCount,
      remainingSessions: remainingSessionsCount,
      monthlyRevenue,
      pendingPayments: pendingPaymentsAmount,
      trainerCommission: trainerCommissionPending,
      expiringPackages: expiringPackagesCount
    };
  };

  return (
    <DemoStateContext.Provider
      value={{
        members,
        invoices,
        attendance,
        trainers,
        expenses,
        callLogs,
        notifications,
        settings,
        devices,
        smsLogs,
        healthAssessments,
        parqResponses,
        staff,
        renewals,
        
        getMembers,
        getMemberById,
        createMember,
        updateMember,
        renewMember,
        getMemberRenewals,
        deleteMember,
        getMembersPaginated,
        
        getInvoicesByMember,
        getInvoiceById,
        createInvoice,
        updateInvoiceStatus,
        duplicateInvoice,
        cancelInvoice,
        recordAdditionalPayment,
        
        getAttendanceHistory,
        getAttendanceAnalytics,
        deleteAttendanceLog,
        
        getSMSLogsByMember,
        sendSMSAction,
        
        getSettings,
        saveSettings,

        getHealthByMember,
        getHealthById,
        createHealthAssessment,
        
        getParqByMember,
        getParqById,
        createParqResponse,

        getStaff,
        getStaffById,
        createStaff,
        updateStaff,
        deleteStaff,
        getStaffStats,
        staffAttendance,
        getStaffAttendanceHistory: (args: { search?: string; role?: string; status?: string; timeframe?: string } = {}) => {
          const { search = '', role = 'All', status = 'All', timeframe = 'All' } = args;
          let filtered = [...staffAttendance];
          
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            filtered = filtered.filter(row => 
              row.full_name.toLowerCase().includes(q) || 
              (row.biometric_gents_id && row.biometric_gents_id.includes(q)) ||
              (row.biometric_ladies_id && row.biometric_ladies_id.includes(q))
            );
          }
          
          if (role && role !== 'All') {
            filtered = filtered.filter(row => row.role === role);
          }
          
          if (status && status !== 'All') {
            filtered = filtered.filter(row => row.status === status);
          }
          
          if (timeframe && timeframe !== 'All') {
            const now = new Date();
            now.setHours(0,0,0,0);
            filtered = filtered.filter(row => {
              const rowDate = new Date(row.date);
              rowDate.setHours(0,0,0,0);
              const diffDays = Math.floor(Math.abs(now.getTime() - rowDate.getTime()) / (1000 * 60 * 60 * 24));
              if (timeframe === 'daily' || timeframe === 'Today' || timeframe === 'today') return diffDays === 0;
              if (timeframe === 'weekly' || timeframe === '7days') return diffDays >= 0 && diffDays <= 7;
              if (timeframe === '15days') return diffDays >= 0 && diffDays <= 15;
              if (timeframe === 'monthly' || timeframe === '30days') return diffDays >= 0 && diffDays <= 30;
              return true;
            });
          }
          
          return filtered;
        },
        getStaffAttendanceTodayStats: () => {
          const today = new Date().toISOString().split('T')[0];
          const todayLogs = staffAttendance.filter(row => row.date === today && row.status !== 'Absent');
          const trainers = todayLogs.filter(row => row.role === 'Trainer').length;
          const janitors = todayLogs.filter(row => row.role === 'Janitor').length;
          return {
            present: todayLogs.length,
            trainers,
            janitors,
            total: staff.length
          };
        },
        ptTrainers,
        ptPackages,
        ptClients,
        ptSessions,
        ptPayments,
        ptInvoices,
        ptCommissions,
        ptNotifications,
        ptProgress,

        getPTTrainers,
        getPTTrainerById,
        createPTTrainer,
        updatePTTrainer,
        deletePTTrainer,

        getPTPackages,
        getPTPackageById,
        createPTPackage,
        updatePTPackage,
        deletePTPackage,

        getPTClients,
        getPTClientById,
        createPTClient,
        updatePTClient,
        deletePTClient,

        getPTSessions,
        getPTSessionById,
        createPTSession,
        updatePTSession,
        deletePTSession,

        getPTSessionAttendance,
        markPTSessionAttendance,

        getPTProgress,
        createPTProgress,
        deletePTProgress,

        getPTInvoices,
        getPTInvoiceById,
        createPTInvoice,
        updatePTInvoice,

        getPTPayments,
        createPTPayment,

        getPTCommissions,
        payPTCommission,

        getPTNotifications,
        markPTNotificationAsRead,

        getPTDashboardStats
      }}
    >
      {children}
    </DemoStateContext.Provider>
  );
}

export function useDemoState() {
  const context = useContext(DemoStateContext);
  if (context === undefined) {
    throw new Error('useDemoState must be used within a DemoStateProvider');
  }
  return context;
}
