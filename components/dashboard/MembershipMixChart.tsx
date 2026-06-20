'use client';

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const planColors: Record<string, string> = {
  Monthly: '#f4c430',
  Quarterly: '#f59e0b',
  Biannual: '#64748b',
  Annual: '#18181b',
};

interface MembershipMixChartProps {
  data: {
    name: string;
    value: number;
  }[];
}

export default function MembershipMixChart({ data }: MembershipMixChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-400 bg-white">
        No membership data yet
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            innerRadius={52}
            outerRadius={82}
            dataKey="value"
            paddingAngle={3}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={planColors[entry.name] ?? '#f4c430'} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e5ea',
              boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
              fontSize: 12,
            }}
          />
          <Legend iconSize={8} wrapperStyle={{ fontSize: 12, color: '#5e6573' }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
