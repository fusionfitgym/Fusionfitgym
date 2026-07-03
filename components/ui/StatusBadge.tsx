import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'Active' | 'Inactive' | 'Expired' | 'Frozen' | 'Paid' | 'Partially Paid' | 'Unpaid' | 'Pending' | 'Overdue' | 'Cancelled';
  className?: string;
}

const variantMap: Record<BadgeProps['variant'], string> = {
  Active: 'badge-active',
  Inactive: 'badge-inactive',
  Expired: 'badge-expired',
  Frozen: 'badge-frozen',
  Paid: 'badge-paid',
  'Partially Paid': 'badge-pending',
  Unpaid: 'badge-inactive',
  Pending: 'badge-pending',
  Overdue: 'badge-overdue',
  Cancelled: 'badge-inactive',
};

const customStyleMap: Partial<Record<BadgeProps['variant'], React.CSSProperties>> = {
  'Partially Paid': { background: '#fef3c7', color: '#92400e' },
  Cancelled: { background: '#f1f5f9', color: '#475569' },
};

export function StatusBadge({ variant, className }: BadgeProps) {
  return (
    <span 
      className={cn('badge', variantMap[variant], className)}
      style={customStyleMap[variant]}
    >
      {variant}
    </span>
  );
}
