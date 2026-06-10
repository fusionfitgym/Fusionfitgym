'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: number;
  subtitle?: string;
  accent?: boolean;
  index?: number;
}

export function StatCard({ title, value, icon, trend, subtitle, accent, index = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`card p-6 transition-all duration-300 card-hover ${
        accent ? 'border-amber-300' : ''
      }`}
      style={accent ? { background: 'var(--color-primary)' } : {}}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className={`text-sm font-medium mb-1 ${accent ? 'text-black/60' : 'text-slate-500'}`}>{title}</p>
          <p className={`text-3xl lg:text-4xl font-bold tracking-tight leading-none ${accent ? 'text-black' : 'text-slate-900'}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-2 font-medium ${accent ? 'text-black/50' : 'text-slate-400'}`}>{subtitle}</p>
          )}
        </div>
        <div
          className={`w-12 h-12 lg:w-14 lg:h-14 rounded-2xl flex items-center justify-center flex-shrink-0 ${
            accent ? 'bg-black/10' : 'bg-amber-50'
          }`}
        >
          <div className={accent ? 'text-black' : 'text-amber-500'}>{icon}</div>
        </div>
      </div>
      {typeof trend === 'number' && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${accent ? 'text-black/60' : ''}`}>
          {trend > 0 ? (
            <><TrendingUp className="w-3.5 h-3.5 text-emerald-500" /><span className="text-emerald-600">+{trend}%</span></>
          ) : trend < 0 ? (
            <><TrendingDown className="w-3.5 h-3.5 text-red-500" /><span className="text-red-500">{trend}%</span></>
          ) : (
            <><Minus className="w-3.5 h-3.5 text-slate-400" /><span className="text-slate-400">No change</span></>
          )}
          <span className={accent ? 'text-black/40' : 'text-slate-400'}>vs last month</span>
        </div>
      )}
    </motion.div>
  );
}
