const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../src/demo-data');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

// Helper: Random item from array
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Helper: Random integer
const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Names for generating 250 members
const firstNames = [
  'Arjun', 'Priya', 'Rahul', 'Sneha', 'Vikram', 'Kavya', 'Aditya', 'Meera', 'Rohan', 'Divya',
  'Amit', 'Anjali', 'Karan', 'Neha', 'Sanjay', 'Pooja', 'Rajesh', 'Deepa', 'Suresh', 'Sunita',
  'Vijay', 'Aisha', 'Abhishek', 'Ritu', 'Manish', 'Komal', 'Sandeep', 'Swati', 'Harish', 'Preeti',
  'Ravi', 'Shalini', 'Alok', 'Tanvi', 'Vivek', 'Nisha', 'Sunil', 'Jyoti', 'Gaurav', 'Ridhi',
  'Mohit', 'Payal', 'Rohit', 'Sakshi', 'Anil', 'Nidhi', 'Deepak', 'Aarti', 'Manoj', 'Kiran'
];

const lastNames = [
  'Sharma', 'Nair', 'Verma', 'Patel', 'Singh', 'Reddy', 'Kumar', 'Joshi', 'Mehta', 'Krishnan',
  'Gupta', 'Rao', 'Sen', 'Das', 'Mishra', 'Choudhury', 'Mukherjee', 'Bose', 'Iyer', 'Pillai',
  'Bhatt', 'Pandey', 'Saxena', 'Kapoor', 'Malhotra', 'Mehra', 'Trivedi', 'Joshi', 'Desai', 'Kulkarni',
  'Patil', 'Pawar', 'Shinde', 'Jadhav', 'Gaikwad', 'Naidu', 'Shetty', 'Hegde', 'Menon', 'Nambiar'
];

// Generate 250 members
const members = [];
const startOfDemoMonth = new Date(2026, 5, 1); // June 1, 2026

// Gym Packages (as per types/index.ts)
const packages = [
  { name: 'Classic', duration: '1 Month', price: 1500 },
  { name: 'Premium', duration: '3 Months', price: 4000 },
  { name: 'Elite', duration: '6 Months', price: 7500 },
  { name: 'Daily Pass', duration: 'Daily Pass', price: 200 }
];

const statuses = ['Active', 'Expired', 'Inactive', 'Frozen'];
const trainingTypes = ['Weight Training Only', 'Weight Training + Cardio', 'Weight Training + Strength Training'];

