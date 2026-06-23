'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
  Phone,
  User,
  X,
  Info,
} from 'lucide-react';
import { PageHeader, SectionCard, FormField } from '@/components/ui/Primitives';
import { TableSkeleton } from '@/components/ui/Skeleton';
import {
  listProfiles,
  adminCreateUser,
  adminUpdateUser,
  adminToggleUserDisabled,
  adminResetUserPassword,
  adminDeleteUser,
  listAuditLogs,
} from '@/lib/actions/users';
import { useAuth } from '@/components/auth/AuthProvider';
import { UserModal } from '@/components/users/UserModal';

export type UserProfile = {
  id: string;
  auth_user_id?: string | null;
  full_name?: string | null;
  email: string;
  phone?: string | null;
  role?: string | null;
  status?: 'Active' | 'Suspended' | string | null;
  notes?: string | null;
  created_at?: string | null;
};

type AuditLog = {
  id: string;
  created_at?: string | null;
  action?: string | null;
  module?: string | null;
  users_profiles?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
};

type ConfirmModalState = {
  show: boolean;
  type: 'suspend' | 'activate' | 'delete' | null;
  user: UserProfile | null;
};

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return fallback;
}

export default function UserManagementPage() {
  const { profile: loggedInProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<'users' | 'audit'>('users');
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal states
  const [modalType, setModalType] = useState<'add' | 'edit' | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);

  // Custom confirmation modal
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    show: false,
    type: null,
    user: null,
  });

  // Form states
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const usersRes = await listProfiles();
      if (usersRes?.error) {
        throw new Error(usersRes.error);
      }
      setProfiles(usersRes.data || []);

      const logsRes = await listAuditLogs();
      if (logsRes?.error) {
        throw new Error(logsRes.error);
      }
      setAuditLogs(logsRes.data || []);
    } catch (err: unknown) {
      console.error(err);
      setError(getErrorMessage(err, 'Failed to load user administration data. Ensure SUPABASE_SERVICE_ROLE_KEY is configured.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, []);

  // Safe date helper
  const formatDateSafe = (dateString: string | null | undefined, includeTime: boolean = false) => {
    if (!dateString) return 'Unavailable';
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Unavailable';
    if (isNaN(date.getTime())) return '—';
    if (includeTime) {
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Find last login dynamically from audit logs
  const getLastLoginForUser = (email: string) => {
    if (!auditLogs || auditLogs.length === 0) return 'Never';
    const userLogs = auditLogs.filter(
      (log) => log.action && log.action.includes(`Login Success: ${email}`)
    );
    if (userLogs.length === 0) return 'Never';
    return formatDateSafe(userLogs[0].created_at, true);
  };



  const handleOpenEditModal = (user: UserProfile) => {
    setSelectedUser(user);
    setModalType('edit');
  };

  const handleConfirmAction = async () => {
    const { type, user } = confirmModal;
    if (!type || !user) return;

    setLoading(true);
    setError('');
    setSuccess('');
    setConfirmModal({ show: false, type: null, user: null });

    try {
      if (type === 'delete') {
        if (!user.auth_user_id) {
          setError('This user cannot be deleted because the auth account id is missing.');
          setLoading(false);
          return;
        }
        const res = await adminDeleteUser(user.auth_user_id, user.email);
        if (res?.error) {
          throw new Error(res.error);
        }
        setSuccess(`User ${user.email} has been permanently deleted.`);
      } else {
        const disableValue = type === 'suspend';
        const res = await adminToggleUserDisabled(user.id, disableValue, user.email);
        if (res?.error) {
          throw new Error(res.error);
        }
        setSuccess(`Account ${user.email} has been ${disableValue ? 'suspended' : 'activated'}.`);
      }
      await loadData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to perform action.'));
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedUser.auth_user_id || !newPassword || newPassword.length < 6) return;

    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const res = await adminResetUserPassword(selectedUser.auth_user_id, newPassword, selectedUser.email);
      if (res?.error) {
        throw new Error(res.error);
      }
      setSuccess(`Password for ${selectedUser.email} has been reset successfully.`);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to reset password.'));
    } finally {
      setSubmitting(false);
    }
  };

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const fieldClass =
    'input-field bg-white text-slate-900 dark:bg-zinc-900 dark:text-zinc-100 dark:border-zinc-800';
  const fieldErrorClass = 'border-red-500 focus:border-red-500 focus:ring-red-500/20';
  const modalPanelClass =
    'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-h-[calc(100dvh-3rem)]';
  const isOwnAccount = (user: UserProfile) => user.auth_user_id === loggedInProfile?.auth_user_id;

  return (
    <div className="page page-wide page-enter">
      <PageHeader
        title="User Management"
        subtitle="Manage administrative credentials, system access roles, statuses, and audit trails."
        action={
          <Link href="/users/add" className="btn btn-primary shadow-lg shadow-amber-500/10 hover:shadow-amber-500/20 transition-all">
            <UserPlus className="h-4 w-4" /> Add User Account
          </Link>
        }
      />

      {/* Setup notification banner if service role key might be missing */}
      {error && error.includes('SUPABASE_SERVICE_ROLE_KEY') && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-800 dark:text-amber-300">
          <h3 className="font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Environment Configuration Missing
          </h3>
          <p className="mt-2 leading-relaxed text-xs text-zinc-400">
            User administration requires the <strong>SUPABASE_SERVICE_ROLE_KEY</strong> key in your server settings to access the Auth Admin interface. Please append it to your <code>.env.local</code> file in the project root:
          </p>
          <pre className="mt-3 bg-zinc-950 p-3 rounded-lg text-amber-200 text-xs font-mono select-all">
            SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
          </pre>
        </div>
      )}

      {/* Tabs */}
      <div className="segmented-control inline-flex w-fit mb-6 bg-slate-100 dark:bg-zinc-900/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab('users')}
          className={`segment flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-xs transition-all ${
            activeTab === 'users'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Users List
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`segment flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-semibold text-xs transition-all ${
            activeTab === 'audit'
              ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-zinc-300'
          }`}
        >
          <History className="h-3.5 w-3.5" /> System Audit Trail
        </button>
      </div>

      {/* Success alert */}
      {success && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold animate-enter">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Alert (non-config) */}
      {error && !error.includes('SUPABASE_SERVICE_ROLE_KEY') && (
        <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-700 dark:text-red-400 font-semibold animate-enter">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <SectionCard
          title={activeTab === 'users' ? 'Administrator Accounts' : 'System Audit Logs'}
          description="Loading the latest access records."
          icon={activeTab === 'users' ? <Shield className="h-5 w-5" /> : <History className="h-5 w-5" />}
        >
          <div className="data-table rounded-xl border border-slate-200 dark:border-zinc-800">
            <TableSkeleton rows={5} cols={activeTab === 'users' ? 8 : 4} />
          </div>
          <div className="data-cards rounded-xl border border-slate-200 p-4 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Loader2 className="h-4 w-4 animate-spin text-amber-500" />
              <span className="text-sm font-semibold text-slate-600 dark:text-zinc-300">Loading records...</span>
            </div>
          </div>
        </SectionCard>
      ) : (
        <>
          {activeTab === 'users' && (
            <SectionCard
              title="Administrator Accounts"
              description="Listing authorized operators with system access roles, contact numbers, and login timestamps."
              icon={<Shield className="h-5 w-5" />}
            >
              <div className="data-table rounded-xl border border-slate-200 dark:border-zinc-800">
                <table className="min-w-[1080px] table-fixed text-left">
                  <colgroup>
                    <col className="w-[18%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[11%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[12%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-bold tracking-wider uppercase text-slate-800 dark:border-zinc-800 dark:text-zinc-200 bg-slate-100 dark:bg-zinc-900">
                      <th className="py-4 px-4">Operator</th>
                      <th className="py-4 px-4">Email</th>
                      <th className="py-4 px-4">Phone</th>
                      <th className="py-4 px-4">Role</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4">Joined</th>
                      <th className="py-4 px-4">Last Login</th>
                      <th className="py-4 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b border-slate-200 text-[13px] transition-all hover:bg-slate-100 hover:shadow-sm dark:border-zinc-800 dark:hover:bg-zinc-800/60 ${
                          user.status === 'Suspended' ? 'bg-slate-50 dark:bg-zinc-900/50' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-bold tracking-wide uppercase shadow-sm ${
                                user.role === 'Super Admin'
                                  ? 'bg-amber-100 !text-amber-900 border border-amber-200/60 dark:bg-amber-500/10 dark:!text-amber-400'
                                  : user.role === 'Admin'
                                  ? 'bg-orange-100 !text-orange-900 border border-orange-200/60 dark:bg-orange-500/10 dark:!text-orange-400'
                                  : user.role === 'Receptionist'
                                  ? 'bg-teal-100 !text-teal-900 border border-teal-200/60 dark:bg-teal-500/10 dark:!text-teal-400'
                                  : 'bg-blue-100 !text-blue-900 border border-blue-200/60 dark:bg-blue-500/10 dark:!text-blue-400'
                              }`}
                            >
                              {getInitials(user.full_name)}
                            </div>
                            <span className="min-w-0 truncate font-bold !text-black dark:!text-black">
                              {user.full_name || 'Unnamed user'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-slate-800 dark:text-zinc-200">
                          <span className="block truncate">{user.email}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="block truncate text-[13px] font-semibold !text-black dark:!text-black">
                            {user.phone || 'Unavailable'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`badge rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              user.role === 'Super Admin'
                                ? 'border border-amber-200/40 bg-amber-100 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400'
                                : user.role === 'Admin'
                                ? 'bg-orange-100 text-orange-800 dark:bg-orange-500/10 dark:text-orange-400'
                                : user.role === 'Receptionist'
                                ? 'bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-400'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                              user.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                              }`}
                            />
                            {user.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[13px] font-semibold !text-black dark:text-zinc-300">
                          {formatDateSafe(user.created_at)}
                        </td>
                        <td className="py-3.5 px-4 text-[13px] font-semibold !text-black dark:text-zinc-300">
                          {getLastLoginForUser(user.email)}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex min-w-[152px] items-center justify-end gap-1">
                            {/* Edit Profile */}
                            <button
                              onClick={() => handleOpenEditModal(user)}
                              title="Edit user details"
                              className="table-action text-slate-500 transition-all hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-zinc-800 dark:hover:text-white"
                            >
                              <User className="h-4 w-4" />
                            </button>

                            {/* Reset Password */}
                            <button
                              onClick={() => {
                                setSelectedUser(user);
                                setShowResetModal(true);
                              }}
                              title="Reset user password"
                              className="table-action text-slate-500 transition-all hover:bg-amber-100 hover:text-amber-700 dark:hover:bg-zinc-800"
                            >
                              <Key className="h-4 w-4" />
                            </button>

                            {/* Enable/Disable Toggle */}
                            <button
                              onClick={() =>
                                setConfirmModal({
                                  show: true,
                                  type: user.status === 'Active' ? 'suspend' : 'activate',
                                  user,
                                })
                              }
                              title={user.status === 'Suspended' ? 'Activate Account' : 'Suspend Account'}
                              className={`table-action transition-all disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-zinc-800 ${
                                user.status === 'Suspended'
                                  ? 'text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700'
                                  : 'text-slate-500 hover:bg-rose-100 hover:text-rose-600'
                              }`}
                              disabled={isOwnAccount(user)}
                            >
                              {user.status === 'Suspended' ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                            </button>

                            {/* Delete Account */}
                            <button
                              onClick={() =>
                                setConfirmModal({
                                  show: true,
                                  type: 'delete',
                                  user,
                                })
                              }
                              title="Delete Account"
                              className="table-action text-slate-500 transition-all hover:bg-rose-100 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-35 dark:hover:bg-zinc-800"
                              disabled={isOwnAccount(user)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {profiles.length === 0 && (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-slate-400 dark:text-zinc-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700 animate-pulse" />
                            <p className="font-semibold text-sm">No administrative accounts found.</p>
                            <p className="text-xs text-zinc-400">Click the button above to seed a new operator.</p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="data-cards rounded-xl border border-slate-200 dark:border-zinc-800">
                {profiles.map((user) => (
                  <article
                    key={`${user.id}-mobile`}
                    className={`mobile-record ${user.status === 'Suspended' ? 'bg-slate-50 dark:bg-zinc-900/50' : ''}`}
                  >
                    <div className="mobile-record-header">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-bold tracking-wide uppercase shadow-sm ${
                            user.role === 'Super Admin'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400'
                              : user.role === 'Admin'
                              ? 'bg-orange-100 text-orange-900 border border-orange-200/60 dark:bg-orange-500/10 dark:text-orange-400'
                              : user.role === 'Receptionist'
                              ? 'bg-teal-100 text-teal-900 border border-teal-200/60 dark:bg-teal-500/10 dark:text-teal-400'
                              : 'bg-blue-100 text-blue-900 border border-blue-200/60 dark:bg-blue-500/10 dark:text-blue-400'
                          }`}
                        >
                          {getInitials(user.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold !text-black dark:!text-white">
                            {user.full_name || 'Unnamed user'}
                          </p>
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-zinc-200">{user.email}</p>
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider ${
                          user.status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            user.status === 'Active' ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                        />
                        {user.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Phone</p>
                        <p className="mt-1 truncate font-semibold !text-black dark:!text-zinc-200">
                          {user.phone || 'Unavailable'}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Role</p>
                        <p className="mt-1 truncate font-medium text-slate-700 dark:text-zinc-300">{user.role}</p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Joined</p>
                        <p className="mt-1 font-medium text-slate-700 dark:text-zinc-300">
                          {formatDateSafe(user.created_at)}
                        </p>
                      </div>
                      <div>
                        <p className="font-semibold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Last Login</p>
                        <p className="mt-1 font-medium text-slate-700 dark:text-zinc-300">
                          {getLastLoginForUser(user.email)}
                        </p>
                      </div>
                    </div>

                    <div className="mobile-record-actions flex-wrap">
                      <button
                        onClick={() => handleOpenEditModal(user)}
                        className="btn btn-secondary btn-sm justify-center"
                        type="button"
                      >
                        <User className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetModal(true);
                        }}
                        className="btn btn-secondary btn-sm justify-center"
                        type="button"
                      >
                        <Key className="h-4 w-4" />
                        Reset
                      </button>
                      <button
                        onClick={() =>
                          setConfirmModal({
                            show: true,
                            type: user.status === 'Active' ? 'suspend' : 'activate',
                            user,
                          })
                        }
                        className="btn btn-secondary btn-sm justify-center disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={isOwnAccount(user)}
                        type="button"
                      >
                        {user.status === 'Suspended' ? <UserCheck className="h-4 w-4" /> : <UserX className="h-4 w-4" />}
                        {user.status === 'Suspended' ? 'Activate' : 'Suspend'}
                      </button>
                      <button
                        onClick={() =>
                          setConfirmModal({
                            show: true,
                            type: 'delete',
                            user,
                          })
                        }
                        className="btn btn-secondary btn-sm justify-center text-rose-600 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-35 dark:text-rose-400"
                        disabled={isOwnAccount(user)}
                        type="button"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
                {profiles.length === 0 && (
                  <div className="empty-state p-6">
                    <Users className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                    <p className="card-title">No administrative accounts found.</p>
                    <p className="small-text">Use Add User Account to seed a new operator.</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {activeTab === 'audit' && (
            <SectionCard
              title="System Audit Logs"
              description="Chronological trail of administrative actions, config adjustments, and login requests. Immutable registry."
              icon={<History className="h-5 w-5" />}
            >
              <div className="data-table overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 pb-3 text-slate-800 dark:border-zinc-800 dark:text-zinc-200 text-[11px] font-bold tracking-wider uppercase bg-slate-100 dark:bg-zinc-900">
                      <th className="py-4 px-4">Timestamp</th>
                      <th className="py-4 px-4">Operator</th>
                      <th className="py-4 px-4">Module</th>
                      <th className="py-4 px-4">Action Performed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map((log) => {
                      // Resolve operator name from cached user profile relation
                      const operatorName =
                        log.users_profiles?.full_name || log.users_profiles?.email || 'System / Guest';
                      return (
                        <tr key={log.id} className="border-b border-slate-200 text-[13px] hover:bg-slate-100 transition-all dark:border-zinc-800 dark:hover:bg-zinc-800/60">
                          <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-zinc-300 whitespace-nowrap">
                            {formatDateSafe(log.created_at, true)}
                          </td>
                          <td className="py-3.5 px-4 font-bold !text-black dark:!text-white">
                            {operatorName}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex min-h-[22px] items-center bg-slate-100 border border-slate-200/60 text-slate-700 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md shadow-sm">
                              {log.module}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-zinc-300">
                            {log.action}
                          </td>
                        </tr>
                      );
                    })}
                    {auditLogs.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-12 text-slate-400 dark:text-zinc-500">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <History className="h-8 w-8 text-zinc-300 dark:text-zinc-700" />
                            <p className="font-semibold text-sm">No audit logs recorded yet.</p>
                          </div>
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

      {/* EDIT ADMINISTRATOR MODAL */}
      <UserModal
        isOpen={modalType === 'edit'}
        mode="edit"
        user={selectedUser}
        loggedInUserId={loggedInProfile?.auth_user_id}
        onClose={() => {
          setModalType(null);
          setSelectedUser(null);
        }}
        onSaveSuccess={(message) => {
          setSuccess(message);
          loadData();
        }}
        onError={(message) => {
          setError(message);
        }}
      />

      {/* RESET PASSWORD MODAL */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => {
                setShowResetModal(false);
                setSelectedUser(null);
                setNewPassword('');
              }}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <Key className="h-5 w-5 text-amber-500" /> Reset Password
            </h3>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-6">
              Enter a new secure system access password for operator <strong>{selectedUser.email}</strong>.
            </p>
            
            <form onSubmit={handleResetPassword} className="space-y-4">
              <FormField label="New Password" htmlFor="reset_password" error={newPassword.length > 0 && newPassword.length < 6 ? 'Min 6 characters' : ''}>
                <div className="relative flex items-center">
                  <Lock className="absolute left-3.5 h-4 w-4 text-zinc-400 pointer-events-none" />
                  <input
                    id="reset_password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Min 6 characters"
                    className="input-field bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 dark:text-white w-full rounded-xl pl-10 pr-10 p-2.5 text-sm"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormField>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedUser(null);
                    setNewPassword('');
                  }}
                  className="btn btn-secondary bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 rounded-xl"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary bg-amber-500 hover:bg-amber-600 border-0 text-zinc-950 font-bold rounded-xl px-5"
                  disabled={submitting || newPassword.length < 6}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION OVERLAY */}
      {confirmModal.show && confirmModal.user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 animate-enter">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl relative">
            <button
              onClick={() => setConfirmModal({ show: false, type: null, user: null })}
              className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-600 dark:hover:text-white transition-all"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center ${
                  confirmModal.type === 'delete'
                    ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {confirmModal.type === 'delete'
                  ? 'Permanently Delete User?'
                  : confirmModal.type === 'suspend'
                  ? 'Suspend Access Privilege?'
                  : 'Restore Access Privilege?'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed mb-6">
              {confirmModal.type === 'delete' ? (
                <>
                  Are you absolutely sure you want to delete user{' '}
                  <strong className="text-slate-950 dark:text-white">{confirmModal.user.email}</strong>?
                  This will wipe their profile records and administrative permissions.
                  <br />
                  <span className="text-rose-500 font-bold block mt-1">This operation is irreversible.</span>
                </>
              ) : confirmModal.type === 'suspend' ? (
                <>
                  Confirm suspension for user{' '}
                  <strong className="text-slate-950 dark:text-white">{confirmModal.user.email}</strong>.
                  This will temporarily block their logins. They can be re-activated at any time.
                </>
              ) : (
                <>
                  Confirm reactivation for user{' '}
                  <strong className="text-slate-950 dark:text-white">{confirmModal.user.email}</strong>.
                  This will restore their default login access and roles immediately.
                </>
              )}
            </p>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-zinc-900/60">
              <button
                type="button"
                onClick={() => setConfirmModal({ show: false, type: null, user: null })}
                className="btn btn-secondary bg-slate-100 hover:bg-slate-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-0 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmAction}
                className={`btn font-bold rounded-xl px-5 border-0 ${
                  confirmModal.type === 'delete'
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-amber-500 hover:bg-amber-600 text-zinc-950'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
