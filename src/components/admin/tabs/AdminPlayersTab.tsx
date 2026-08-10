import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PlayerRow {
  user_id: string;
  username: string;
  avatar_emoji: string;
  player_id: number;
  net_worth: number;
  updated_at: string;
}

const AdminPlayersTab: React.FC = () => {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingBalance, setEditingBalance] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState('');
  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    setLoading(true);
    // Join profiles with game_saves
    const { data: profiles } = await supabase.from('profiles').select('*');
    const { data: saves } = await supabase.from('game_saves').select('user_id, net_worth, updated_at, game_state');

    const merged: PlayerRow[] = (profiles || []).map(p => {
      const save = saves?.find(s => s.user_id === p.user_id);
      return {
        user_id: p.user_id,
        username: p.username,
        avatar_emoji: p.avatar_emoji,
        player_id: p.player_id,
        net_worth: save?.net_worth || 0,
        updated_at: save?.updated_at || p.created_at,
      };
    });

    setPlayers(merged.sort((a, b) => b.net_worth - a.net_worth));
    setLoading(false);
  };

  const handleBalanceChange = async (userId: string) => {
    const amount = parseFloat(newBalance);
    if (isNaN(amount)) return;

    // Get current save
    const { data: save } = await supabase
      .from('game_saves')
      .select('game_state')
      .eq('user_id', userId)
      .single();

    if (save) {
      const gameState = save.game_state as any;
      gameState.balance = amount;
      
      await supabase
        .from('game_saves')
        .update({ game_state: gameState, net_worth: amount })
        .eq('user_id', userId);

      // Log action
      await supabase.from('admin_logs').insert({
        admin_user_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'change_balance',
        target_user_id: userId,
        details: { new_balance: amount },
      });
    }

    setEditingBalance(null);
    setNewBalance('');
    loadPlayers();
  };

  const handleResetProgress = async (userId: string, username: string) => {
    if (!confirm(`Сбросить прогресс игрока ${username}?`)) return;

    await supabase
      .from('game_saves')
      .update({ game_state: {}, net_worth: 0 })
      .eq('user_id', userId);

    await supabase.from('admin_logs').insert({
      admin_user_id: (await supabase.auth.getUser()).data.user?.id,
      action: 'reset_progress',
      target_user_id: userId,
      details: { username },
    });

    loadPlayers();
  };

  const handleAdjustBalance = async (userId: string) => {
    const delta = parseFloat(adjustDelta);
    if (isNaN(delta) || delta === 0) {
      alert('Введите ненулевую сумму (положительную чтобы добавить, отрицательную чтобы вычесть)');
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc('admin_adjust_balance', {
      p_user_id: userId,
      p_delta: delta,
      p_reason: 'admin_panel',
    });
    setBusy(false);
    if (error) {
      alert('Ошибка: ' + error.message);
      return;
    }
    setAdjustingId(null);
    setAdjustDelta('');
    loadPlayers();
  };

  const filtered = players.filter(p =>
    p.username.toLowerCase().includes(search.toLowerCase()) ||
    p.player_id.toString().includes(search)
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">👥 Управление игроками</h2>
        <Button variant="outline" size="sm" onClick={loadPlayers}>🔄 Обновить</Button>
      </div>

      <Input
        placeholder="Поиск по имени или ID..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <div className="grid gap-3">
          {filtered.map(player => (
            <Card key={player.user_id} className="overflow-hidden">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{player.avatar_emoji}</span>
                  <div>
                    <p className="font-medium">{player.username}</p>
                    <p className="text-xs text-muted-foreground">ID: #{player.player_id} • Обновлено: {new Date(player.updated_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {editingBalance === player.user_id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="Новый баланс"
                        value={newBalance}
                        onChange={e => setNewBalance(e.target.value)}
                        className="w-40 h-8"
                      />
                      <Button size="sm" onClick={() => handleBalanceChange(player.user_id)}>✅</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingBalance(null)}>❌</Button>
                    </div>
                  ) : adjustingId === player.user_id ? (
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        placeholder="±сумма (напр. 1000 или -500)"
                        value={adjustDelta}
                        onChange={e => setAdjustDelta(e.target.value)}
                        className="w-52 h-8"
                      />
                      <Button size="sm" disabled={busy} onClick={() => handleAdjustBalance(player.user_id)}>✅</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setAdjustingId(null); setAdjustDelta(''); }}>❌</Button>
                    </div>
                  ) : (
                    <div className="text-right">
                      <p className="font-mono font-bold text-primary">
                        ${player.net_worth.toLocaleString()}
                      </p>
                      <div className="flex gap-1 mt-1 flex-wrap justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs"
                          onClick={() => { setEditingBalance(player.user_id); setNewBalance(String(player.net_worth)); }}
                        >
                          💰 Баланс
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs text-emerald-600"
                          onClick={() => { setAdjustingId(player.user_id); setAdjustDelta(''); }}
                        >
                          ± Пополнить
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-xs text-destructive"
                          onClick={() => handleResetProgress(player.user_id, player.username)}
                        >
                          🗑️ Сброс
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground">Игроки не найдены</p>}
        </div>
      )}
    </div>
  );
};

export default AdminPlayersTab;
