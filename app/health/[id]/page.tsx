'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, User } from 'lucide-react';
import { getHealthById } from '@/lib/actions/health';
import { HealthAssessment } from '@/types';
import { Card, LoadingSpinner } from '@/components/ui/Primitives';
import { formatDate, getBMICategory } from '@/lib/utils';

function BMIGauge({ bmi }: { bmi: number }) {
  const { label, color } = getBMICategory(bmi);
  const percent = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
  const angle = (percent / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-24 overflow-hidden">
        <div className="absolute inset-0 rounded-t-full" style={{ background: 'conic-gradient(from 180deg, #60a5fa 0deg, #4ade80 36deg, #fb923c 72deg, #f87171 108deg, #f87171 180deg)' }} />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-16 bg-white rounded-t-full" />
        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 origin-bottom w-0.5 bg-gray-800 rounded-full"
          style={{ height: 52, transform: `translateX(-50%) rotate(${angle}deg)`, transformOrigin: 'bottom center' }}
        />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gray-800" />
      </div>
      <p className="text-2xl font-bold mt-2" style={{ color }}>{bmi}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
    </div>
  );
}

export default function HealthDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assessment, setAssessment] = useState<HealthAssessment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getHealthById(id).then(setAssessment).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner size={36} />;
  if (!assessment) return <div className="text-gray-500 text-center py-16">Assessment not found.</div>;

  const member = assessment.member as { full_name: string } | undefined;

  return (
    <div className="page-enter max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/health" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Assessment</h1>
          <p className="text-sm text-gray-400">{formatDate(assessment.created_at)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Member */}
        <Card>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
              <User className="w-5 h-5 text-[#FFD700]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{member?.full_name ?? 'Unknown Member'}</p>
              <p className="text-xs text-gray-400">Assessed on {formatDate(assessment.created_at)}</p>
            </div>
          </div>
        </Card>

        {/* Metrics */}
        <Card>
          <h3 className="font-semibold text-gray-900 mb-4">Body Metrics</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Height', value: assessment.height ? `${assessment.height} cm` : '—' },
              { label: 'Weight', value: assessment.weight ? `${assessment.weight} kg` : '—' },
              { label: 'Body Fat', value: assessment.body_fat ? `${assessment.body_fat}%` : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                <p className="text-lg font-bold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          {/* BMI Gauge */}
          {assessment.bmi && (
            <div className="border-t border-gray-50 pt-4">
              <p className="text-xs font-semibold text-gray-500 text-center mb-2">BMI Index</p>
              <BMIGauge bmi={assessment.bmi} />
            </div>
          )}
        </Card>

        {/* Medical Info */}
        {(assessment.injuries || assessment.medical_conditions || assessment.notes) && (
          <Card>
            <h3 className="font-semibold text-gray-900 mb-4">Medical Information</h3>
            <div className="space-y-3">
              {assessment.injuries && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Injury History</p>
                  <p className="text-sm text-gray-700">{assessment.injuries}</p>
                </div>
              )}
              {assessment.medical_conditions && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Medical Conditions</p>
                  <p className="text-sm text-gray-700">{assessment.medical_conditions}</p>
                </div>
              )}
              {assessment.notes && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{assessment.notes}</p>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
