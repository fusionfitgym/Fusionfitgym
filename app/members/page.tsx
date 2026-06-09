'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Trash2, Eye, Edit } from 'lucide-react';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getMembers, deleteMember } from '@/lib/actions/members';
import { Member, MEMBER_STATUSES, MEMBERSHIP_PLANS } from '@/types';
import { formatDate } from '@/lib/utils';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [filtered, setFiltered] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getMembers().then(data => { setMembers(data); setFiltered(data); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let result = members;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(m =>
        m.full_name.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        (m.email ?? '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') result = result.filter(m => m.status === statusFilter);
    if (planFilter !== 'All') result = result.filter(m => m.membership_plan === planFilter);
    setFiltered(result);
  }, [search, statusFilter, planFilter, members]);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete member "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteMember(id);
      setMembers(prev => prev.filter(m => m.id !== id));
    } catch {
      alert('Failed to delete member.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="page-enter">
      <PageHeader
        title="Members"
        subtitle={`${members.length} total members registered`}
        action={
          <Link href="/members/add" className="btn-yellow text-sm">
            <UserPlus className="w-4 h-4" /> Add Member
          </Link>
        }
      />

      {/* Filters */}
      <Card className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="All">All Status</option>
            {MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
          >
            <option value="All">All Plans</option>
            {MEMBERSHIP_PLANS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </Card>

      {loading ? (
        <LoadingSpinner size={36} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="👥"
          title="No members found"
          description="Try adjusting your search or add a new member."
          action={
            <Link href="/members/add" className="btn-yellow text-sm">
              <UserPlus className="w-4 h-4" /> Add First Member
            </Link>
          }
        />
      ) : (
        <Card padding={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Plan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Join Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(member => (
                  <tr key={member.id} className="table-row-hover transition-colors duration-100">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.profile_photo ? (
                          <img src={member.profile_photo} alt={member.full_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-[#E6C200]">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900">{member.full_name}</p>
                          <p className="text-xs text-gray-400 md:hidden">{member.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-gray-600 hidden md:table-cell">{member.phone}</td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="px-2 py-0.5 bg-gray-50 rounded-md text-xs font-medium text-gray-600">
                        {member.membership_plan}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-500 hidden lg:table-cell">{formatDate(member.join_date)}</td>
                    <td className="px-4 py-4"><StatusBadge variant={member.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/members/${member.id}`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/members/${member.id}/edit`}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-green-500 hover:bg-green-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(member.id, member.full_name)}
                          disabled={deleting === member.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t border-gray-50 text-xs text-gray-400">
            Showing {filtered.length} of {members.length} members
          </div>
        </Card>
      )}
    </div>
  );
}
