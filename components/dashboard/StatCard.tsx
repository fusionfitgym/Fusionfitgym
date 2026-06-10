import { ReactNode } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  accent?: boolean;
}

export function StatCard({ title, value, icon, trend, subtitle, accent }: StatCardProps) {
  return (
    <article className={cn('card card-hover flex min-h-40 flex-col justify-between p-5 sm:p-6', accent && 'border-amber-300 bg-amber-300')}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={cn('text-[13px] font-medium', accent ? 'text-black/60' : 'text-slate-500')}>{title}</p>
          <p className={cn('mt-2 truncate text-3xl font-bold leading-none tracking-[-0.04em]', accent ? 'text-black' : 'text-slate-950')}>
            {value}
          </p>
        </div>
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', accent ? 'bg-black/10 text-black' : 'bg-amber-50 text-amber-600')}>
          {icon}
        </div>
      </div>

      <div className="mt-5">
        {typeof trend === 'number' ? (
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {trend > 0 ? (
              <>
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-700">+{trend}%</span>
              </>
            ) : trend < 0 ? (
              <>
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                <span className="text-red-600">{trend}%</span>
              </>
            ) : (
              <>
                <Minus className="h-3.5 w-3.5 text-slate-400" />
                <span className="text-slate-500">No change</span>
              </>
            )}
            <span className={accent ? 'text-black/45' : 'text-slate-400'}>vs last month</span>
          </div>
        ) : (
          <p className={cn('text-xs font-medium', accent ? 'text-black/50' : 'text-slate-400')}>{subtitle}</p>
        )}
      </div>
    </article>
  );
}
