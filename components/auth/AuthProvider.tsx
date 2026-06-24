'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { getCurrentUserProfile, signOutAction } from '@/lib/actions/auth';

interface UserProfile {
  id: string;
  auth_user_id: string;
  full_name: string;
  email: string;
  role: 'Super Admin' | 'Admin' | 'Receptionist' | 'Trainer';
  status: 'Active' | 'Suspended';
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;

  // Memoize client to prevent re-creating on every render
  const supabase = useMemo(() => createClient(), []);

  const fetchProfile = async () => {
    try {
      const data = await getCurrentUserProfile();
      if (data) {
        setUser(data.user);
        setProfile(data.profile as UserProfile);
        if (data.profile?.status === 'Suspended') {
          await signOutAction();
          setUser(null);
          setProfile(null);
          routerRef.current.push('/login?error=Your account has been suspended. Please contact the administrator.');
        }
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error('Error fetching auth profile:', err);
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of session and profile
    fetchProfile();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (event === 'SIGNED_IN') {
        await fetchProfile();
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        routerRef.current.push('/login');
      } else if (event === 'TOKEN_REFRESHED') {
        // Just refresh the profile/user data
        if (session?.user) {
          setUser(session.user);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOutAction();
      setUser(null);
      setProfile(null);
      router.push('/login');
    } catch (err) {
      console.error('Error signing out:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signOut: handleSignOut,
        refreshProfile: fetchProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
