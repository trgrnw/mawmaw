import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  username: string;
  avatarEmoji: string;
  avatarUrl: string;
  isBanned: boolean;
  banChecked: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: { username?: string; avatarEmoji?: string; avatarUrl?: string }) => Promise<void>;
  changeNickname: (nickname: string) => Promise<{ error: string | null }>;
  refreshBan: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('Player');
  const [avatarEmoji, setAvatarEmoji] = useState('👤');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [isBanned, setIsBanned] = useState(false);
  const [banChecked, setBanChecked] = useState(false);

  const checkBan = async (userId: string) => {
    const { data } = await supabase.rpc('is_user_banned', { _user_id: userId });
    setIsBanned(!!data);
    setBanChecked(true);
  };

  const refreshBan = async () => {
    if (user?.id) await checkBan(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => {
          fetchProfile(session.user.id);
          checkBan(session.user.id);
        }, 0);
      } else {
        setIsBanned(false);
        setBanChecked(true);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
        checkBan(session.user.id);
      } else {
        setBanChecked(true);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('username, avatar_emoji, avatar_url')
      .eq('user_id', userId)
      .single();
    if (data) {
      setUsername(data.username || 'Player');
      setAvatarEmoji(data.avatar_emoji || '👤');
      setAvatarUrl(data.avatar_url || '');
    }
  };

  const signUp = async (email: string, password: string, uname: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: uname },
        emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(),
      },
    });
    return { error: error?.message ?? null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    const uid = user?.id;
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUsername('Player');
    setAvatarEmoji('👤');
    setAvatarUrl('');
    // Clear user-scoped game save from localStorage
    if (uid) {
      localStorage.removeItem(`gameState_${uid}`);
    }
  };

  const updateProfile = async (data: { username?: string; avatarEmoji?: string; avatarUrl?: string }) => {
    if (!user) return;
    if (data.username !== undefined) {
      const result = await supabase.rpc('change_profile_nickname', { p_nickname: data.username });
      if (result.error) throw result.error;
    }
    if (data.avatarEmoji !== undefined) {
      const result = await supabase.from('profiles').update({ avatar_emoji: data.avatarEmoji }).eq('user_id', user.id);
      if (result.error) throw result.error;
    }
    if (data.avatarUrl !== undefined) {
      const result = await supabase.rpc('update_profile_extras', { p_avatar_url: data.avatarUrl, p_showcase: null });
      if (result.error) throw result.error;
    }
    if (data.username) setUsername(data.username);
    if (data.avatarEmoji) setAvatarEmoji(data.avatarEmoji);
    if (data.avatarUrl !== undefined) setAvatarUrl(data.avatarUrl);
  };

  const changeNickname = async (nickname: string) => {
    if (!user) return { error: 'Authentication required' };
    const { data, error } = await supabase.rpc('change_profile_nickname', {
      p_nickname: nickname,
    });
    if (error) return { error: error.message };
    const nextNickname = String(data || nickname).trim();
    setUsername(nextNickname);
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, username, avatarEmoji, avatarUrl, isBanned, banChecked, signUp, signIn, signOut, updateProfile, changeNickname, refreshBan }}>
      {children}
    </AuthContext.Provider>
  );
};
