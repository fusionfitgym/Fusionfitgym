'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between mb-8 gap-4', className)}>
      <div>
        <h1 className="text-page-title">{title}</h1>
        {subtitle && <p className="text-base text-slate-500 mt-1 font-medium">{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0 pt-1">{action}</div>}
    </div>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={cn(
        'card',
        padding && 'p-6',
        className
      )}
    >
      {children}
    </div>
  );
}

export function LoadingSpinner({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-12">
      <div
        className="spin rounded-full border-2 border-slate-200"
        style={{
          width: size,
          height: size,
          borderTopColor: 'var(--color-primary)',
        }}
      />
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      {icon && <div className="text-4xl mb-2">{icon}</div>}
      <p className="font-semibold text-slate-700 text-base">{title}</p>
      {description && <p className="text-sm text-slate-400 text-center max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
