'use client';

import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

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
    <div
      className={`rounded-2xl p-6 border transition-all duration-300 card-glow ${
        accent
          ? 'border-[#FFD700] text-black'
          : 'bg-white border-gray-100 text-gray-900'
      }`}
      style={accent ? { background: 'var(--gym-yellow)' } : {}}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-sm font-medium mb-1 ${accent ? 'text-black/70' : 'text-gray-500'}`}>{title}</p>
          <p className={`text-3xl font-bold tracking-tight ${accent ? 'text-black' : 'text-gray-900'}`}>
            {value}
          </p>
          {subtitle && (
            <p className={`text-xs mt-1 ${accent ? 'text-black/60' : 'text-gray-400'}`}>{subtitle}</p>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
            accent ? 'bg-black/10' : 'bg-yellow-50'
          }`}
        >
          <div className={accent ? 'text-black' : 'text-[#FFD700]'}>{icon}</div>
        </div>
      </div>
      {typeof trend === 'number' && (
        <div className={`flex items-center gap-1 mt-3 text-xs font-medium ${accent ? 'text-black/70' : ''}`}>
          {trend > 0 ? (
            <><TrendingUp className="w-3 h-3 text-green-500" /><span className="text-green-600">+{trend}%</span></>
          ) : trend < 0 ? (
            <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-500">{trend}%</span></>
          ) : (
            <><Minus className="w-3 h-3 text-gray-400" /><span className="text-gray-400">No change</span></>
          )}
          <span className={accent ? 'text-black/50' : 'text-gray-400'}>vs last month</span>
        </div>
      )}
    </div>
  );
}
