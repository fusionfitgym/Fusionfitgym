'use client';

import dynamic from 'next/dynamic';
import { ChartSkeleton } from '@/components/ui/Skeleton';

// Dynamically import the charts with ssr: false in this client component wrapper
const RevenueTrendChart = dynamic(() => import('@/components/dashboard/RevenueTrendChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

const MembershipMixChart = dynamic(() => import('@/components/dashboard/MembershipMixChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

interface DashboardChartsSectionProps {
  revenueData: {
    month: string;
    revenue: number;
  }[];
  pieData: {
    name: string;
    value: number;
  }[];
}

export default function DashboardChartsSection({ revenueData, pieData }: DashboardChartsSectionProps) {
  return (
    <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
      {/* Revenue Trend Section */}
      <section className="card min-h-80 p-4 sm:p-6 xl:col-span-2 bg-white">
        <div className="mb-6">
          <h2 className="section-title">Revenue trend</h2>
          <p className="section-description">Paid invoice volume over the last six months</p>
        </div>
        <RevenueTrendChart data={revenueData} />
      </section>

      {/* Membership Mix Section */}
      <section className="card min-h-80 p-4 sm:p-6 bg-white">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="section-title">Membership mix</h2>
            <p className="section-description">Distribution across available plans</p>
          </div>
        </div>
        <MembershipMixChart data={pieData} />
      </section>
    </div>
  );
}
