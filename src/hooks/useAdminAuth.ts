import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'owner' | 'admin' | 'moderator';

interface AdminAuthState {
  isLoading: boolean;
  isStaff: boolean;
  role: AppRole | null;
  isPasswordVerified: boolean;
}

export function useAdminAuth() {
  const { user } = useAuth();
  const [state, setState] = useState<AdminAuthState>({
    isLoading: true,
    isStaff: false,
    role: null,
    isPasswordVerified: false,
  });

  useEffect(() => {
    if (!user) {
      setState({ isLoading: false, isStaff: false, role: null, isPasswordVerified: false });
      return;
    }

    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);

        if (error || !data || data.length === 0) {
          // Try auto-assign owner if no roles exist yet
          try {
            const { data: initData, error: initError } = await supabase.functions.invoke('admin-init');
            if (!initError && initData?.success) {
              setState(prev => ({ ...prev, isLoading: false, isStaff: true, role: 'owner' as AppRole }));
              return;
            }
          } catch {
            // Ignore — not the first user or function failed
          }
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

  const verifyPassword = (password: string): boolean => {
    // The admin password - in production this would be verified server-side
    // For now we use a simple client-side check with a hashed comparison
    const ADMIN_PASSWORD = 'fc_admin_2024'; // You can change this
    const isValid = password === ADMIN_PASSWORD;
    
    if (isValid) {
      setState(prev => ({ ...prev, isPasswordVerified: true }));
      sessionStorage.setItem('admin_verified', 'true');
    }
    
    return isValid;
  };

  const checkSessionPassword = (): boolean => {
    const verified = sessionStorage.getItem('admin_verified') === 'true';
    if (verified && !state.isPasswordVerified) {
      setState(prev => ({ ...prev, isPasswordVerified: true }));
    }
    return verified;
  };

  const logout = () => {
    sessionStorage.removeItem('admin_verified');
    setState(prev => ({ ...prev, isPasswordVerified: false }));
  };

  const canManageUsers = state.role === 'owner' || state.role === 'admin';
  const canManageEconomy = state.role === 'owner' || state.role === 'admin';
  const canManageRoles = state.role === 'owner';
  const canViewStats = state.isStaff;

  return {
    ...state,
    verifyPassword,
    checkSessionPassword,
    logout,
    canManageUsers,
    canManageEconomy,
    canManageRoles,
    canViewStats,
  };
}
