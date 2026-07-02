'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, X, HardHat, Award, DollarSign, Wallet, CheckCircle } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTTrainers, createPTTrainer, updatePTTrainer, deletePTTrainer, getPTCommissions, payPTCommission } from '@/lib/actions/pt';
import { PTTrainer, PTCommission } from '@/types/pt';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTTrainersPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [activeTab, setActiveTab] = useState<'trainers' | 'commissions'>('trainers');
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [commissions, setCommissions] = useState<PTCommission[]>([]);
  const [loading, setLoading] = useState(true);

  // Trainer Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<PTTrainer | null>(null);

  // Form values
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [availability, setAvailability] = useState('Mon - Sat');
  const [workingHours, setWorkingHours] = useState('06:00 - 11:00, 17:00 - 21:00');
  const [commissionType, setCommissionType] = useState<'Percentage' | 'Fixed' | 'Per Session' | 'Per Package'>('Percentage');
  const [commissionValue, setCommissionValue] = useState(20);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';
  const isTrainer = profile?.role === 'Trainer';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setTrainers(demo.getPTTrainers());
        setCommissions(demo.getPTCommissions());
      } else {
        const trs = await getPTTrainers();
        const comms = await getPTCommissions();
        setTrainers(trs);
        setCommissions(comms);
      }
    } catch (err: any) {
      toast.error('Failed to load data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptTrainers, demo.ptCommissions]);

  // Open forms
  const openAddModal = () => {
    setEditingTrainer(null);
    setName('');
    setPhone('');
    setEmail('');
    setSpecialization('');
    setAvailability('Mon - Sat');
    setWorkingHours('06:00 - 11:00, 17:00 - 21:00');
    setCommissionType('Percentage');
    setCommissionValue(20);
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (trainer: PTTrainer) => {
    setEditingTrainer(trainer);
    setName(trainer.full_name);
    setPhone(trainer.phone);
    setEmail(trainer.email || '');
    setSpecialization(trainer.specialization || '');
    setAvailability(trainer.availability || '');
    setWorkingHours(trainer.working_hours || '');
    setCommissionType(trainer.commission_type);
    setCommissionValue(trainer.commission_value);
    setStatus(trainer.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) {
      toast.error('Name and Phone are required');
      return;
    }

    const payload = {
      full_name: name,
      phone,
      email: email || undefined,
      specialization: specialization || undefined,
      availability,
      working_hours: workingHours,
      commission_type: commissionType,
      commission_value: Number(commissionValue),
      status
    };

    try {
      if (editingTrainer) {
        if (isDemo) {
          demo.updatePTTrainer(editingTrainer.id, payload);
          toast.success('Trainer updated successfully (Demo)');
        } else {
          const res = await updatePTTrainer(editingTrainer.id, payload);
          if (res.error) throw new Error(res.error);
          toast.success('Trainer updated successfully!');
        }
      } else {
        if (isDemo) {
          demo.createPTTrainer(payload);
          toast.success('Trainer registered successfully (Demo)');
        } else {
          const res = await createPTTrainer(payload);
          if (res.error) throw new Error(res.error);
          toast.success('Trainer registered successfully!');
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save trainer');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trainer?')) return;
    try {
      if (isDemo) {
        demo.deletePTTrainer(id);
        toast.success('Trainer deleted (Demo)');
      } else {
        const res = await deletePTTrainer(id);
        if (res.error) throw new Error(res.error);
        toast.success('Trainer deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete trainer');
    }
  };

  const handleSettleCommission = async (id: string) => {
    if (!confirm('Mark this commission as PAID/SETTLED?')) return;
    try {
      if (isDemo) {
        demo.payPTCommission(id);
        toast.success('Commission settled successfully (Demo)');
      } else {
        const res = await payPTCommission(id);
        if (res.error) throw new Error(res.error);
        toast.success('Commission settled successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to settle commission');
    }
  };

  // Filter commissions if Trainer logs in
  const visibleCommissions = isTrainer
    ? commissions.filter(c => c.trainer?.auth_user_id === profile?.auth_user_id || c.trainer_id === 'rohan-trainer') // Default rohan to trainer view for demo
    : commissions;

  const totalPendingCommission = visibleCommissions
    .filter(c => c.status === 'Pending')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  const totalPaidCommission = visibleCommissions
    .filter(c => c.status === 'Paid')
    .reduce((sum, c) => sum + Number(c.amount), 0);

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Trainers"
        subtitle="Manage personal trainers, working hours, and commission configuration settings."
        action={
          isAdmin && activeTab === 'trainers' && (
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Add PT Trainer
            </button>
          )
        }
      />

      {/* Tabs */}
      <div className="segmented-control mb-6" aria-label="Trainers Tabs">
        <button
          onClick={() => setActiveTab('trainers')}
          className={`segment ${activeTab === 'trainers' && 'segment-active'}`}
        >
          Trainers List
        </button>
        <button
          onClick={() => setActiveTab('commissions')}
          className={`segment ${activeTab === 'commissions' && 'segment-active'}`}
        >
          Commissions Dashboard
        </button>
      </div>

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : activeTab === 'trainers' ? (
        trainers.length === 0 ? (
          <Card className="flex flex-col items-center justify-center p-12 text-center">
            <HardHat className="mx-auto h-12 w-12 text-zinc-400" />
            <h3 className="mt-4 text-lg font-bold text-zinc-100">No PT Trainers Registered</h3>
            <p className="mt-2 text-zinc-400">Register gym trainers here to assign them client packages.</p>
            {isAdmin && (
              <button onClick={openAddModal} className="btn btn-primary mt-6">
                Register First Trainer
              </button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {trainers.map((trainer) => (
              <Card key={trainer.id} className="border border-zinc-800 bg-zinc-950 p-6 flex flex-col justify-between hover:border-zinc-700 transition-all">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-300 font-extrabold text-sm">
                      {trainer.full_name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-md font-bold text-zinc-100">{trainer.full_name}</h3>
                      <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold mt-1 ${trainer.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400'}`}>
                        {trainer.status}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 space-y-2 border-t border-zinc-800/60 pt-4 text-sm text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Specialization:</span>
                      <span className="font-semibold text-zinc-200">{trainer.specialization || 'General Training'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Working Days:</span>
                      <span className="font-semibold text-zinc-200">{trainer.availability}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Hours:</span>
                      <span className="font-semibold text-zinc-200 text-xs">{trainer.working_hours}</span>
                    </div>
                    {!isTrainer && (
                      <div className="flex justify-between">
                        <span className="text-zinc-500">Commission Rate:</span>
                        <span className="font-bold text-amber-300">
                          {trainer.commission_type === 'Percentage' ? `${trainer.commission_value}%` : `₹${trainer.commission_value} (${trainer.commission_type})`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {isAdmin && (
                  <div className="mt-6 flex gap-2 border-t border-zinc-800/80 pt-4">
                    <button onClick={() => openEditModal(trainer)} className="btn btn-secondary btn-sm flex-1">
                      <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                    </button>
                    <button onClick={() => handleDelete(trainer.id)} className="btn btn-secondary btn-sm text-red-400 hover:text-red-300">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )
      ) : (
        // Commissions Dashboard
        <div>
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300 border border-amber-400/20">
                <Wallet className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Pending Payouts</p>
                <p className="mt-1 text-2xl font-black text-amber-300">{formatCurrency(totalPendingCommission)}</p>
              </div>
            </Card>
            <Card className="flex items-center gap-4 p-5 bg-zinc-950 border border-zinc-800">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <CheckCircle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Settled Payouts</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">{formatCurrency(totalPaidCommission)}</p>
              </div>
            </Card>
          </div>

          {/* Commissions Table */}
          {visibleCommissions.length === 0 ? (
            <Card className="p-8 text-center text-zinc-400">No trainer commissions generated yet.</Card>
          ) : (
            <div className="card overflow-hidden">
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Trainer</th>
                      <th>Client</th>
                      <th>Reference</th>
                      <th>Amount</th>
                      <th>Generated Date</th>
                      <th>Status</th>
                      {isAdmin && <th className="text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleCommissions.map((comm) => (
                      <tr key={comm.id}>
                        <td><p className="font-semibold text-zinc-200">{comm.trainer?.full_name}</p></td>
                        <td><p className="text-sm text-zinc-300">{comm.client?.full_name || 'N/A'}</p></td>
                        <td>
                          <span className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">
                            {comm.session_id ? 'PT Session' : comm.invoice_id ? `Invoice: ${comm.invoice?.invoice_number}` : 'Package Sale'}
                          </span>
                        </td>
                        <td><p className="font-bold text-zinc-100">{formatCurrency(comm.amount)}</p></td>
                        <td><p className="text-xs text-zinc-400">{formatDate(comm.commission_date)}</p></td>
                        <td>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${comm.status === 'Paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                            {comm.status}
                          </span>
                        </td>
                        {isAdmin && (
                          <td className="text-right">
                            {comm.status === 'Pending' ? (
                              <button onClick={() => handleSettleCommission(comm.id)} className="btn btn-primary btn-xs">
                                Settle Payout
                              </button>
                            ) : (
                              <span className="text-xs text-zinc-500 font-semibold">{formatDate(comm.paid_date || '')}</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trainer Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-enter">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-zinc-100">
                {editingTrainer ? 'Edit Trainer Profile' : 'Register PT Trainer'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Full Name" required>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Rohan Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Phone Number" required>
                  <input
                    type="tel"
                    className="input w-full"
                    placeholder="10-digit phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </FormField>

                <FormField label="Email Address">
                  <input
                    type="email"
                    className="input w-full"
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </FormField>
              </div>

              <FormField label="Specializations">
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. Weight Loss, Strength training"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Availability">
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. Mon - Sat"
                    value={availability}
                    onChange={(e) => setAvailability(e.target.value)}
                  />
                </FormField>

                <FormField label="Working Hours">
                  <input
                    type="text"
                    className="input w-full"
                    placeholder="e.g. 06:00 - 11:00, 16:00 - 20:00"
                    value={workingHours}
                    onChange={(e) => setWorkingHours(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="border-t border-zinc-800 pt-3">
                <h4 className="text-sm font-semibold text-zinc-400 mb-3">Commission Scheme Config</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Commission Type">
                    <select
                      className="input w-full"
                      value={commissionType}
                      onChange={(e) => setCommissionType(e.target.value as any)}
                    >
                      <option value="Percentage">Percentage (%)</option>
                      <option value="Fixed">Fixed Amount per Month (₹)</option>
                      <option value="Per Session">Rate Per Session (₹)</option>
                      <option value="Per Package">Rate Per Package (₹)</option>
                    </select>
                  </FormField>

                  <FormField label="Rate/Value" required>
                    <input
                      type="number"
                      min="0"
                      className="input w-full"
                      value={commissionValue}
                      onChange={(e) => setCommissionValue(Number(e.target.value))}
                      required
                    />
                  </FormField>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-zinc-800 pt-3">
                <FormField label="Status">
                  <select
                    className="input w-full"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </FormField>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Trainer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