// Generate 250 members
for (let i = 1; i <= 250; i++) {
  const gender = rand(1, 2) === 1 ? 'Gents' : 'Ladies';
  const first = pick(firstNames);
  const last = pick(lastNames);
  const fullName = `${first} ${last}`;
  const phone = `+91 9${rand(10000000, 99999999)}`;
  const email = `${first.toLowerCase()}.${last.toLowerCase()}${i}@fusionfit.com`;
  const dob = `${rand(1975, 2005)}-0${rand(1, 9)}-${rand(10, 28)}`;
  
  // Package assignment
  const pkg = pick(packages);
  
  // Status breakdown:
  // We need 45 active memberships (out of which 12 are pending renewals, meaning they expire soon, e.g. within 7 days from June 30, 2026)
  // Let's explicitly define status and dates for the first 45 members as Active, and rest as Expired/Inactive/Frozen
  let status = 'Expired';
  let startDate, endDate;
  
  if (i <= 33) {
    status = 'Active';
    // Active (expires after July 5, 2026)
    startDate = '2026-06-10';
    endDate = pkg.duration === 'Daily Pass' ? '2026-06-10' : `2026-07-${rand(10, 30)}`;
  } else if (i <= 45) {
    status = 'Active';
    // Active but expiring soon (Pending renewal: expires between July 1 and July 7, 2026)
    startDate = '2026-06-01';
    endDate = `2026-07-0${rand(1, 7)}`;
  } else if (i <= 55) {
    status = 'Frozen';
    startDate = '2026-04-15';
    endDate = '2026-10-15';
  } else if (i <= 70) {
    status = 'Inactive';
    startDate = '2025-10-01';
    endDate = '2026-04-01';
  } else {
    status = 'Expired';
    // Expired memberships
    startDate = `2025-0${rand(1, 9)}-01`;
    endDate = `2026-0${rand(1, 5)}-01`;
  }
  
  const training = pick(trainingTypes);
  const parqPurchased = rand(1, 10) > 3;
  const trainerPackage = rand(1, 10) > 6;

  members.push({
    id: `demo-member-uuid-${i.toString().padStart(4, '0')}`,
    full_name: fullName,
    phone: phone,
    email: email,
    address: `${rand(10, 99)} MG Road, Bangalore`,
    emergency_contact: `+91 9${rand(10000000, 99999999)}`,
    dob: dob,
    package_name: pkg.name,
    package_duration: pkg.duration,
    package_price: pkg.price,
    package_start_date: startDate,
    package_end_date: endDate,
    gender: gender,
    duration: pkg.duration,
    training_type: training,
    membership_fee: pkg.price,
    parq_purchased: parqPurchased,
    parq_fee: parqPurchased ? 300 : 0,
    trainer_package: trainerPackage,
    trainer_fee: trainerPackage ? 3000 : 0,
    admission_fee: 1000,
    machine_type: gender,
    status: status,
    profile_photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName.replace(/ /g, '')}`,
    biometric_user_id: `${1000 + i}`,
    created_at: new Date(startDate).toISOString(),
    updated_at: new Date(startDate).toISOString()
  });
}

// Generate Invoices / Payments
const invoices = [];
// Total monthly revenue should be ₹245,000
// We can generate paid invoices for the month of June 2026 to sum up to exactly 245000.
// Let's create:
// 49 invoices of ₹5,000 = ₹245,000
let paidSum = 0;
const targetRevenue = 245000;
const invoiceAmountPerPaid = 5000;
const paidInvoicesCount = targetRevenue / invoiceAmountPerPaid;

for (let j = 1; j <= 200; j++) {
  // Map invoice to a member
  const member = members[(j - 1) % members.length];
  let status = 'Pending';
  let createdDate, due;
  let amt = 5000;
  
  if (j <= paidInvoicesCount) {
    status = 'Paid';
    // June 2026
    createdDate = `2026-06-${(j % 28 + 1).toString().padStart(2, '0')}T10:00:00.000Z`;
    due = `2026-07-${(j % 28 + 1).toString().padStart(2, '0')}`;
  } else if (j <= paidInvoicesCount + 15) {
    status = 'Pending';
    createdDate = '2026-06-25T14:30:00.000Z';
    due = '2026-07-05';
  } else {
    status = 'Overdue';
    createdDate = '2026-05-01T09:00:00.000Z';
    due = '2026-05-15';
  }
  
  invoices.push({
    id: `demo-invoice-uuid-${j.toString().padStart(4, '0')}`,
    member_id: member.id,
    invoice_number: `INV-${(1000 + j)}`,
    amount: amt,
    due_date: due,
    status: status,
    pdf_url: null,
    notes: 'Gym Membership Fee',
    created_at: createdDate,
    membership_fee: amt,
    parq_fee: 0,
    trainer_fee: 0,
    admission_fee: 0,
    member: {
      full_name: member.full_name,
      phone: member.phone,
      email: member.email,
      address: member.address,
      package_name: member.package_name,
      package_duration: member.package_duration,
      package_price: member.package_price,
      package_start_date: member.package_start_date,
      package_end_date: member.package_end_date
    }
  });
}

// Generate Attendance logs
// Check-ins for the active members (first 45 members)
const attendance = [];
const today = new Date(2026, 5, 30); // June 30, 2026
const activeMembers = members.filter(m => m.status === 'Active');

// Generate checkins for today (June 30)
// Occupancy: let's make it 8 members currently inside
// Checkins today: 18 members checked in today
for (let k = 0; k < activeMembers.length; k++) {
  const member = activeMembers[k];
  
  // Attendance trend chart data (weekly / monthly checkins distribution)
  // Let's create logs for the last 30 days
  for (let d = 0; d < 30; d++) {
    // Generate a punch record with 70% probability for this member on day d
    if (rand(1, 10) > 3) {
      const punchDate = new Date(2026, 5, 30 - d);
      punchDate.setHours(rand(6, 21), rand(0, 59), 0);
      
      attendance.push({
        id: `demo-attendance-uuid-${member.id}-${d}-in`,
        member_id: member.id,
        member_name: member.full_name,
        biometric_user_id: member.biometric_user_id,
        machine_type: member.machine_type,
        punch_time: punchDate.toISOString(),
        punch_type: 'checkin',
        created_at: punchDate.toISOString(),
        sync_status: 'Success'
      });
      
      // checkout 2 hours later
      const outDate = new Date(punchDate);
      outDate.setHours(outDate.getHours() + 2);
      
      // Let's keep 8 members checked-in today (no checkout punch for them)
      if (d === 0 && k < 8) {
        // Active inside gym now
        continue;
      }
      
      attendance.push({
        id: `demo-attendance-uuid-${member.id}-${d}-out`,
        member_id: member.id,
        member_name: member.full_name,
        biometric_user_id: member.biometric_user_id,
        machine_type: member.machine_type,
        punch_time: outDate.toISOString(),
        punch_type: 'checkout',
        created_at: outDate.toISOString(),
        sync_status: 'Success'
      });
    }
  }
}

// Generate trainers.json (18 trainers)
const trainers = Array.from({ length: 18 }).map((_, idx) => {
  const first = pick(firstNames);
  const last = pick(lastNames);
  const specialties = ['Bodybuilding', 'Cardio & Weight Loss', 'Strength & Conditioning', 'Yoga & Flexibility', 'Diet & Nutrition'];
  return {
    id: `trainer-${idx + 1}`,
    name: `${first} ${last}`,
    specialty: pick(specialties),
    phone: `+91 9${rand(10000000, 99999999)}`,
    status: idx < 16 ? 'Active' : 'Inactive',
    join_date: `2024-0${rand(1, 9)}-01`
  };
});

// Generate expenses.json
// Total monthly expenses: ₹38,000
const expenses = [
  { id: 'exp-1', category: 'Rent', amount: 20000, description: 'Gym Facility Rent', date: '2026-06-01', status: 'Paid' },
  { id: 'exp-2', category: 'Electricity', amount: 8000, description: 'Electricity Bill', date: '2026-06-15', status: 'Paid' },
  { id: 'exp-3', category: 'Equipment Maintenance', amount: 4000, description: 'Treadmill repairs', date: '2026-06-18', status: 'Paid' },
  { id: 'exp-4', category: 'Staff Salaries', amount: 5000, description: 'Cleaner salary', date: '2026-06-25', status: 'Paid' },
  { id: 'exp-5', category: 'Water Supply', amount: 1000, description: 'Drinking water cans', date: '2026-06-20', status: 'Paid' }
];

// Generate call_logs.json
const callLogs = Array.from({ length: 12 }).map((_, idx) => {
  const member = pick(members);
  return {
    id: `call-${idx + 1}`,
    client_name: member.full_name,
    phone: member.phone,
    shop_name: 'FusionFit Branch',
    call_status: pick(['Interested', 'Busy', 'Call Back', 'Not Interested']),
    follow_up_date: `2026-07-0${rand(1, 9)}`,
    notes: 'Discussed premium annual membership pricing and trainers package.',
    assigned_employee: pick(['Amit Sharma', 'Karan Nair', 'Anjali Gupta'])
  };
});

// Generate notifications.json
const notifications = [
  { id: 'notif-1', type: 'Membership Expiry', message: 'Arjun Sharma\'s membership expires in 2 days.', date: '2026-06-28', status: 'Unread' },
  { id: 'notif-2', type: 'Payment Reminder', message: 'INV-1015 for Priya Nair is overdue by 5 days.', date: '2026-06-29', status: 'Unread' },
  { id: 'notif-3', type: 'Birthday Reminder', message: 'It\'s Sneha Patel\'s birthday today!', date: '2026-06-30', status: 'Unread' },
  { id: 'notif-4', type: 'System Sync', message: 'Biometric device sync completed successfully.', date: '2026-06-30', status: 'Read' }
];

// Generate dashboard.json
const dashboard = {
  totalMembers: members.length,
  trainersCount: trainers.length,
  activeMemberships: activeMembers.length,
  pendingRenewals: 12,
  monthlyRevenue: targetRevenue,
  monthlyExpenses: 38000,
  netProfit: targetRevenue - 38000
};

// Write files
fs.writeFileSync(path.join(targetDir, 'dashboard.json'), JSON.stringify(dashboard, null, 2));
fs.writeFileSync(path.join(targetDir, 'members.json'), JSON.stringify(members, null, 2));
fs.writeFileSync(path.join(targetDir, 'trainers.json'), JSON.stringify(trainers, null, 2));
fs.writeFileSync(path.join(targetDir, 'attendance.json'), JSON.stringify(attendance, null, 2));
fs.writeFileSync(path.join(targetDir, 'memberships.json'), JSON.stringify(packages, null, 2));
fs.writeFileSync(path.join(targetDir, 'payments.json'), JSON.stringify(invoices, null, 2));
fs.writeFileSync(path.join(targetDir, 'expenses.json'), JSON.stringify(expenses, null, 2));
fs.writeFileSync(path.join(targetDir, 'call_logs.json'), JSON.stringify(callLogs, null, 2));
fs.writeFileSync(path.join(targetDir, 'notifications.json'), JSON.stringify(notifications, null, 2));

console.log('Demo data successfully generated in src/demo-data/');
