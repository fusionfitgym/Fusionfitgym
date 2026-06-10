'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, Trash2, Eye, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { PageHeader, Card, LoadingSpinner, EmptyState } from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getMembers, deleteMember } from '@/lib/actions/members';
import { Member, MEMBER_STATUSES, MEMBERSHIP_PLANS } from '@/types';
import { formatDate } from '@/lib/utils';

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getMembers().then(data => { setMembers(data); }).finally(() => setLoading(false));
  }, []);

  const filtered = members.filter(m => {
    if (search) {
      const q = search.toLowerCase();
      if (!m.full_name.toLowerCase().includes(q) && !m.phone.includes(q) && !(m.email ?? '').toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'All' && m.status !== statusFilter) return false;
    if (planFilter !== 'All' && m.membership_plan !== planFilter) return false;
    return true;
  });

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
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
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
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-11"
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="select-field sm:w-44"
          >
            <option value="All">All Status</option>
            {MEMBER_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
          <select
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="select-field sm:w-44"
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
          <div className="data-table overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Member</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden md:table-cell">Phone</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Plan</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider hidden lg:table-cell">Join Date</th>
                  <th className="text-left px-4 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(member => (
                  <tr key={member.id} className="table-row-hover transition-colors duration-100">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {member.profile_photo ? (
                          <img src={member.profile_photo} alt={member.full_name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-amber-600">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{member.full_name}</p>
                          <p className="text-xs text-slate-400 md:hidden">{member.phone}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-slate-600 hidden md:table-cell">{member.phone}</td>
                    <td className="px-4 py-4 hidden lg:table-cell">
                      <span className="px-2.5 py-1 bg-slate-50 rounded-lg text-xs font-medium text-slate-600">
                        {member.membership_plan}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-slate-500 hidden lg:table-cell">{formatDate(member.join_date)}</td>
                    <td className="px-4 py-4"><StatusBadge variant={member.status} /></td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/members/${member.id}`}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-500 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                        <Link
                          href={`/members/${member.id}/edit`}
                          className="p-2 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Link>
                        <button
                          onClick={() => handleDelete(member.id, member.full_name)}
                          disabled={deleting === member.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
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

          <div className="data-cards flex-col divide-y divide-slate-100 hidden">
            {filtered.map(member => (
              <div key={member.id} className="p-4 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {member.profile_photo ? (
                      <img src={member.profile_photo} alt={member.full_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-amber-600">
                        {member.full_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">{member.full_name}</p>
                      <p className="text-xs text-slate-500">{member.phone}</p>
                    </div>
                  </div>
                  <StatusBadge variant={member.status} />
                </div>
                
                <div className="flex items-center justify-between mt-1 text-sm">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 text-xs">Plan</span>
                    <span className="font-medium text-slate-900">{member.membership_plan}</span>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className="text-slate-500 text-xs">Join Date</span>
                    <span className="font-medium text-slate-900">{formatDate(member.join_date)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2 pt-3 border-t border-slate-50">
                  <Link
                    href={`/members/${member.id}`}
                    className="flex-1 py-2 text-center rounded-lg bg-slate-50 text-slate-600 text-sm font-medium hover:bg-slate-100"
                  >
                    View
                  </Link>
                  <Link
                    href={`/members/${member.id}/edit`}
                    className="flex-1 py-2 text-center rounded-lg bg-emerald-50 text-emerald-600 text-sm font-medium hover:bg-emerald-100"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(member.id, member.full_name)}
                    disabled={deleting === member.id}
                    className="flex-1 py-2 text-center rounded-lg bg-red-50 text-red-600 text-sm font-medium hover:bg-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="px-6 py-3 border-t border-slate-100 text-xs text-slate-400 font-medium">
            Showing {filtered.length} of {members.length} members
          </div>
        </Card>
      )}
    </motion.div>
  );
}
