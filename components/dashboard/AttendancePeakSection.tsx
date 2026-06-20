'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { ChartSkeleton } from '@/components/ui/Skeleton';

// Dynamically import Recharts bar chart
const AttendancePeakChart = dynamic(() => import('@/components/dashboard/AttendancePeakChart'), {
  ssr: false,
  loading: () => <ChartSkeleton />
});

interface AttendancePeakSectionProps {
  hourlyDistribution: {
    hour: string;
    count: number;
  }[];
}

export default function AttendancePeakSection({ hourlyDistribution }: AttendancePeakSectionProps) {
  return (
    <section className="card p-4 sm:p-6 xl:col-span-2 bg-white">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="section-title">Today's attendance peak times</h2>
          <p className="section-description">Gate entry counts grouped per hour</p>
        </div>
        <Link href="/attendance" className="btn btn-ghost btn-sm">
          View live logs <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <AttendancePeakChart data={hourlyDistribution} />
    </section>
  );
}
