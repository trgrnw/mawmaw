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

    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error || !data || data.length === 0) {
          setState(prev => ({ ...prev, isLoading: false, isStaff: false, role: null }));
          return;
        }

        // Pick highest role: owner > admin > moderator
        const roles = data.map(d => d.role as AppRole);
        const role = roles.includes('owner') ? 'owner' : roles.includes('admin') ? 'admin' : 'moderator';
        setState(prev => ({
          ...prev,
          isLoading: false,
          isStaff: true,
          role,
        }));
      } catch {
        setState(prev => ({ ...prev, isLoading: false, isStaff: false, role: null }));
      }
    };

    checkRole();
  }, [user]);

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
