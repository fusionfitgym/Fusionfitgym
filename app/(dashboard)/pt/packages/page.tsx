'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit, Check, X, ClipboardList } from 'lucide-react';
import { PageHeader, Card, FormField } from '@/components/ui/Primitives';
import { useAuth } from '@/components/auth/AuthProvider';
import { useDemoState } from '@/components/auth/DemoStateProvider';
import { getPTPackages, createPTPackage, updatePTPackage, deletePTPackage, getPTTrainers } from '@/lib/actions/pt';
import { PTPackage, PTTrainer } from '@/types/pt';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';

export default function PTPackagesPage() {
  const { profile } = useAuth();
  const isDemo = profile?.email === 'demo@redix.media';
  const demo = useDemoState();

  const [packages, setPackages] = useState<PTPackage[]>([]);
  const [trainers, setTrainers] = useState<PTTrainer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<PTPackage | null>(null);
  
  // Form values
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [trainerId, setTrainerId] = useState<string>('');
  const [sessions, setSessions] = useState(12);
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState(5000);
  const [discount, setDiscount] = useState(0);
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');

  const isAdmin = profile?.role === 'Super Admin' || profile?.role === 'Admin';

  const loadData = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        setPackages(demo.getPTPackages());
        setTrainers(demo.getPTTrainers());
      } else {
        const pkgs = await getPTPackages();
        const trs = await getPTTrainers();
        setPackages(pkgs);
        setTrainers(trs);
      }
    } catch (err: any) {
      toast.error('Failed to load packages: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isDemo, demo.ptPackages, demo.ptTrainers]);

  const openAddModal = () => {
    setEditingPackage(null);
    setName('');
    setDescription('');
    setTrainerId('');
    setSessions(12);
    setDuration(30);
    setPrice(5000);
    setDiscount(0);
    setStatus('Active');
    setIsModalOpen(true);
  };

  const openEditModal = (pkg: PTPackage) => {
    setEditingPackage(pkg);
    setName(pkg.package_name);
    setDescription(pkg.description || '');
    setTrainerId(pkg.trainer_id || '');
    setSessions(pkg.number_of_sessions);
    setDuration(pkg.duration);
    setPrice(pkg.price);
    setDiscount(pkg.discount);
    setStatus(pkg.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) {
      toast.error('Package Name is required');
      return;
    }

    const finalPrice = Math.max(0, price - discount);
    const payload = {
      package_name: name,
      description: description || undefined,
      trainer_id: trainerId || undefined,
      number_of_sessions: Number(sessions),
      duration: Number(duration),
      price: Number(price),
      discount: Number(discount),
      final_price: finalPrice,
      status
    };

    try {
      if (editingPackage) {
        if (isDemo) {
          demo.updatePTPackage(editingPackage.id, payload);
          toast.success('Package updated successfully (Demo)');
        } else {
          const res = await updatePTPackage(editingPackage.id, payload);
          if (res.error) throw new Error(res.error);
          toast.success('Package updated successfully!');
        }
      } else {
        if (isDemo) {
          demo.createPTPackage(payload);
          toast.success('Package created successfully (Demo)');
        } else {
          const res = await createPTPackage(payload);
          if (res.error) throw new Error(res.error);
          toast.success('Package created successfully!');
        }
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save package');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this package?')) return;
    try {
      if (isDemo) {
        demo.deletePTPackage(id);
        toast.success('Package deleted successfully (Demo)');
      } else {
        const res = await deletePTPackage(id);
        if (res.error) throw new Error(res.error);
        toast.success('Package deleted successfully!');
      }
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete package');
    }
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Personal Training Packages"
        subtitle="Manage personal training structures, pricing models, and duration caps."
        action={
          isAdmin && (
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus className="h-4 w-4" /> Add PT Package
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex min-h-[400px] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
        </div>
      ) : packages.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <ClipboardList className="mx-auto h-12 w-12 text-zinc-400" />
          <h3 className="mt-4 text-lg font-bold text-zinc-100">No Packages Created Yet</h3>
          <p className="mt-2 text-zinc-400">Add a packages layout (e.g. 12 sessions, weight loss) to register clients.</p>
          {isAdmin && (
            <button onClick={openAddModal} className="btn btn-primary mt-6">
              <Plus className="h-4 w-4" /> Create first package
            </button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => {
            const finalPrice = Math.max(0, pkg.price - pkg.discount);
            const assignedTrainer = pkg.trainer_id 
              ? (trainers.find(t => t.id === pkg.trainer_id)?.full_name || 'Assigned Trainer')
              : 'Any Trainer';

            return (
              <Card key={pkg.id} className="relative flex flex-col justify-between overflow-hidden border border-zinc-800 bg-zinc-950 p-6 transition-all hover:border-zinc-700">
                <div>
                  <div className="flex items-start justify-between">
                    <h3 className="text-lg font-bold text-zinc-100">{pkg.package_name}</h3>
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${pkg.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border border-zinc-700'}`}>
                      {pkg.status}
                    </span>
                  </div>
                  
                  <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{pkg.description || 'No description provided.'}</p>
                  
                  <div className="mt-6 space-y-2 border-t border-zinc-800/60 pt-4 text-sm text-zinc-300">
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Trainer Assigned:</span>
                      <span className="font-semibold text-zinc-200">{assignedTrainer}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Sessions Count:</span>
                      <span className="font-semibold text-zinc-200">{pkg.number_of_sessions} Sessions</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Duration Limit:</span>
                      <span className="font-semibold text-zinc-200">{pkg.duration} Days</span>
                    </div>
                  </div>
                </div>

                <div className="mt-8 border-t border-zinc-800/80 pt-4">
                  <div className="flex items-baseline justify-between mb-4">
                    <span className="text-zinc-500 text-sm">Final Price:</span>
                    <div className="text-right">
                      {pkg.discount > 0 && (
                        <p className="text-xs text-zinc-500 line-through">{formatCurrency(pkg.price)}</p>
                      )}
                      <p className="text-2xl font-black text-amber-300">{formatCurrency(finalPrice)}</p>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2">
                      <button onClick={() => openEditModal(pkg)} className="btn btn-secondary btn-sm flex-1">
                        <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                      </button>
                      <button onClick={() => handleDelete(pkg.id)} className="btn btn-secondary btn-sm text-red-400 hover:text-red-300">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal Layout */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl animate-enter">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-lg font-bold text-zinc-100">
                {editingPackage ? 'Edit PT Package' : 'Create PT Package'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-zinc-400 hover:text-zinc-200">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <FormField label="Package Name" required>
                <input
                  type="text"
                  className="input w-full"
                  placeholder="e.g. 12 Sessions Pack"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  className="input w-full min-h-[60px]"
                  placeholder="Details of what training is offered"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Trainer Assigned">
                  <select
                    className="input w-full"
                    value={trainerId}
                    onChange={(e) => setTrainerId(e.target.value)}
                  >
                    <option value="">Any Trainer</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.id}>{t.full_name}</option>
                    ))}
                  </select>
                </FormField>

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

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Number of Sessions" required>
                  <input
                    type="number"
                    min="1"
                    className="input w-full"
                    value={sessions}
                    onChange={(e) => setSessions(Number(e.target.value))}
                    required
                  />
                </FormField>

                <FormField label="Duration (Days)" required>
                  <input
                    type="number"
                    min="1"
                    className="input w-full"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Base Price (₹)" required>
                  <input
                    type="number"
                    min="0"
                    className="input w-full"
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    required
                  />
                </FormField>

                <FormField label="Discount (₹)">
                  <input
                    type="number"
                    min="0"
                    className="input w-full"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </FormField>
              </div>

              <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-3 mt-4 flex items-center justify-between">
                <span className="text-sm text-zinc-400">Total Price Calculated:</span>
                <span className="text-xl font-black text-amber-300">
                  {formatCurrency(Math.max(0, price - discount))}
                </span>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
