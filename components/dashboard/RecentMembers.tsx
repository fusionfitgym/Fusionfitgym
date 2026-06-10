import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import { Member } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/Primitives';
import { formatDate } from '@/lib/utils';

export function RecentMembers({ members }: { members: Member[] }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-4 sm:px-6">
        <div>
          <h2 className="section-title">Recent registrations</h2>
          <p className="section-description">The latest members added to the workspace</p>
        </div>
        <Link href="/members" className="btn btn-ghost btn-sm">
          View all <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No members yet"
          description="New member registrations will appear here."
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {members.slice(0, 6).map((member) => (
            <Link
              key={member.id}
              href={`/members/${member.id}`}
              className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 sm:px-6"
            >
              <Avatar src={member.profile_photo} name={member.full_name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-950">{member.full_name}</p>
                <p className="truncate text-xs text-slate-500">{member.phone}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="hidden text-xs text-slate-400 sm:block">{formatDate(member.join_date)}</span>
                <StatusBadge variant={member.status} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
