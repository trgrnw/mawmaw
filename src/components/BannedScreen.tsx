import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import SupportTab from '@/components/tabs/SupportTab';

interface BanInfo {
  id: string;
  reason: string;
  ban_type: string;
  expires_at: string | null;
  created_at: string;
}

const BannedScreen: React.FC = () => {
  const { user, signOut, avatarEmoji, username } = useAuth();
  const [ban, setBan] = useState<BanInfo | null>(null);
  const [showSupport, setShowSupport] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (!user) return;
    supabase.rpc('get_active_ban', { _user_id: user.id }).then(({ data }) => {
      if (data && Array.isArray(data) && data.length > 0) setBan(data[0] as BanInfo);
    });
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, [user]);

  const formatRemaining = (expires: string) => {
    const ms = new Date(expires).getTime() - now.getTime();
    if (ms <= 0) return 'Истёк (обновите страницу)';
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}д ${h}ч ${m}м`;
    return `${h}ч ${m}м ${s % 60}с`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border-2 border-destructive/50 rounded-3xl p-8 text-center space-y-5 shadow-2xl">
        <div className="text-7xl">🚫</div>
        <div>
          <h1 className="text-3xl font-bold text-destructive">Аккаунт заблокирован</h1>
          <p className="text-sm text-muted-foreground mt-2">{avatarEmoji} {username}</p>
        </div>
        {ban && (
          <div className="bg-destructive/10 rounded-2xl p-4 text-left space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Тип бана</p>
              <p className="text-sm font-semibold text-foreground">
                {ban.ban_type === 'permanent' ? '♾️ Перманентный' : '⏱️ Временный'}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Причина</p>
              <p className="text-sm text-foreground">{ban.reason || 'Не указана'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Дата выдачи</p>
              <p className="text-sm text-foreground">{new Date(ban.created_at).toLocaleString()}</p>
            </div>
            {ban.ban_type === 'temporary' && ban.expires_at && (
              <div>
                <p className="text-xs text-muted-foreground">Осталось</p>
                <p className="text-sm font-mono font-bold text-destructive">{formatRemaining(ban.expires_at)}</p>
              </div>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Если вы считаете, что это ошибка — отправьте апелляцию в поддержку.
        </p>
        <div className="space-y-2">
          <Button onClick={() => setShowSupport(true)} className="w-full">
            ✉️ Связаться с поддержкой
          </Button>
          <Button variant="outline" onClick={signOut} className="w-full">Выйти</Button>
        </div>
      </div>

      {showSupport && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto p-4">
          <div className="max-w-3xl mx-auto pt-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Поддержка — апелляция бана</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowSupport(false)}>✕ Закрыть</Button>
            </div>
            <SupportTab forcedCategory="ban_appeal" hideHeading />
          </div>
        </div>
      )}
    </div>
  );
};

export default BannedScreen;
