'use client';

import { useEffect, useState } from 'react';
import { Cpu, Edit, Trash2, Plus, Wifi, WifiOff, Terminal, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/Primitives';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { getDevices, createDevice, updateDevice, deleteDevice } from '@/lib/actions/devices';
import { BiometricDevice } from '@/types';
import { cn } from '@/lib/utils';

export default function DevicesPage() {
  const [devices, setDevices] = useState<BiometricDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [status, setStatus] = useState<'Online' | 'Offline'>('Online');

  const fetchDevicesData = () => {
    setLoading(true);
    getDevices()
      .then(setDevices)
      .catch((err) => console.error('Failed to load devices:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevicesData();
  }, []);

  const handleOpenAdd = () => {
    setName('');
    setSerialNumber('');
    setIpAddress('');
    setStatus('Online');
    setEditingId(null);
    setFormError(null);
    setShowForm(true);
  };

  const handleOpenEdit = (device: BiometricDevice) => {
    setName(device.name);
    setSerialNumber(device.serial_number);
    setIpAddress(device.ip_address || '');
    setStatus(device.status);
    setEditingId(device.id);
    setFormError(null);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError('Device Name is required');
      return;
    }
    if (!serialNumber.trim()) {
      setFormError('Device Serial Number is required');
      return;
    }

    try {
      if (editingId) {
        const res = await updateDevice(editingId, {
          name,
          serial_number: serialNumber,
          ip_address: ipAddress || null,
          status,
        });
        if (res.error) throw new Error(res.error);
      } else {
        const res = await createDevice({
          name,
          serial_number: serialNumber,
          ip_address: ipAddress || null,
          status,
        });
        if (res.error) throw new Error(res.error);
      }
      
      handleCloseForm();
      fetchDevicesData();
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the device.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDevice(id);
      fetchDevicesData();
    } catch (err) {
      console.error('Failed to delete device:', err);
      window.alert('Failed to delete device.');
    }
  };

  return (
    <div className="page page-enter">
      <PageHeader
        title="Device Management"
        subtitle="Configure, monitor, and audit ZKTeco/eSSL biometrics hardware readers connected to Fusion Fit."
        action={
          <button onClick={handleOpenAdd} className="btn btn-primary cursor-pointer">
            <Plus className="h-4 w-4" /> Add Device
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left Side: Devices List */}
        <div className="page-stack">
          {loading ? (
            <div className="card p-12 text-center text-slate-400">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="card p-12 text-center text-slate-400">
              <Cpu className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="font-semibold text-slate-700">No biometric devices found</p>
              <p className="text-xs text-slate-500 mt-1">Add a device to start tracking sync activity.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {devices.map((device) => {
                const isOnline = device.status === 'Online';
                return (
                  <div key={device.id} className="card p-5 flex flex-col justify-between border-slate-200">
                    <div>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl",
                            isOnline ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                          )}>
                            <Cpu className="h-5 w-5" />
                          </span>
                          <div>
                            <h3 className="font-bold text-slate-900 leading-snug">{device.name}</h3>
                            <span className="font-mono text-[10px] text-slate-500">{device.serial_number}</span>
                          </div>
                        </div>
                        <span className={cn(
                          "badge flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border",
                          isOnline 
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        )}>
                          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                          {device.status}
                        </span>
                      </div>

                      <div className="mt-4 space-y-2 border-t border-slate-100 pt-3 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">IP Address:</span>
                          <span className="font-mono font-semibold text-slate-800">{device.ip_address || '—'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Last Sync:</span>
                          <span className="font-medium text-slate-800">
                            {device.last_sync ? new Date(device.last_sync).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button 
                        onClick={() => handleOpenEdit(device)} 
                        className="btn btn-secondary btn-sm flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" strokeWidth={2} /> Edit
                      </button>
                      <ConfirmDialog
                        title="Delete Device?"
                        description={`Are you sure you want to delete ${device.name}? Members synced via this device serial number will no longer map here.`}
                        onConfirm={() => handleDelete(device.id)}
                        trigger={
                          <button className="btn btn-danger btn-sm flex items-center gap-1.5 cursor-pointer">
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Add / Edit Form Card */}
        <div>
          {showForm ? (
            <div className="card p-5 border-amber-200 bg-amber-50/10">
              <h3 className="text-sm font-bold text-slate-950 mb-4">
                {editingId ? 'Edit Device' : 'Add New Device'}
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="device-name" className="text-xs font-bold text-slate-700 block mb-1">
                    Device Name
                  </label>
                  <input
                    id="device-name"
                    type="text"
                    placeholder="e.g. Gents Entry"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="device-serial" className="text-xs font-bold text-slate-700 block mb-1">
                    Device Serial Number
                  </label>
                  <input
                    id="device-serial"
                    type="text"
                    placeholder="e.g. NFZ8244803860"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="device-ip" className="text-xs font-bold text-slate-700 block mb-1">
                    IP Address (Optional)
                  </label>
                  <input
                    id="device-ip"
                    type="text"
                    placeholder="e.g. 192.168.1.201"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    className="input-field font-mono"
                  />
                </div>

                <div>
                  <label htmlFor="device-status" className="text-xs font-bold text-slate-700 block mb-1">
                    Status
                  </label>
                  <select
                    id="device-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Online' | 'Offline')}
                    className="select-field"
                  >
                    <option value="Online">Online</option>
                    <option value="Offline">Offline</option>
                  </select>
                </div>

                {formError && (
                  <p className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-100 p-2 rounded-lg">
                    {formError}
                  </p>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="submit" className="btn btn-primary btn-sm flex-1 cursor-pointer">
                    Save Device
                  </button>
                  <button type="button" onClick={handleCloseForm} className="btn btn-secondary btn-sm cursor-pointer">
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <div className="card p-5 text-center bg-slate-50/50 border-slate-200">
              <Terminal className="h-8 w-8 text-slate-400 mx-auto mb-3" />
              <h4 className="text-xs font-bold text-slate-700">Hardware Integration</h4>
              <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
                Biometric machines stream punch logs automatically using push protocols (ADMS). Ensure device serial numbers match the logs exactly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
