'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit, Eye, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { deleteMember, getMembersPaginated } from '@/lib/actions/members';
import { Member, MEMBERSHIP_PLANS, MEMBER_STATUSES } from '@/types';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { toast } from 'sonner';
import { formatDate, cn } from '@/lib/utils';
import { TableSkeleton, MobileListSkeleton } from '@/components/ui/Skeleton';

export default function MembersPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [members, setMembers] = useState<Member[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [machineFilter, setMachineFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);

  const limit = 10;
  const totalPages = Math.ceil(totalCount / limit);

  // Debounce search input to avoid query spamming on every keystroke
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to page 1 on new search query
    }, 300);

    return () => clearTimeout(handler);
  }, [search]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, planFilter, machineFilter]);

  // Fetch paginated members list
  useEffect(() => {
    if (isDemo) {
      const data = demo.getMembersPaginated({
        page,
        limit,
        search: debouncedSearch,
        status: statusFilter,
        plan: planFilter,
        machine: machineFilter
      });
      setMembers(data.members);
      setTotalCount(data.totalCount);
      setLoading(false);
      return;
    }

    setLoading(true);
    getMembersPaginated({
      page,
      limit,
      search: debouncedSearch,
      status: statusFilter,
      plan: planFilter,
      machine: machineFilter
    })
      .then((data) => {
        setMembers(data.members);
        setTotalCount(data.totalCount);
      })
      .catch((err) => console.error('Failed to load paginated members:', err))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, planFilter, machineFilter, isDemo, demo.members]);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      if (isDemo) {
        demo.deleteMember(id);
        setMembers((current) => current.filter((member) => member.id !== id));
        setTotalCount((c) => Math.max(0, c - 1));
        toast.success('Member deleted successfully (Demo Mode)');
        return;
      }
      await deleteMember(id);
      setMembers((current) => current.filter((member) => member.id !== id));
      setTotalCount((c) => Math.max(0, c - 1));
    } catch {
      window.alert('Failed to delete member.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="page page-enter">
      <PageHeader
        title="Members"
        subtitle={`${totalCount} registered member${totalCount === 1 ? '' : 's'} across all plans.`}
        action={
          <div className="flex items-center gap-3">
            <Link href="/members/add" className="btn btn-primary">
              <UserPlus className="h-4 w-4" /> Add member
            </Link>
          </div>
        }
      />

      <section className="card mb-6 overflow-hidden">
        <div className="filter-bar">
          <div className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              type="search"
              placeholder="Search name, phone, or email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="input-field"
              aria-label="Search members"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="select-field md:w-44"
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {MEMBER_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <select
            value={planFilter}
            onChange={(event) => setPlanFilter(event.target.value)}
            className="select-field md:w-44"
            aria-label="Filter by membership plan"
          >
            <option value="All">All plans</option>
            {MEMBERSHIP_PLANS.map((plan) => <option key={plan}>{plan}</option>)}
          </select>

          <select
            value={machineFilter}
            onChange={(event) => setMachineFilter(event.target.value)}
            className="select-field md:w-44"
            aria-label="Filter by machine"
          >
            <option value="All">All Members</option>
            <option value="Gents">Gents Machine</option>
            <option value="Ladies">Ladies Machine</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="space-y-4">
          <div className="hidden md:block">
            <TableSkeleton rows={limit} cols={6} />
          </div>
          <div className="md:hidden">
            <MobileListSkeleton count={3} />
          </div>
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No members found"
          description={debouncedSearch || statusFilter !== 'All' || planFilter !== 'All' ? 'Try a different search or filter combination.' : 'Add the first member to start building your workspace.'}
          action={
            debouncedSearch || statusFilter !== 'All' || planFilter !== 'All' ? undefined : (
              <Link href="/members/add" className="btn btn-primary">
                <UserPlus className="h-4 w-4" /> Add first member
              </Link>
            )
          }
        />
      ) : (
        <section className="card overflow-hidden">
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="hidden md:table-cell">Phone</th>
                  <th className="hidden lg:table-cell">Membership</th>
                  <th className="hidden md:table-cell">Biometric User ID</th>
                  <th className="hidden md:table-cell">Machine</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar src={member.profile_photo} name={member.full_name} size="sm" />
                        <div className="min-w-0">
                          <p className="table-primary truncate">{member.full_name}</p>
                          <p className="table-secondary truncate md:hidden">{member.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell">{member.phone}</td>
                    <td className="hidden lg:table-cell">{member.package_name}</td>
                    <td className="hidden md:table-cell font-mono text-xs font-semibold text-slate-600">
                      {member.biometric_user_id || '—'}
                    </td>
                    <td className="hidden md:table-cell">{member.machine_type || 'Gents'}</td>
                    <td><StatusBadge variant={member.status} /></td>
                    <td>
                      <div className="table-actions">
                        <Link href={`/members/${member.id}`} className="table-action" title="View member" aria-label={`View ${member.full_name}`}>
                          <Eye className="h-4 w-4" />
                        </Link>
                        <Link href={`/members/${member.id}/edit`} className="table-action" title="Edit member" aria-label={`Edit ${member.full_name}`}>
                          <Edit className="h-4 w-4" />
                        </Link>
                        <ConfirmDialog
                          title="Delete member?"
                          description={`This will permanently delete ${member.full_name} and cannot be undone.`}
                          onConfirm={() => void handleDelete(member.id)}
                          trigger={
                            <button
                              type="button"
                              className="table-action table-action-danger"
                              disabled={deleting === member.id}
                              title="Delete member"
                              aria-label={`Delete ${member.full_name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          }
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="data-cards">
            {members.map((member) => (
              <article key={member.id} className="mobile-record">
                <div className="mobile-record-header">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar src={member.profile_photo} name={member.full_name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-950">{member.full_name}</p>
                      <p className="truncate text-xs text-slate-500">{member.phone}</p>
                    </div>
                  </div>
                  <StatusBadge variant={member.status} />
                </div>
                    <div className="mobile-record-meta">
                  <div>
                    <p className="metric-label">Membership</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{member.package_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="metric-label">Biometric User ID</p>
                    <p className="mt-1 font-mono text-xs font-bold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                      {member.biometric_user_id || '—'}
                    </p>
                        <p className="metric-label">Machine</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{member.machine_type || 'Gents'}</p>
                  </div>
                </div>
                <div className="mobile-record-actions">
                  <Link href={`/members/${member.id}`} className="btn btn-secondary btn-sm">View</Link>
                  <Link href={`/members/${member.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                  <ConfirmDialog
                    title="Delete member?"
                    description={`This will permanently delete ${member.full_name} and cannot be undone.`}
                    onConfirm={() => void handleDelete(member.id)}
                    trigger={
                      <button type="button" className="btn btn-danger btn-sm" disabled={deleting === member.id}>
                        Delete
                      </button>
                    }
                  />
                </div>
              </article>
            ))}
          </div>

          {/* Premium Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 sm:px-6">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn btn-secondary btn-sm"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn btn-secondary btn-sm"
              >
                Next
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">
                  Showing <span className="font-semibold text-slate-900">{Math.min(totalCount, (page - 1) * limit + 1)}</span> to{' '}
                  <span className="font-semibold text-slate-900">{Math.min(totalCount, page * limit)}</span> of{' '}
                  <span className="font-semibold text-slate-900">{totalCount}</span> members
                </p>
              </div>
              {totalPages > 1 && (
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-xl shadow-xs" aria-label="Pagination">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center rounded-l-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Previous
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      const pageNum = i + 1;
                      if (totalPages > 5 && Math.abs(pageNum - page) > 2 && pageNum !== 1 && pageNum !== totalPages) {
                        if (pageNum === 2 || pageNum === totalPages - 1) {
                          return <span key={pageNum} className="relative inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-400">...</span>;
                        }
                        return null;
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setPage(pageNum)}
                          aria-current={page === pageNum ? 'page' : undefined}
                          className={cn(
                            'relative inline-flex items-center border px-3 py-1.5 text-xs font-semibold focus:z-20 cursor-pointer',
                            page === pageNum
                              ? 'z-10 border-amber-300 bg-amber-50 text-amber-700'
                              : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                          )}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center rounded-r-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 focus:z-20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}
