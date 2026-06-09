'use client';

import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Edit, Trash2, Phone, Mail, MapPin, Calendar, AlertCircle, UserCircle, HeartPulse, ClipboardList, FileText, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { getMemberById, deleteMember } from '@/lib/actions/members';
import { getHealthByMember } from '@/lib/actions/health';
import { getParqByMember } from '@/lib/actions/parq';
import { getInvoicesByMember } from '@/lib/actions/invoices';
import { Member, HealthAssessment, ParqResponse, Invoice } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Card, LoadingSpinner } from '@/components/ui/Primitives';
import { formatDate, formatCurrency, calculateAge, getMembershipExpiry } from '@/lib/utils';

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [assessments, setAssessments] = useState<HealthAssessment[]>([]);
  const [parqs, setParqs] = useState<ParqResponse[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([
      getMemberById(id),
      getHealthByMember(id),
      getParqByMember(id),
      getInvoicesByMember(id),
    ]).then(([m, h, p, i]) => {
      setMember(m);
      setAssessments(h);
      setParqs(p);
      setInvoices(i);
    }).finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    if (!confirm(`Delete member "${member?.full_name}"? This action cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteMember(id);
      router.push('/members');
    } catch {
      alert('Failed to delete member.');
      setDeleting(false);
    }
  }

  if (loading) return <LoadingSpinner size={40} />;
  if (!member) return <div className="text-gray-500 text-center py-16">Member not found.</div>;

  const age = calculateAge(member.dob);
  const expiry = getMembershipExpiry(member.join_date, member.membership_plan);
  const latestAssessment = assessments[0];

  return (
    <div className="page-enter max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/members" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-4 h-4 text-gray-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{member.full_name}</h1>
          <p className="text-sm text-gray-400">Member since {formatDate(member.join_date)}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/members/${id}/edit`} className="btn-yellow text-sm">
            <Edit className="w-4 h-4" /> Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium flex items-center gap-1.5 transition-colors"
          >
            {deleting ? <Loader2 className="w-4 h-4 spin" /> : <Trash2 className="w-4 h-4" />}
            Delete
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <div className="flex flex-col items-center text-center">
              {member.profile_photo ? (
                <img src={member.profile_photo} alt={member.full_name} className="w-24 h-24 rounded-full object-cover mb-3" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-yellow-50 flex items-center justify-center mb-3">
                  <UserCircle className="w-12 h-12 text-[#FFD700]" />
                </div>
              )}
              <h2 className="font-bold text-gray-900 text-lg">{member.full_name}</h2>
              {age && <p className="text-xs text-gray-400">{age} years old</p>}
              <div className="mt-2"><StatusBadge variant={member.status} /></div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
              {[
                { icon: Phone,    value: member.phone,   label: 'Phone'   },
                { icon: Mail,     value: member.email,   label: 'Email'   },
                { icon: MapPin,   value: member.address, label: 'Address' },
                { icon: AlertCircle, value: member.emergency_contact, label: 'Emergency' },
              ].map(({ icon: Icon, value, label }) => value ? (
                <div key={label} className="flex items-start gap-2.5">
                  <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-sm text-gray-700">{value}</p>
                  </div>
                </div>
              ) : null)}
            </div>
          </Card>

          {/* Membership */}
          <div className="rounded-2xl p-4 text-black" style={{ background: 'var(--gym-yellow)' }}>
            <p className="text-xs font-semibold text-black/70 mb-1">Membership Plan</p>
            <p className="text-xl font-bold">{member.membership_plan}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Calendar className="w-3.5 h-3.5 text-black/60" />
              <p className="text-xs text-black/70">Expires {formatDate(expiry)}</p>
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-2 space-y-4">
          {/* Latest Assessment */}
          {latestAssessment && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <HeartPulse className="w-4 h-4 text-[#FFD700]" /> Latest Assessment
                </h3>
                <span className="text-xs text-gray-400">{formatDate(latestAssessment.created_at)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Height', value: latestAssessment.height ? `${latestAssessment.height} cm` : '—' },
                  { label: 'Weight', value: latestAssessment.weight ? `${latestAssessment.weight} kg` : '—' },
                  { label: 'BMI',    value: latestAssessment.bmi    ? String(latestAssessment.bmi)         : '—' },
                  { label: 'Body Fat', value: latestAssessment.body_fat ? `${latestAssessment.body_fat}%` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <p className="font-bold text-gray-900">{value}</p>
                  </div>
                ))}
              </div>
              <Link href={`/health/${latestAssessment.id}`} className="mt-3 text-xs font-semibold text-[#E6C200] hover:underline inline-block">
                View all assessments →
              </Link>
            </Card>
          )}

          {/* PAR-Q History */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-[#FFD700]" /> PAR-Q Forms ({parqs.length})
              </h3>
              <Link href={`/parq/new?member=${id}`} className="text-xs btn-yellow py-1 px-2">+ New</Link>
            </div>
            {parqs.length === 0 ? (
              <p className="text-sm text-gray-400">No PAR-Q forms submitted yet.</p>
            ) : (
              <div className="space-y-2">
                {parqs.slice(0, 3).map(p => (
                  <Link key={p.id} href={`/parq/${p.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <span className="text-sm text-gray-700">PAR-Q Assessment</span>
                    <span className="text-xs text-gray-400">{formatDate(p.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </Card>

          {/* Invoices */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#FFD700]" /> Invoices ({invoices.length})
              </h3>
              <Link href={`/invoices/new?member=${id}`} className="text-xs btn-yellow py-1 px-2">+ New</Link>
            </div>
            {invoices.length === 0 ? (
              <p className="text-sm text-gray-400">No invoices generated yet.</p>
            ) : (
              <div className="space-y-2">
                {invoices.slice(0, 4).map(inv => (
                  <Link key={inv.id} href={`/invoices/${inv.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{inv.invoice_number}</p>
                      <p className="text-xs text-gray-400">Due {formatDate(inv.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{formatCurrency(inv.amount)}</span>
                      <StatusBadge variant={inv.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
