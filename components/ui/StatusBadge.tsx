import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'Active' | 'Inactive' | 'Expired' | 'Frozen' | 'Paid' | 'Pending' | 'Overdue';
  className?: string;
}

const variantMap: Record<BadgeProps['variant'], string> = {
  Active: 'badge-active',
  Inactive: 'badge-inactive',
  Expired: 'badge-expired',
  Frozen: 'badge-frozen',
  Paid: 'badge-paid',
  Pending: 'badge-pending',
  Overdue: 'badge-overdue',
};

export function StatusBadge({ variant, className }: BadgeProps) {
  return <span className={cn('badge', variantMap[variant], className)}>{variant}</span>;
}
