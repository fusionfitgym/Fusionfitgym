import { cn } from '@/lib/utils';

interface BadgeProps {
  variant: 'Active' | 'Inactive' | 'Expired' | 'Frozen' | 'Paid' | 'Pending' | 'Overdue';
  className?: string;
}

const variantMap: Record<string, string> = {
  Active:   'badge-active',
  Inactive: 'badge-inactive',
  Expired:  'badge-expired',
  Frozen:   'badge-frozen',
  Paid:     'badge-paid',
  Pending:  'badge-pending',
  Overdue:  'badge-overdue',
};

export function StatusBadge({ variant, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantMap[variant] ?? 'bg-gray-100 text-gray-700',
        className
      )}
    >
      {variant}
    </span>
  );
}
