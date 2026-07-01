'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Member, Invoice, AttendanceLog, GymSettings, SMSLog, HealthAssessment, ParqResponse, BiometricDevice, Staff } from '@/types';

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
