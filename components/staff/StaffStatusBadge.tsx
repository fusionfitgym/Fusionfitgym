'use client';

import { cn } from '@/lib/utils';

interface StaffStatusBadgeProps {
  status: 'Active' | 'Inactive';
  className?: string;
}

export function StaffStatusBadge({ status, className }: StaffStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        status === 'Active'
          ? 'bg-emerald-100 text-emerald-800'
          : 'bg-zinc-100 text-zinc-600',
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'
        )}
      />
      {status}
    </span>
  );
}
