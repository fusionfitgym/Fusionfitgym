'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Filter, Users, Eye, Edit, Trash2 } from 'lucide-react';
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
    // Role filter: Trainers only view their assigned clients
    if (isTrainer) {
      // In demo mode or production, match trainer's profile full_name or id
      const matchesTrainer = c.trainer?.auth_user_id === profile?.auth_user_id || c.trainer_id === 'rohan-trainer'; // Default rohan to trainer view for demo
      if (!matchesTrainer) return false;
    }

    // Search filter
    const matchesSearch = c.full_name.toLowerCase().includes(search.toLowerCase()) || 
                          c.phone.includes(search) || 
                          (c.email && c.email.toLowerCase().includes(search.toLowerCase()));

    // Status filter
    const matchesStatus = statusFilter === 'All' ? true : c.status === statusFilter;

    // Trainer filter (for Admin / Receptionist)
    const matchesTrainerSelection = trainerFilter === 'All' ? true : c.trainer_id === trainerFilter;

    return matchesSearch && matchesStatus && matchesTrainerSelection;
  });

  // Unique list of trainers from clients for filtering
  const uniqueTrainers = Array.from(new Map(clients.filter(c => c.trainer).map(c => [c.trainer_id, c.trainer])).values());

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Members"
        subtitle="Manage PT client registrations, package tracking, and active trainer assignments."
        action={
          (isAdmin || isReceptionist) && (
            <Link href="/pt/members/add" className="btn btn-primary">
              <Plus className="h-4 w-4" /> Register PT Client
            </Link>
          )
        }
      />

      {/* Filters Card */}
      <Card className="mb-6 p-4 sm:p-5 bg-zinc-950 border border-zinc-800">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="relative">
            <span className="absolute inset-y-0 left-3 flex items-center text-zinc-500">
              <Search className="h-4 w-4" />
            </span>
            <input
              type="text"
              className="input pl-9 w-full"
              placeholder="Search by client name, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            <span className="flex items-center text-sm text-zinc-400 gap-1 shrink-0">
              <Filter className="h-4 w-4" /> Status:
            </span>
            <select
              className="input flex-1"
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
            <div className="flex gap-2">
              <span className="flex items-center text-sm text-zinc-400 gap-1 shrink-0">
                <Filter className="h-4 w-4" /> Trainer:
              </span>
              <select
                className="input flex-1"
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
      </Card>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : filteredClients.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <Users className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-4 text-lg font-bold text-zinc-100">No PT Clients Found</h3>
          <p className="mt-2 text-zinc-400">Add a client registration or modify your filter criteria.</p>
          {(isAdmin || isReceptionist) && clients.length === 0 && (
            <Link href="/pt/members/add" className="btn btn-primary mt-6">
              Register First Client
            </Link>
          )}
        </Card>
      ) : (
        <div className="card overflow-hidden">
          {/* Table view for Desktop */}
          <div className="data-table">
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Assigned Trainer</th>
                  <th>Package Selected</th>
                  <th className="hidden sm:table-cell">Sessions Remaining</th>
                  <th className="hidden md:table-cell">Expiry Date</th>
                  <th>Status</th>
                  <th className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((client) => {
                  const percentLeft = client.sessions_purchased > 0 
                    ? Math.round((client.sessions_remaining / client.sessions_purchased) * 100)
                    : 0;

                  return (
                    <tr key={client.id}>
                      <td>
                        <div>
                          <p className="font-bold text-zinc-100">{client.full_name}</p>
                          <p className="text-xs text-zinc-400 mt-0.5">{client.phone}</p>
                        </div>
                      </td>
                      <td>
                        <p className="text-sm font-semibold text-zinc-300">
                          {client.trainer?.full_name || 'Not Assigned'}
                        </p>
                      </td>
                      <td>
                        <p className="text-sm text-zinc-300">
                          {client.package?.package_name || 'Custom Package'}
                        </p>
                      </td>
                      <td className="hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <span className={`font-bold ${client.sessions_remaining <= 2 ? 'text-red-400' : 'text-zinc-200'}`}>
                            {client.sessions_remaining} / {client.sessions_purchased}
                          </span>
                          <span className="text-[10px] text-zinc-500">({percentLeft}%)</span>
                        </div>
                      </td>
                      <td className="hidden md:table-cell">
                        <p className="text-xs text-zinc-400">{formatDate(client.expiry_date)}</p>
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${client.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : client.status === 'Expired' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                          {client.status}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="inline-flex gap-1">
                          <Link href={`/pt/members/${client.id}`} className="btn btn-ghost btn-sm" title="View Profile">
                            <Eye className="h-4 w-4" />
                          </Link>
                          {(isAdmin || isReceptionist) && (
                            <>
                              <Link href={`/pt/members/${client.id}/edit`} className="btn btn-ghost btn-sm" title="Edit details">
                                <Edit className="h-4 w-4" />
                              </Link>
                              {isAdmin && (
                                <button onClick={() => handleDelete(client.id)} className="btn btn-ghost btn-sm text-red-400 hover:text-red-300" title="Delete client">
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
