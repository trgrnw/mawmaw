import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'owner' | 'admin' | 'moderator';

interface AdminAuthState {
  isLoading: boolean;
  isStaff: boolean;
  role: AppRole | null;
}

export function useAdminAuth() {
  const { user } = useAuth();
  const [state, setState] = useState<AdminAuthState>({
    isLoading: true,
    isStaff: false,
    role: null,
  });

  useEffect(() => {
    if (!user) {
      setState({ isLoading: false, isStaff: false, role: null });
      return;
    }

    let cancelled = false;
    setState({ isLoading: true, isStaff: false, role: null });
    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (cancelled) return;
        if (error || !data || data.length === 0) {
          setState(prev => ({ ...prev, isLoading: false, isStaff: false, role: null }));
          return;
        }

        // Pick highest role: owner > admin > moderator
        const roles = data.map(d => d.role).filter((role): role is AppRole => ['owner', 'admin', 'moderator'].includes(role));
        if (!roles.length) { setState({ isLoading: false, isStaff: false, role: null }); return; }
        const role = roles.includes('owner') ? 'owner' : roles.includes('admin') ? 'admin' : 'moderator';
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStaff: true,
          role,
        }));
      } catch {
        if (cancelled) return;
        setState(prev => ({ ...prev, isLoading: false, isStaff: false, role: null }));
      }
    };

    void checkRole();
    return () => { cancelled = true; };
  }, [user?.id]);

  const canManageUsers = state.role === 'owner' || state.role === 'admin';
  const canManageEconomy = state.role === 'owner' || state.role === 'admin';
  const canManageRoles = state.role === 'owner';
  const canViewStats = state.isStaff;

  return {
    ...state,
    canManageUsers,
    canManageEconomy,
    canManageRoles,
    canViewStats,
  };
}
