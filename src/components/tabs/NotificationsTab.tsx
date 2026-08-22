import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import GameIcon from '@/components/GameIcon';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface ClanInviteNotification {
  id: string;
  clan_id: string;
  created_at: string;
  clan?: { name: string; tag: string; emoji: string };
}

const NotificationsTab: React.FC = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ClanInviteNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase
      .from('clan_invites')
      .select('id, clan_id, created_at')
      .eq('invitee_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) {
      toast.error('Не удалось загрузить уведомления');
      setLoading(false);
      return;
    }
    const clanIds = [...new Set((data || []).map(invite => invite.clan_id))];
    const { data: clans } = clanIds.length
      ? await supabase.from('clans').select('id, name, tag, emoji').in('id', clanIds)
      : { data: [] };
    setItems((data || []).map(invite => ({
      ...invite,
      clan: clans?.find(clan => clan.id === invite.clan_id),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clan_invites', filter: `invitee_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load, user]);

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    const { error } = await supabase.rpc('respond_clan_invite', { p_invite_id: id, p_accept: accept });
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(accept ? 'Вы вступили в клан' : 'Приглашение отклонено');
    setItems(current => current.filter(item => item.id !== id));
    window.dispatchEvent(new CustomEvent('notifications-changed'));
  };

  return (
    <div className="max-w-4xl space-y-5 pb-8">
      <header className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-card p-5 sm:p-7">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15"><GameIcon name="notifications" size={26} themed /></div>
          <div><h2 className="text-2xl font-bold sm:text-3xl">Уведомления</h2><p className="text-sm text-muted-foreground">Приглашения и важные игровые события</p></div>
        </div>
      </header>

      {!user ? (
        <div className="rounded-3xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">Войдите в аккаунт, чтобы получать уведомления.</div>
      ) : loading ? (
        <div className="rounded-3xl border bg-card p-10 text-center"><GameIcon name="loading" size={28} className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card/50 p-10 text-center"><GameIcon name="notifications" size={36} themed /><h3 className="mt-3 font-bold">Новых уведомлений нет</h3><p className="mt-1 text-sm text-muted-foreground">Новые приглашения в клан появятся здесь.</p></div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-violet-500/20 bg-card p-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10"><GameIcon name="users" size={24} themed /></div>
              <div className="min-w-0 flex-1"><p className="font-bold">Приглашение в клан [{item.clan?.tag || '—'}] {item.clan?.name || 'Клан'}</p><p className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>
              <div className="flex gap-2">
                <Button disabled={busyId === item.id} onClick={() => respond(item.id, true)}><GameIcon name="success" size={16} className="mr-1" />Принять</Button>
                <Button disabled={busyId === item.id} variant="outline" onClick={() => respond(item.id, false)}><GameIcon name="cancel" size={16} className="mr-1" />Отклонить</Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsTab;
