'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { Breadcrumb, PageHeader } from '@/components/ui/Primitives';
import { UserForm } from '@/components/users/UserForm';

export default function AddUserPage() {
  const router = useRouter();
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSuccess = (message: string) => {
    setSuccess(message);
    setError('');
    // Redirect to users list after a short delay so the user sees the success message
    setTimeout(() => {
      router.push('/users');
    }, 1200);
  };

  const handleError = (message: string) => {
    setError(message);
    setSuccess('');
  };

  return (
    <div className="page page-wide page-enter">
      <Breadcrumb
        items={[
          { label: 'Users', href: '/users' },
          { label: 'Add user' },
        ]}
      />
      <PageHeader
        title="Add User Account"
        subtitle="Register a new administrative or trainer profile with role permissions and system access credentials."
      />

      {/* Success alert */}
      {success && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 text-xs text-emerald-700 dark:text-emerald-400 font-semibold animate-enter">
          <CheckCircle className="h-4 w-4 text-emerald-500" />
          <span>{success}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="mb-6 flex items-center gap-2.5 rounded-xl border border-red-500/25 bg-red-500/5 p-3.5 text-xs text-red-700 dark:text-red-400 font-semibold animate-enter">
          <AlertTriangle className="h-4 w-4 text-red-500" />
          <span>{error}</span>
        </div>
      )}

      <UserForm onSuccess={handleSuccess} onError={handleError} />
    </div>
  );
}
