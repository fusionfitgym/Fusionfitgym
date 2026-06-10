'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Calendar,
  ClipboardList,
  Edit,
  FileText,
  HeartPulse,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Breadcrumb,
  Card,
  LoadingSpinner,
  PageHeader,
  SectionCard,
} from '@/components/ui/Primitives';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { deleteMember, getMemberById } from '@/lib/actions/members';
import { getHealthByMember } from '@/lib/actions/health';
import { getParqByMember } from '@/lib/actions/parq';
import { getInvoicesByMember } from '@/lib/actions/invoices';
import { HealthAssessment, Invoice, Member, ParqResponse } from '@/types';
import {
  calculateAge,
  formatCurrency,
  formatDate,
  getMembershipExpiry,
} from '@/lib/utils';

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
    ])
      .then(([memberData, healthData, parqData, invoiceData]) => {
        setMember(memberData);
        setAssessments(healthData);
        setParqs(parqData);
        setInvoices(invoiceData);
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteMember(id);
      router.push('/members');
    } catch {
      window.alert('Failed to delete member.');
      setDeleting(false);
    }
  }

  if (loading) return <LoadingSpinner size={40} />;
  if (!member) return <div className="empty-state"><p className="card-title">Member not found</p></div>;

  const age = calculateAge(member.dob);
  const expiry = getMembershipExpiry(member.join_date, member.membership_plan);
  const latestAssessment = assessments[0];

  return (
    <div className="page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Members', href: '/members' },
          { label: member.full_name },
        ]}
      />
      <PageHeader
        title={member.full_name}
        subtitle={`Member since ${formatDate(member.join_date)}`}
        action={
          <>
            <Link href={`/members/${id}/edit`} className="btn btn-primary">
              <Edit className="h-4 w-4" /> Edit member
            </Link>
            <ConfirmDialog
              title="Delete member?"
              description={`This will permanently delete ${member.full_name} and cannot be undone.`}
              onConfirm={() => void handleDelete()}
              trigger={
                <button type="button" className="btn btn-danger" disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete
                </button>
              }
            />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="page-stack">
          <Card>
            <div className="flex flex-col items-center text-center">
              <Avatar src={member.profile_photo} name={member.full_name} size="xl" />
              <h2 className="mt-4 text-lg font-bold tracking-tight text-slate-950">{member.full_name}</h2>
              {age !== null && <p className="mt-1 text-xs text-slate-500">{age} years old</p>}
              <div className="mt-3"><StatusBadge variant={member.status} /></div>
            </div>

            <div className="mt-6 border-t border-slate-200 pt-4">
              <div className="space-y-4">
                {[
                  { icon: Phone, value: member.phone, label: 'Phone' },
                  { icon: Mail, value: member.email, label: 'Email' },
                  { icon: MapPin, value: member.address, label: 'Address' },
                  { icon: AlertCircle, value: member.emergency_contact, label: 'Emergency contact' },
                ].map(({ icon: Icon, value, label }) => value ? (
                  <div key={label} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="metric-label">{label}</p>
                      <p className="mt-1 break-words text-sm font-medium text-slate-800">{value}</p>
                    </div>
                  </div>
                ) : null)}
              </div>
            </div>
          </Card>

          <div className="rounded-2xl border border-amber-300 bg-amber-300 p-5 text-zinc-950 shadow-[0_12px_30px_rgba(196,145,2,0.16)]">
            <p className="text-xs font-semibold text-black/55">Membership plan</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">{member.membership_plan}</p>
            <div className="mt-4 flex items-center gap-2 border-t border-black/10 pt-3">
              <Calendar className="h-4 w-4 text-black/55" />
              <p className="text-xs font-medium text-black/65">Expires {formatDate(expiry)}</p>
            </div>
          </div>
        </div>

        <div className="page-stack">
          <SectionCard
            title="Latest assessment"
            description={latestAssessment ? `Recorded ${formatDate(latestAssessment.created_at)}` : 'No health assessment has been recorded yet.'}
            icon={<HeartPulse className="h-5 w-5" />}
            action={
              latestAssessment ? (
                <Link href={`/health/${latestAssessment.id}`} className="btn btn-ghost btn-sm">View details</Link>
              ) : (
                <Link href={`/health/new?member=${id}`} className="btn btn-secondary btn-sm">
                  <Plus className="h-3.5 w-3.5" /> Add
                </Link>
              )
            }
          >
            {latestAssessment ? (
              <div className="metric-grid">
                {[
                  { label: 'Height', value: latestAssessment.height ? `${latestAssessment.height} cm` : '-' },
                  { label: 'Weight', value: latestAssessment.weight ? `${latestAssessment.weight} kg` : '-' },
                  { label: 'BMI', value: latestAssessment.bmi ? String(latestAssessment.bmi) : '-' },
                  { label: 'Body fat', value: latestAssessment.body_fat ? `${latestAssessment.body_fat}%` : '-' },
                ].map(({ label, value }) => (
                  <div key={label} className="metric-tile">
                    <p className="metric-label">{label}</p>
                    <p className="metric-value">{value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="body-text">Create an assessment to start tracking body metrics and health notes.</p>
            )}
          </SectionCard>

          <SectionCard
            title={`PAR-Q forms (${parqs.length})`}
            description="Physical activity readiness and risk screening history."
            icon={<ClipboardList className="h-5 w-5" />}
            action={
              <Link href={`/parq/new?member=${id}`} className="btn btn-secondary btn-sm">
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
            }
          >
            {parqs.length === 0 ? (
              <p className="body-text">No PAR-Q forms have been submitted.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {parqs.slice(0, 4).map((parq) => (
                  <Link
                    key={parq.id}
                    href={`/parq/${parq.id}`}
                    className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm font-semibold text-slate-800">PAR-Q assessment</span>
                    <span className="shrink-0 text-xs text-slate-500">{formatDate(parq.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title={`Invoices (${invoices.length})`}
            description="Recent charges and payment status."
            icon={<FileText className="h-5 w-5" />}
            action={
              <Link href={`/invoices/new?member=${id}`} className="btn btn-secondary btn-sm">
                <Plus className="h-3.5 w-3.5" /> New
              </Link>
            }
          >
            {invoices.length === 0 ? (
              <p className="body-text">No invoices have been generated.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {invoices.slice(0, 4).map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/invoices/${invoice.id}`}
                    className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{invoice.invoice_number}</p>
                      <p className="mt-1 text-xs text-slate-500">Due {formatDate(invoice.due_date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(invoice.amount)}</span>
                      <StatusBadge variant={invoice.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
