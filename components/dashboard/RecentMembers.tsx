'use client';

import Link from 'next/link';
import { Member } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/lib/utils';
import { UserCircle } from 'lucide-react';

export function RecentMembers({ members }: { members: Member[] }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <h2 className="font-bold text-gray-900 text-base">Recent Registrations</h2>
        <Link
          href="/members"
          className="text-xs font-semibold hover:underline"
          style={{ color: 'var(--gym-yellow-dark)' }}
        >
          View all →
        </Link>
      </div>
      <div className="divide-y divide-gray-50">
        {members.slice(0, 6).map(member => (
          <Link
            key={member.id}
            href={`/members/${member.id}`}
            className="flex items-center gap-4 px-6 py-4 table-row-hover transition-colors duration-150"
          >
            <div className="flex-shrink-0">
              {member.profile_photo ? (
                <img
                  src={member.profile_photo}
                  alt={member.full_name}
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-yellow-50 flex items-center justify-center">
                  <UserCircle className="w-5 h-5 text-[#FFD700]" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{member.full_name}</p>
              <p className="text-xs text-gray-400">{member.phone}</p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className="text-xs text-gray-400 hidden sm:block">{formatDate(member.join_date)}</span>
              <StatusBadge variant={member.status} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
