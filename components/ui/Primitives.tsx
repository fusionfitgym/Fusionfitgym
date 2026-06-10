'use client';

import Link from 'next/link';
import { AlertCircle, ChevronRight } from 'lucide-react';
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
    <header className={cn('page-header', className)}>
      <div className="page-header-copy">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {action && <div className="page-actions">{action}</div>}
    </header>
  );
}

interface CardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export function Card({ children, className, padding = true }: CardProps) {
  return <div className={cn('card', padding && 'p-4 sm:p-6', className)}>{children}</div>;
}

interface SectionCardProps {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  action,
  children,
  className,
}: SectionCardProps) {
  return (
    <section className={cn('card section-card', className)}>
      <div className="section-card-header">
        <div className="section-card-heading">
          {icon && <span className="icon-box">{icon}</span>}
          <div className="section-card-copy">
            <h2 className="section-title">{title}</h2>
            {description && <p className="section-description">{description}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="section-card-body">{children}</div>
    </section>
  );
}

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="contents">
          {index > 0 && <ChevronRight aria-hidden="true" className="h-3.5 w-3.5" />}
          {item.href ? (
            <Link href={item.href}>{item.label}</Link>
          ) : (
            <span className="breadcrumb-current" aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

interface FormFieldProps {
  label: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div className={cn('field-group', className)}>
      <label className="field-label" htmlFor={htmlFor}>
        {label} {required && <span className="required-mark">*</span>}
      </label>
      {children}
      {error && (
        <p className="field-error" role="alert">
          <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

export function FormError({ children }: { children: ReactNode }) {
  return (
    <div className="form-error" role="alert">
      <AlertCircle className="mt-px h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function FormActions({
  children,
  sticky = false,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <div className={cn(sticky ? 'sticky-actions' : 'form-actions', className)}>
      <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
    </div>
  );
}

export function LoadingSpinner({ size = 32 }: { size?: number }) {
  return (
    <div className="loading-state" role="status" aria-label="Loading">
      <div className="spinner" style={{ width: size, height: size }} />
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
      {icon && <div className="empty-state-icon">{icon}</div>}
      <p className="card-title">{title}</p>
      {description && <p className="small-text max-w-sm">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
