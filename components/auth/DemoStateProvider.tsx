'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Member, Invoice, AttendanceLog, GymSettings, SMSLog, HealthAssessment, ParqResponse, BiometricDevice } from '@/types';

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

  // Mutators
  getMembers: () => Member[];
  getMemberById: (id: string) => Member | null;
  createMember: (values: any) => { data?: Member; error?: string };
  updateMember: (id: string, values: any) => { data?: Member; error?: string };
  deleteMember: (id: string) => void;
  getMembersPaginated: (args: any) => { members: Member[]; totalCount: number };
  
  getInvoicesByMember: (memberId: string) => Invoice[];
  getInvoiceById: (id: string) => Invoice | null;
  createInvoice: (values: any) => Invoice;
  updateInvoiceStatus: (id: string, status: 'Paid' | 'Pending' | 'Overdue') => Invoice | null;
  
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
  
  const [settings, setSettings] = useState<GymSettings>({
    gym_name: 'FusionFit Gym (Demo)',
    gym_phone: '+91 98765 43210',
    gym_email: 'demo@redix.media',
    gym_address: '123 Fitness Street, Bangalore, Karnataka 560001',
    plan_monthly: '1500',
    plan_quarterly: '4000',
    plan_biannual: '7500',
    plan_annual: '14000',
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
    return { data: newMember };
  };

  const updateMember = (id: string, values: any) => {
    let updated: Member | undefined;
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        updated = { ...m, ...values, updated_at: new Date().toISOString() };
        return updated;
      }
      return m;
    }) as Member[]);
    return updated ? { data: updated } : { error: 'Member not found' };
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
      filtered = filtered.filter(m => m.status === status);
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

  const updateInvoiceStatus = (id: string, status: 'Paid' | 'Pending' | 'Overdue') => {
    let updated: Invoice | null = null;
    setInvoices(prev => prev.map(i => {
      if (i.id === id) {
        updated = { ...i, status };
        return updated;
      }
      return i;
    }));
    return updated;
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
        
        getMembers,
        getMemberById,
        createMember,
        updateMember,
        deleteMember,
        getMembersPaginated,
        
        getInvoicesByMember,
        getInvoiceById,
        createInvoice,
        updateInvoiceStatus,
        
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
        createParqResponse
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
