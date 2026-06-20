import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-slate-200/70', className)}
      {...props}
    />
  );
}

// Table loading skeleton
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="w-full overflow-hidden border border-slate-200/80 rounded-xl bg-white p-4">
      <div className="space-y-4">
        {/* Header Row */}
        <div className="flex gap-4 border-b border-slate-100 pb-4">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 flex-1 bg-slate-200/50" />
          ))}
        </div>
        {/* Body Rows */}
        {Array.from({ length: rows }).map((_, i) => (
          <div key={`r-${i}`} className="flex gap-4 py-2.5 items-center border-b border-slate-50 last:border-0">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={`c-${i}-${j}`} className={cn('h-4 flex-1', j === 0 ? 'h-5 w-3/4 flex-none' : '')} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Dashboard Stat Card Loading Skeleton
export function CardSkeleton() {
  return (
    <div className="card p-5 min-h-40 flex flex-col justify-between bg-white border-slate-200/80">
      <div className="flex justify-between items-start gap-4">
        <div className="space-y-2.5 flex-1 min-w-0">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-16" />
        </div>
        <Skeleton className="h-11 w-11 rounded-xl shrink-0" />
      </div>
      <Skeleton className="h-3 w-32 mt-5" />
    </div>
  );
}

// Chart component loading skeleton
export function ChartSkeleton() {
  return (
    <div className="card p-5 sm:p-6 min-h-80 flex flex-col justify-between bg-white border-slate-200/80">
      <div className="space-y-2">
        <Skeleton className="h-4.5 w-32" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="h-56 w-full flex items-end gap-3 sm:gap-4 mt-6">
        {[40, 75, 55, 90, 60, 80].map((h, i) => (
          <Skeleton
            key={i}
            className="flex-1 rounded-t-lg bg-amber-200/30"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Roster Card List Skeleton (for mobile lists)
export function MobileListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-4 bg-white border-slate-200/80">
          <div className="flex justify-between items-center gap-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full shrink-0" />
          </div>
          <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
            <div className="space-y-1.5">
              <Skeleton className="h-2.5 w-10" />
              <Skeleton className="h-3.5 w-16" />
            </div>
            <div className="space-y-1.5 items-end flex flex-col">
              <Skeleton className="h-2.5 w-12" />
              <Skeleton className="h-3.5 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
