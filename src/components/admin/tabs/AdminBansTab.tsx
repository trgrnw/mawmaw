import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface BanRow {
  id: string;
  user_id: string;
  username: string;
  player_id: number;
  reason: string;
  ban_type: string;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  banned_by_username: string;
}

const DURATIONS = [
  { hours: 1, label: '1 час' },
  { hours: 24, label: '1 день' },
  { hours: 24 * 7, label: '7 дней' },
  { hours: 24 * 30, label: '30 дней' },
  { hours: 0, label: 'Перманентный' },
];

const AdminBansTab: React.FC = () => {
  const [bans, setBans] = useState<BanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showActive, setShowActive] = useState(true);
  const [search, setSearch] = useState('');

  // Ban dialog
  const [banOpen, setBanOpen] = useState(false);
  const [targetQuery, setTargetQuery] = useState('');
  const [targetResult, setTargetResult] = useState<{ user_id: string; username: string; player_id: number } | null>(null);
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<number>(24);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('user_bans')
      .select('id, user_id, banned_by, reason, ban_type, expires_at, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!data) { setBans([]); setLoading(false); return; }

    const userIds = [...new Set(data.flatMap(b => [b.user_id, b.banned_by].filter(Boolean) as string[]))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, player_id')
      .in('user_id', userIds);
    const profMap = new Map((profiles || []).map(p => [p.user_id, p]));

    const rows: BanRow[] = data.map(b => {
      const target = profMap.get(b.user_id);
      const banner = b.banned_by ? profMap.get(b.banned_by) : null;
      return {
        id: b.id, user_id: b.user_id, username: target?.username || '???',
        player_id: target?.player_id || 0, reason: b.reason, ban_type: b.ban_type,
        expires_at: b.expires_at, is_active: b.is_active, created_at: b.created_at,
        banned_by_username: banner?.username || 'system',
      };
    });
    setBans(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSearchTarget = async () => {
    const q = targetQuery.trim().replace(/^@/, '');
    if (!q) return;
    setTargetResult(null);
    const numId = parseInt(q);
    if (!isNaN(numId)) {
      const { data } = await supabase.from('profiles').select('user_id, username, player_id').eq('player_id', numId).maybeSingle();
      if (data) { setTargetResult(data as any); return; }
    }
    const { data } = await supabase.from('profiles').select('user_id, username, player_id').ilike('username', `%${q}%`).limit(1).maybeSingle();
    if (data) setTargetResult(data as any);
    else toast.error('Игрок не найден');
  };

  const handleBan = async () => {
    if (!targetResult) return;
    try {
      const { error } = await supabase.rpc('ban_user', {
        p_user_id: targetResult.user_id,
        p_reason: reason || 'Без причины',
        p_duration_hours: duration === 0 ? null : duration,
      });
      if (error) throw error;
      toast.success(`${targetResult.username} забанен`);
      setBanOpen(false); setTargetResult(null); setTargetQuery(''); setReason('');
      load();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка');
    }
  };

  const handleUnban = async (userId: string, username: string) => {
    if (!confirm(`Разбанить ${username}?`)) return;
    try {
      const { error } = await supabase.rpc('unban_user', { p_user_id: userId });
      if (error) throw error;
      toast.success(`${username} разбанен`);
      load();
    } catch (e: any) { toast.error(e.message || 'Ошибка'); }
  };

  const filtered = bans.filter(b => {
    if (showActive && !b.is_active) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return b.username.toLowerCase().includes(q) || b.player_id.toString().includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-2xl font-bold">🚫 Бан-система</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load}>🔄 Обновить</Button>
          <Button size="sm" onClick={() => setBanOpen(true)} className="bg-destructive hover:bg-destructive/90">+ Забанить игрока</Button>
        </div>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <Input placeholder="Поиск по имени или ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showActive} onChange={e => setShowActive(e.target.checked)} className="rounded" />
          Только активные
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <div className="grid gap-2">
          {filtered.map(b => (
            <Card key={b.id} className={b.is_active ? 'border-destructive/40' : 'opacity-60'}>
              <CardContent className="p-3 flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.is_active ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                      {b.is_active ? 'АКТИВЕН' : 'СНЯТ'}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.ban_type === 'permanent' ? 'bg-yellow-500/20 text-yellow-600' : 'bg-blue-500/20 text-blue-600'}`}>
                      {b.ban_type === 'permanent' ? '♾️ ПЕРМА' : '⏱️ ВРЕМЕННЫЙ'}
                    </span>
                    <span className="font-medium">{b.username}</span>
                    <span className="text-xs text-muted-foreground">#{b.player_id}</span>
                  </div>
                  <p className="text-sm mt-1 text-muted-foreground">📝 {b.reason || '— без причины —'}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(b.created_at).toLocaleString()} от @{b.banned_by_username}
                    {b.expires_at && b.ban_type === 'temporary' && (
                      <> • до {new Date(b.expires_at).toLocaleString()}</>
                    )}
                  </p>
                </div>
                {b.is_active && (
                  <Button size="sm" variant="outline" onClick={() => handleUnban(b.user_id, b.username)}>🔓 Разбан</Button>
                )}
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground text-sm">Нет банов</p>}
        </div>
      )}

      {/* Ban dialog */}
      <Dialog open={banOpen} onOpenChange={setBanOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🚫 Забанить игрока</DialogTitle>
            <DialogDescription>Найдите игрока, укажите причину и срок</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="Username или ID" value={targetQuery} onChange={e => setTargetQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchTarget()} />
              <Button onClick={handleSearchTarget}>Найти</Button>
            </div>
            {targetResult && (
              <div className="bg-muted/30 rounded-xl p-3 text-sm">
                <p>Цель: <span className="font-semibold">{targetResult.username}</span> #{targetResult.player_id}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Причина</label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="Например: использование багов" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-2">Срок</label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map(d => (
                  <button
                    key={d.hours}
                    onClick={() => setDuration(d.hours)}
                    className={`px-3 py-2 rounded-xl border text-sm ${duration === d.hours ? 'bg-destructive/20 border-destructive text-destructive font-semibold' : 'hover:bg-muted/50'}`}
                  >{d.label}</button>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBanOpen(false)}>Отмена</Button>
              <Button onClick={handleBan} disabled={!targetResult} className="bg-destructive hover:bg-destructive/90">Забанить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBansTab;
