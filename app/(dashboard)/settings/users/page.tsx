'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Key,
  Shield,
  Trash2,
  UserCheck,
  UserX,
  History,
  Lock,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { PageHeader, SectionCard, FormField } from '@/components/ui/Primitives';
import {
  listProfiles,
  adminCreateUser,
  adminToggleUserDisabled,
  adminResetUserPassword,
  adminDeleteUser,
  listAuditLogs,
} from '@/lib/actions/users';
import { useAuth } from '@/components/auth/AuthProvider';

export default function UserManagementPage() {
  const { profile: loggedInProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [profiles, setProfiles] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Trainer');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const users = await listProfiles();
      setProfiles(users);
      const logs = await listAuditLogs();
      setAuditLogs(logs);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to load user administration data. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName || !role) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await adminCreateUser({ email, password: password || undefined, fullName, role });
      setSuccess(`User ${email} created successfully.`);
      setShowAddModal(false);
      // Reset form
      setEmail('');
      setFullName('');
      setRole('Trainer');
      setPassword('');
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create user. Verify service role configuration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleDisabled = async (user: any) => {
    if (user.auth_user_id === loggedInProfile?.auth_user_id) {
      setError('You cannot disable your own administrator account.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const targetState = !user.disabled;
      await adminToggleUserDisabled(user.id, targetState, user.email);
      setSuccess(`Account ${user.email} has been ${targetState ? 'disabled' : 'enabled'}.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account status.');
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword || newPassword.length < 6) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      await adminResetUserPassword(selectedUser.auth_user_id, newPassword, selectedUser.email);
      setSuccess(`Password for ${selectedUser.email} has been reset successfully.`);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: any) => {
    if (user.auth_user_id === loggedInProfile?.auth_user_id) {
      setError('You cannot delete your own administrator account.');
      return;
    }

    if (!confirm(`Are you absolutely sure you want to delete user ${user.email}? This action is irreversible.`)) {
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await adminDeleteUser(user.auth_user_id, user.email);
      setSuccess(`User ${user.email} has been permanently deleted.`);
      await loadData();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete user.');
      setLoading(false);
    }
  };

  return (
    <div className="page page-wide page-enter">
      <PageHeader
        title="User Management"
        subtitle="Manage administrative accounts, roles, access statuses, and review security logs."
        action={
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary">
            <UserPlus className="h-4 w-4" /> Add administrator
          </button>
        }
      />

      {/* Setup notification banner if service role key might be missing */}
      {error && error.includes('SUPABASE_SERVICE_ROLE_KEY') && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/10 p-5 text-sm text-amber-800 dark:text-amber-300">
          <h3 className="font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Environment Configuration Missing
          </h3>
          <p className="mt-2 leading-relaxed text-xs">
            User administration requires the <strong>SUPABASE_SERVICE_ROLE_KEY</strong> key in your server settings to access the Auth Admin interface. Please append it to your <code>.env.local</code> file in the project root:
          </p>
          <pre className="mt-3 bg-zinc-950 p-3 rounded-lg text-amber-200 text-xs font-mono select-all">
            SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
          </pre>
        </div>
      )}

      {/* Tabs */}
      <div className="segmented-control mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`segment flex items-center gap-2 ${activeTab === 'users' ? 'segment-active' : ''}`}
        >
          <Users className="h-4 w-4" /> Users List
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`segment flex items-center gap-2 ${activeTab === 'audit' ? 'segment-active' : ''}`}
        >
          <History className="h-4 w-4" /> System Audit Trail
        </button>
      </div>

      {/* Success alert */}
      {success && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Alert (non-config) */}
      {error && !error.includes('SUPABASE_SERVICE_ROLE_KEY') && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-700 dark:text-red-400 font-semibold">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          {activeTab === 'users' && (
            <SectionCard
              title="Administrator Accounts"
              description="Listing users authorized to access the FusionFit ERP system based on assigned roles."
              icon={<Shield className="h-5 w-5" />}
            >
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email Address</th>
                      <th>System Role</th>
                      <th>Account Status</th>
                      <th>Created</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((user) => (
                      <tr key={user.id} className={user.disabled ? 'opacity-60 bg-slate-50/50' : ''}>
                        <td className="table-primary">{user.full_name || '—'}</td>
                        <td className="font-medium text-slate-600">{user.email}</td>
                        <td>
                          <span
                            className={`badge text-[10px] font-black uppercase ${
                              user.role === 'Super Admin'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : user.role === 'Admin'
                                ? 'bg-orange-100 text-orange-800'
                                : user.role === 'Receptionist'
                                ? 'bg-teal-100 text-teal-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${user.disabled ? 'badge-inactive' : 'badge-active'}`}>
                            {user.disabled ? 'Disabled' : 'Active'}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500">{new Date(user.created_at).toLocaleDateString()}</td>
                        <td className="table-actions">
                          {/* Reset Password */}
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowResetModal(true);
                            }}
                            title="Reset password"
                            className="table-action"
                          >
                            <Key className="h-4 w-4" />
                          </button>

                          {/* Enable/Disable Toggle */}
                          <button
                            onClick={() => handleToggleDisabled(user)}
                            title={user.disabled ? 'Enable Account' : 'Disable Account'}
                            className={`table-action ${user.disabled ? 'text-emerald-600' : 'text-slate-500 hover:text-amber-600'}`}
                            disabled={user.auth_user_id === loggedInProfile?.auth_user_id}
                          >
                            {user.disabled ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                          </button>

                          {/* Delete Account */}
                          <button
                            onClick={() => handleDeleteUser(user)}
                            title="Delete Account"
                            className="table-action table-action-danger text-red-500"
                            disabled={user.auth_user_id === loggedInProfile?.auth_user_id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {profiles.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400">
                          No administrator accounts found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {activeTab === 'audit' && (
            <SectionCard
              title="System Audit Logs"
              description="A chronological record of system modifications, logins, and settings changes. Logs are immutable."
              icon={<History className="h-5 w-5" />}
            >
              <div className="data-table">
                <table>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Operator</th>
                      <th>Module</th>
                      <th>Action Performed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      // Resolve operator name from cached user profile relations
                      const operatorName = log.user_profiles?.full_name || log.user_profiles?.email || 'System / Guest';
                      return (
                        <tr key={log.id}>
                          <td className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                            {new Date(log.created_at).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </td>
                          <td className="table-primary">{operatorName}</td>
                          <td>
                            <span className="badge badge-frozen text-[10px] uppercase font-bold">{log.module}</span>
                          </td>
                          <td className="font-semibold text-slate-800 text-sm">{log.action}</td>
                        </tr>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-400">
                          No audit trail records logged yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}
        </>
      )}

      {/* ADD ADMINISTRATOR MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#121620] border border-white/[0.08] w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4">Add Administrator</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <FormField label="Full Name" htmlFor="fullName">
                <input
                  id="fullName"
                  type="text"
                  required
                  placeholder="Arjun Sharma"
                  className="input-field bg-white/[0.02] border-white/[0.08] text-white"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </FormField>
              <FormField label="Email Address" htmlFor="add_email">
                <input
                  id="add_email"
                  type="email"
                  required
                  placeholder="name@fusionfit.com"
                  className="input-field bg-white/[0.02] border-white/[0.08] text-white"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </FormField>
              <FormField label="System Role" htmlFor="add_role">
                <select
                  id="add_role"
                  className="select-field bg-[#121620] border-white/[0.08] text-white"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Super Admin">Super Admin</option>
                  <option value="Admin">Admin</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Trainer">Trainer</option>
                </select>
              </FormField>
              <FormField label="Initial Password (Optional)" htmlFor="add_password">
                <div className="relative flex items-center">
                  <input
                    id="add_password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Defaults to 'password123' if empty"
                    className="input-field bg-white/[0.02] border-white/[0.08] text-white pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06] mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn btn-secondary bg-transparent border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-[#121620] border border-white/[0.08] w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-2">Reset Password</h3>
            <p className="text-xs text-zinc-400 mb-4">
              Enter a new secure password for operator <strong>{selectedUser.email}</strong>.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-4">
              <FormField label="New Password" htmlFor="reset_password">
                <div className="relative flex items-center">
                  <Lock className="absolute left-3 h-4 w-4 text-zinc-500 pointer-events-none" />
                  <input
                    id="reset_password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    className="input-field bg-white/[0.02] border-white/[0.08] text-white pl-10 pr-10"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-zinc-500 hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06] mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedUser(null);
                    setNewPassword('');
                  }}
                  className="btn btn-secondary bg-transparent border-white/[0.08] text-zinc-300 hover:bg-white/[0.05]"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting || newPassword.length < 6}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
