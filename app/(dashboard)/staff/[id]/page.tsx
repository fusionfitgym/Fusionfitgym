'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  Edit,
  HardHat,
  Mail,
  MapPin,
  Phone,
  Trash2,
  User,
  Users,
  Fingerprint,
} from 'lucide-react';
import { Breadcrumb, SectionCard } from '@/components/ui/Primitives';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StaffStatusBadge } from '@/components/staff/StaffStatusBadge';
import { getStaffById, deleteStaff } from '@/lib/actions/staff';
import { Staff } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';
import { formatDate, formatCurrency, cn } from '@/lib/utils';

function InfoRow({ label, value, icon: Icon }: { label: string; value?: string | number | null; icon?: React.ElementType }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-50 last:border-0">
      {Icon && <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const canWrite = profile?.role === 'Super Admin' || profile?.role === 'Admin';

  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isDemo) {
      const s = demo.getStaffById(id);
      setStaff(s);
      setLoading(false);
      return;
    }
    getStaffById(id).then((s) => {
      setStaff(s);
      setLoading(false);
    });
  }, [id, isDemo]);

  async function handleDelete() {
    if (!staff) return;
    setDeleting(true);
    if (isDemo) {
      demo.deleteStaff(id);
      toast.success(`${staff.full_name} deleted (Demo Mode)`);
      router.push('/staff');
      return;
    }
    const res = await deleteStaff(id);
    if (res.error) {
      toast.error(res.error);
      setDeleting(false);
    } else {
      toast.success(`${staff.full_name} deleted successfully.`);
      router.push('/staff');
    }
  }

  if (loading) {
    return (
      <div className="page page-enter animate-pulse">
        <div className="h-8 w-48 bg-slate-100 rounded mb-4" />
        <div className="card p-6 space-y-4">
          <div className="h-20 w-20 rounded-full bg-slate-100" />
          <div className="h-6 w-64 bg-slate-100 rounded" />
          <div className="h-4 w-40 bg-slate-100 rounded" />
        </div>
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="page page-enter">
        <p className="text-slate-600">Staff member not found.</p>
        <Link href="/staff" className="btn btn-ghost mt-4">← Back to Staff</Link>
      </div>
    );
  }

  return (
    <div className="page-wide page-enter">
      <Breadcrumb items={[{ label: 'Staff', href: '/staff' }, { label: staff.full_name }]} />

      {/* Header */}
      <div className="card mb-6 p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          <Avatar src={staff.profile_photo} name={staff.full_name} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-xl font-bold text-slate-900">{staff.full_name}</h1>
              <StaffStatusBadge status={staff.status} />
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-slate-500">
              <span className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                staff.role === 'Trainer' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
              )}>
                {staff.role === 'Trainer' ? '' : ''} {staff.role}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="h-3.5 w-3.5" /> {staff.employee_id}
              </span>
              {staff.joining_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Since {formatDate(staff.joining_date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/staff" className="btn btn-ghost btn-sm">
              <ArrowLeft className="h-4 w-4" /> Back
            </Link>
            {canWrite && (
              <>
                <Link href={`/staff/${id}/edit`} className="btn btn-secondary btn-sm">
                  <Edit className="h-4 w-4" /> Edit
                </Link>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-red-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </button>
                  }
                  title="Delete Staff Member"
                  description={`Are you sure you want to permanently delete ${staff.full_name} (${staff.employee_id})? This action cannot be undone.`}
                  confirmLabel="Delete"
                  onConfirm={handleDelete}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Information */}
        <SectionCard
          title="Personal Information"
          icon={<User className="h-4 w-4" />}
        >
          <InfoRow label="Full Name" value={staff.full_name} icon={User} />
          <InfoRow label="Gender" value={staff.gender} icon={User} />
          <InfoRow label="Date of Birth" value={staff.dob ? formatDate(staff.dob) : null} icon={Calendar} />
          <InfoRow label="Phone" value={staff.phone} icon={Phone} />
          <InfoRow label="Email" value={staff.email} icon={Mail} />
          <InfoRow label="Address" value={staff.address} icon={MapPin} />
          <InfoRow label="Emergency Contact" value={staff.emergency_contact} icon={Phone} />
        </SectionCard>

        {/* Employment Details */}
        <SectionCard
          title="Employment Details"
          icon={<Briefcase className="h-4 w-4" />}
        >
          <InfoRow label="Employee ID" value={staff.employee_id} icon={Briefcase} />
          <InfoRow label="Joining Date" value={staff.joining_date ? formatDate(staff.joining_date) : null} icon={Calendar} />
          <InfoRow label="Monthly Salary" value={staff.salary ? formatCurrency(staff.salary) : null} icon={DollarSign} />
          <InfoRow label="Shift" value={staff.shift} icon={Calendar} />
          <InfoRow label="Status" value={staff.status} icon={HardHat} />
          <InfoRow label="Biometric User ID" value={staff.biometric_user_id || '—'} icon={Fingerprint} />
        </SectionCard>

        {/* Trainer Details */}
        {staff.role === 'Trainer' && (
          <SectionCard
            title="Trainer Details"
            icon={<Users className="h-4 w-4" />}
            className="lg:col-span-2"
          >
            <InfoRow label="Specialization" value={staff.specialization} icon={Users} />
            <InfoRow label="Experience" value={staff.experience !== null && staff.experience !== undefined ? `${staff.experience} year${staff.experience !== 1 ? 's' : ''}` : null} icon={Briefcase} />
            <InfoRow label="Certifications" value={staff.certifications} icon={HardHat} />
            <InfoRow label="Notes" value={staff.notes} icon={User} />
          </SectionCard>
        )}

        {/* Janitor Details */}
        {staff.role === 'Janitor' && (
          <SectionCard
            title="Janitor Details"
            icon={<HardHat className="h-4 w-4" />}
            className="lg:col-span-2"
          >
            <InfoRow label="Cleaning Area" value={staff.cleaning_area} icon={MapPin} />
            <InfoRow label="Working Shift Hours" value={staff.working_shift} icon={Calendar} />
            <InfoRow label="Notes" value={staff.notes} icon={User} />
          </SectionCard>
        )}
      </div>
    </div>
  );
}
