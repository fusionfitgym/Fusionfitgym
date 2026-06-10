'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Edit, Eye, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, LoadingSpinner, PageHeader } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { deleteMember, getMembers } from '@/lib/actions/members';
import { Member, MEMBERSHIP_PLANS, MEMBER_STATUSES } from '@/types';
import { formatDate } from '@/lib/utils';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getMembers()
      .then(setMembers)
      .finally(() => setLoading(false));
  }, []);

  const filtered = members.filter((member) => {
    const query = search.trim().toLowerCase();
    const matchesSearch =
      !query ||
      member.full_name.toLowerCase().includes(query) ||
      member.phone.toLowerCase().includes(query) ||
      (member.email ?? '').toLowerCase().includes(query);
    const matchesStatus = statusFilter === 'All' || member.status === statusFilter;
    const matchesPlan = planFilter === 'All' || member.membership_plan === planFilter;
    return matchesSearch && matchesStatus && matchesPlan;
  });

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      await deleteMember(id);
      setMembers((current) => current.filter((member) => member.id !== id));
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
        subtitle={`${members.length} registered member${members.length === 1 ? '' : 's'} across all plans.`}
        action={
          <Link href="/members/add" className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Add member
          </Link>
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
        </div>
      </section>

      {loading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No members found"
          description={members.length === 0 ? 'Add the first member to start building your workspace.' : 'Try a different search or filter combination.'}
          action={
            members.length === 0 ? (
              <Link href="/members/add" className="btn btn-primary">
                <UserPlus className="h-4 w-4" /> Add first member
              </Link>
            ) : undefined
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
                  <th className="hidden lg:table-cell">Plan</th>
                  <th className="hidden lg:table-cell">Join date</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((member) => (
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
                    <td className="hidden lg:table-cell">{member.membership_plan}</td>
                    <td className="hidden lg:table-cell">{formatDate(member.join_date)}</td>
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
            {filtered.map((member) => (
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
                    <p className="metric-label">Plan</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{member.membership_plan}</p>
                  </div>
                  <div className="text-right">
                    <p className="metric-label">Join date</p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">{formatDate(member.join_date)}</p>
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

          <div className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-6">
            Showing {filtered.length} of {members.length} members
          </div>
        </section>
      )}
    </div>
  );
}
