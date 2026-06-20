'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AttendancePeakChartProps {
  data: {
    hour: string;
    count: number;
  }[];
}

export default function AttendancePeakChart({ data }: AttendancePeakChartProps) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e9edf2" />
          <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8c94a3' }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#8c94a3' }} />
          <Tooltip
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{
              borderRadius: 10,
              border: '1px solid #e2e5ea',
              boxShadow: '0 12px 28px rgba(15,23,42,0.08)',
              fontSize: 12,
            }}
          />
          <Bar dataKey="count" name="Check-ins" fill="#f4c430" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
