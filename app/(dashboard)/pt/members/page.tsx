'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Users, Eye, Edit, Trash2, Dumbbell, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { PageHeader, Card } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTClients, deletePTClient } from '@/lib/actions/pt';
import { PTClient } from '@/types/pt';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTClientsPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [clients, setClients] = useState<PTClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [trainerFilter, setTrainerFilter] = useState('All');

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isReceptionist = profile?.role === 'Receptionist';
  const isTrainer = profile?.role === 'Trainer';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setClients(demo.getPTClients());
      } else {
        const data = await getPTClients();
        setClients(data);
      }
    } catch (err: any) {
      toast.error('Failed to load clients: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptClients]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this PT client registration?')) return;
    try {
      if (isDemo) {
        demo.deletePTClient(id);
        toast.success('Client deleted (Demo)');
      } else {
        const res = await deletePTClient(id);
        if (res.error) throw new Error(res.error);
        toast.success('PT Client deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete client');
    }
  };

  // Filter list
  const filteredClients = clients.filter(c => {
    if (isTrainer) {
      const matchesTrainer = c.trainer?.auth_user_id === profile?.auth_user_id || c.trainer_id === 'rohan-trainer';
      if (!matchesTrainer) return false;
    }

    const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          c.phone.includes(search) || 
                          (c.email && c.email.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus = statusFilter === 'All' ? true : c.status === statusFilter;
    const matchesTrainerSelection = trainerFilter === 'All' ? true : c.trainer_id === trainerFilter;

    return matchesSearch && matchesStatus && matchesTrainerSelection;
  });

  // KPI Metrics Calculation
  const activeClientsCount = clients.filter(c => c.status === 'Active').length;
  const lowSessionsCount = clients.filter(c => c.status === 'Active' && c.sessions_remaining <= 2).length;
  const totalSessionsPurchased = clients.reduce((sum, c) => sum + (Number(c.sessions_purchased) || 0), 0);
  const totalSessionsRemaining = clients.reduce((sum, c) => sum + (Number(c.sessions_remaining) || 0), 0);

  // Unique list of trainers from clients for filtering
  const uniqueTrainers = Array.from(new Map(clients.filter(c => c.trainer).map(c => [c.trainer_id, c.trainer])).values());

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Members"
        subtitle="Manage PT client registrations, package tracking, and active trainer assignments."
        action={
          (isAdmin || isReceptionist) && (
            <Link href="/pt/members/add" className="btn btn-primary shadow-md shadow-amber-200/50">
              <Plus className="h-4 w-4 mr-1" /> Register PT Client
            </Link>
          )
        }
      />

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-md shadow-amber-200/60">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total PT Members</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{clients.length}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-200/60">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Active Clients</p>
            <p className="mt-1 text-2xl font-black text-emerald-600">{activeClientsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 text-white shadow-md shadow-rose-200/60">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Low Sessions (≤ 2)</p>
            <p className="mt-1 text-2xl font-black text-rose-600">{lowSessionsCount}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm flex items-center gap-4 hover:shadow-md transition-all">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200/60">
            <Dumbbell className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Remaining Sessions</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{totalSessionsRemaining} <span className="text-xs font-semibold text-slate-400">/ {totalSessionsPurchased}</span></p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="mb-6 rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-sm">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              className="input-field pl-10 w-full font-medium text-slate-800 placeholder:text-slate-400"
              placeholder="Search client name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider gap-1.5 shrink-0">
              <Filter className="h-3.5 w-3.5 text-amber-500" /> Status:
            </span>
            <select
              className="select-field flex-1 text-slate-800 font-semibold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Expired">Expired</option>
            </select>
          </div>

          {!isTrainer && (
            <div className="flex items-center gap-2">
              <span className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider gap-1.5 shrink-0">
                <Filter className="h-3.5 w-3.5 text-amber-500" /> Trainer:
              </span>
              <select
                className="select-field flex-1 text-slate-800 font-semibold"
                value={trainerFilter}
                onChange={(e) => setTrainerFilter(e.target.value)}
              >
                <option value="All">All Trainers</option>
                {uniqueTrainers.map(t => t && (
                  <option key={t.id} value={t.id}>{t.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex min-h-[350px] items-center justify-center">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-sm">
          <Users className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-4 text-lg font-bold text-slate-800">No PT Members Found</h3>
          <p className="mt-1.5 text-sm text-slate-500">No client registrations match your search or filter criteria.</p>
          {(isAdmin || isReceptionist) && clients.length === 0 && (
            <Link href="/pt/members/add" className="btn btn-primary mt-6">
              Register First PT Client
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 px-4">Client Profile</th>
                  <th className="py-3.5 px-4">Assigned Trainer</th>
                  <th className="py-3.5 px-4">Package</th>
                  <th className="py-3.5 px-4">Sessions Tracker</th>
                  <th className="py-3.5 px-4">Expiry Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.map((client) => {
                  const percentLeft = client.sessions_purchased > 0 
                    ? Math.round((client.sessions_remaining / client.sessions_purchased) * 100)
                    : 0;

                  const isLowSessions = client.sessions_remaining <= 2;
                  const initials = (client.full_name || 'PT').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

                  return (
                    <tr key={client.id} className="hover:bg-amber-50/20 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 font-extrabold text-amber-800 text-xs shadow-inner">
                            {initials}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 leading-snug">{client.full_name}</p>
                            <p className="text-xs font-medium text-slate-500 mt-0.5">{client.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-800">
                            {client.trainer?.full_name || 'Not Assigned'}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-block font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 text-xs">
                          {client.package?.package_name || 'Custom Package'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 min-w-[180px]">
                        <div>
                          <div className="flex justify-between items-baseline mb-1 text-xs">
                            <span className={`font-extrabold ${isLowSessions ? 'text-rose-600' : 'text-slate-800'}`}>
                              {client.sessions_remaining} / {client.sessions_purchased} <span className="font-normal text-slate-500">sessions</span>
                            </span>
                            <span className={`text-[11px] font-bold ${isLowSessions ? 'text-rose-600' : 'text-slate-500'}`}>
                              {percentLeft}%
                            </span>
                          </div>
                          {/* Visual Progress Bar */}
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                isLowSessions
                                  ? 'bg-rose-500'
                                  : percentLeft < 50
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, percentLeft))}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatDate(client.expiry_date)}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border shadow-xs ${
                          client.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : client.status === 'Expired'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Link
                            href={`/pt/members/${client.id}`}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600 transition-colors"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {(isAdmin || isReceptionist) && (
                            <>
                              <Link
                                href={`/pt/members/${client.id}/edit`}
                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600 transition-colors"
                                title="Edit details"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                              {isAdmin && (
                                <button
                                  onClick={() => handleDelete(client.id)}
                                  className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                                  title="Delete client"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
