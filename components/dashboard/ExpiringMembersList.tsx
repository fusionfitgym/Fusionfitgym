import { memo } from 'react';
import Link from 'next/link';
import { Clock, RefreshCw } from 'lucide-react';
import { SmsSendButton } from '@/components/ui/SmsSendButton';
import { buildExpiryReminderMessage } from '@/lib/native-sms';
import { formatDate, cn } from '@/lib/utils';

export interface ExpiringMember {
  id: string;
  full_name: string;
  phone?: string | null;
  package_end_date?: string;
  daysRemaining: number;
  expiryDate: Date;
}

interface ExpiringMembersListProps {
  members: ExpiringMember[];
  expiringSoon: number;
  showAttendanceAnalytics: boolean;
}

/**
 * ExpiringMembersList
 *
 * Client Component that renders the expiring memberships roster
 * with native SMS buttons and quick Renew action.
 */
export const ExpiringMembersList = memo(function ExpiringMembersList({
  members,
  expiringSoon,
  showAttendanceAnalytics,
}: ExpiringMembersListProps) {
  return (
    <section
      className={cn(
        'card p-4 sm:p-6',
        !showAttendanceAnalytics && 'xl:col-span-3',
      )}
    >
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="section-title font-bold text-slate-900">
            Expiring memberships
          </h2>
          <p className="section-description">Expiring in the next 7 days</p>
        </div>
        <span className="badge badge-inactive font-bold">{expiringSoon}</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto pr-1">
        {members.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <Link href={`/members/${m.id}`} prefetch={true} className="text-sm font-semibold text-slate-950 hover:text-amber-600 hover:underline truncate block">
                {m.full_name}
              </Link>
              <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                <Clock className="h-3 w-3 shrink-0" />
                Expires {formatDate(m.expiryDate)}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="badge badge-expired text-[10px] font-bold whitespace-nowrap">
                {m.daysRemaining} day{m.daysRemaining === 1 ? '' : 's'} left
              </span>
              <Link
                href={`/members/${m.id}`}
                prefetch={true}
                className="btn btn-xs bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold py-1 px-2 text-[10px] rounded-lg"
                title="Renew Membership"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Renew
              </Link>
              <SmsSendButton
                phone={m.phone}
                message={buildExpiryReminderMessage(
                  m.full_name,
                  formatDate(m.expiryDate),
                )}
                variant="sms"
                size="sm"
                label="SMS"
              />
            </div>
          </div>
        ))}

        {members.length === 0 && (
          <div className="p-8 text-center text-xs text-slate-400">
            No memberships expiring soon.
          </div>
        )}
      </div>
    </section>
  );
});
