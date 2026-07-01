'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Edit,
  Eye,
  HardHat,
  Search,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Primitives';
import { PageHeader } from '@/components/ui/Primitives';
import { StaffStatusBadge } from '@/components/staff/StaffStatusBadge';
import { getStaff, deleteStaff } from '@/lib/actions/staff';
import { Staff } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';
import { formatDate, cn } from '@/lib/utils';
import { TableSkeleton, MobileListSkeleton } from '@/components/ui/Skeleton';

type RoleFilter = 'All' | 'Trainer' | 'Janitor';
type StatusFilter = 'All' | 'Active' | 'Inactive';

export default function StaffPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();
  const role = profile?.role;
  const canWrite = role === 'Super Admin' || role === 'Admin';

  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('All');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Staff | null>(null);

  const limit = 10;
  const totalPages = Math.ceil(totalCount / limit);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => { setPage(1); }, [roleFilter, statusFilter]);

  useEffect(() => {
    setLoading(true);
    if (isDemo) {
      const data = demo.getStaff({ page, limit, search: debouncedSearch, role: roleFilter, status: statusFilter });
      setStaffList(data.staff);
      setTotalCount(data.totalCount);
      setLoading(false);
      return;
    }

    getStaff({ page, limit, search: debouncedSearch, role: roleFilter, status: statusFilter })
      .then((data) => {
        setStaffList(data.staff);
        setTotalCount(data.totalCount);
      })
      .catch((err) => {
        console.error('Error fetching staff:', err);
        toast.error('Failed to load staff');
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, roleFilter, statusFilter, isDemo]);

  async function handleDelete(staff: Staff) {
    if (isDemo) {
      demo.deleteStaff(staff.id);
      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success(`${staff.full_name} removed (Demo Mode)`);
      return;
    }
    setDeleting(staff.id);
    try {
      const res = await deleteStaff(staff.id);
      if (res.error) throw new Error(res.error);
      setStaffList((prev) => prev.filter((s) => s.id !== staff.id));
      setTotalCount((c) => Math.max(0, c - 1));
      toast.success(`${staff.full_name} deleted successfully.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete staff member');
    } finally {
      setDeleting(null);
    }
  }

  const filterTabs: { label: string; role: RoleFilter }[] = [
    { label: 'All Staff', role: 'All' },
    { label: 'Trainers', role: 'Trainer' },
    { label: 'Janitors', role: 'Janitor' },
  ];

  return (
    <div className="page page-enter">
      <PageHeader
        title="Staff"
        subtitle={`${totalCount} staff member${totalCount !== 1 ? 's' : ''} registered`}
        action={
          canWrite ? (
            <Link href="/members/add?type=Trainer" className="btn btn-primary">
              <UserPlus className="h-4 w-4" /> Add Staff
            </Link>
          ) : undefined
        }
      />

      {/* Filters */}
      <section className="card mb-6 overflow-hidden">
        <div className="filter-bar">
          {/* Search */}
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              id="staff-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, employee ID, or phone…"
              className="input-field"
              aria-label="Search staff"
            />
          </div>

          {/* Role filter tabs */}
          <div className="flex rounded-xl border border-slate-200 overflow-hidden shrink-0">
            {filterTabs.map((tab) => (
              <button
                key={tab.role}
                type="button"
                onClick={() => setRoleFilter(tab.role)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer',
                  roleFilter === tab.role
                    ? 'bg-amber-400 text-zinc-900'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="select-field md:w-44"
            aria-label="Filter by status"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </section>

      {/* Table — Desktop */}
      <div className="card hidden md:block overflow-hidden">
        {loading ? (
          <TableSkeleton rows={5} cols={7} />
        ) : staffList.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-8 w-8" />}
            title="No staff members found"
            description={search || roleFilter !== 'All' || statusFilter !== 'All'
              ? 'Try adjusting your search or filters.'
              : 'Add your first trainer or janitor to get started.'}
            action={canWrite ? (
              <Link href="/members/add?type=Trainer" className="btn btn-primary btn-sm">
                <UserPlus className="h-4 w-4" /> Add Staff
              </Link>
            ) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Employee</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Role</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Phone</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Joining Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Shift</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="group hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar src={staff.profile_photo} name={staff.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{staff.full_name}</p>
                          <p className="text-xs text-slate-400">{staff.employee_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                        staff.role === 'Trainer'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-100 text-blue-800'
                      )}>
                        {staff.role === 'Trainer' ? '💪' : '🧹'} {staff.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{staff.phone}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDate(staff.joining_date)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{staff.shift || '—'}</td>
                    <td className="px-4 py-3">
                      <StaffStatusBadge status={staff.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/staff/${staff.id}`}
                          className="btn btn-ghost btn-sm"
                          title="View"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                        {canWrite && (
                          <>
                            <Link
                              href={`/staff/${staff.id}/edit`}
                              className="btn btn-ghost btn-sm"
                              title="Edit"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Link>
                            <ConfirmDialog
                              trigger={
                                <button
                                  type="button"
                                  disabled={deleting === staff.id}
                                  className="btn btn-ghost btn-sm text-red-500 hover:text-red-700 hover:bg-red-50"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              }
                              title="Delete Staff Member"
                              description={`Are you sure you want to permanently delete ${staff.full_name} (${staff.employee_id})? This action cannot be undone.`}
                              confirmLabel="Delete"
                              onConfirm={() => handleDelete(staff)}
                            />
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <MobileListSkeleton count={5} />
        ) : staffList.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-8 w-8" />}
            title="No staff members found"
            description="Try adjusting your search or filters."
          />
        ) : (
          staffList.map((staff) => (
            <div key={staff.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar src={staff.profile_photo} name={staff.full_name} size="md" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{staff.full_name}</p>
                    <p className="text-xs text-slate-400">{staff.employee_id}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                        staff.role === 'Trainer' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                      )}>
                        {staff.role}
                      </span>
                      <StaffStatusBadge status={staff.status} />
                    </div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Link href={`/staff/${staff.id}`} className="btn btn-ghost btn-sm">
                    <Eye className="h-3.5 w-3.5" />
                  </Link>
                  {canWrite && (
                    <>
                      <Link href={`/staff/${staff.id}/edit`} className="btn btn-ghost btn-sm">
                        <Edit className="h-3.5 w-3.5" />
                      </Link>
                      <ConfirmDialog
                        trigger={
                          <button type="button" className="btn btn-ghost btn-sm text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        }
                        title="Delete Staff Member"
                        description={`Permanently delete ${staff.full_name}? This cannot be undone.`}
                        confirmLabel="Delete"
                        onConfirm={() => handleDelete(staff)}
                      />
                    </>
                  )}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <span>📞 {staff.phone}</span>
                <span>📅 {formatDate(staff.joining_date)}</span>
                {staff.shift && <span>🕐 {staff.shift}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn btn-ghost btn-sm"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn btn-ghost btn-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* No longer need external ConfirmDialog at bottom — inline ConfirmDialog used above */}
    </div>
  );
}
