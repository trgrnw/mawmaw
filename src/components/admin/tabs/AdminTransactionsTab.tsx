import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatMoney } from '@/context/GameContext';
import { Loader2 } from 'lucide-react';

interface ProfileLite {
  user_id: string;
  username: string;
  player_id: number;
  avatar_emoji: string;
}

const AdminTransactionsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [selected, setSelected] = useState<ProfileLite | null>(null);
  const [loading, setLoading] = useState(false);

  const [marketTx, setMarketTx] = useState<any[]>([]);
  const [casinoTx, setCasinoTx] = useState<any[]>([]);
  const [adminTx, setAdminTx] = useState<any[]>([]);
  const [netWorthTx, setNetWorthTx] = useState<any[]>([]);

  useEffect(() => {
    if (!search) { setProfiles([]); return; }
    const t = setTimeout(async () => {
      const isNum = /^\d+$/.test(search);
      const q = supabase.from('profiles').select('user_id, username, player_id, avatar_emoji').limit(15);
      const { data } = isNum
        ? await q.eq('player_id', parseInt(search))
        : await q.ilike('username', `%${search}%`);
      setProfiles(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadTransactions = async (p: ProfileLite) => {
    setSelected(p);
    setLoading(true);
    const [market, casino, admin, netWorth] = await Promise.all([
      supabase.from('market_listings').select('*').or(`seller_id.eq.${p.user_id},buyer_id.eq.${p.user_id}`).order('created_at', { ascending: false }).limit(100),
      supabase.from('casino_bets').select('*').eq('user_id', p.user_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('admin_logs').select('*').eq('target_user_id', p.user_id).order('created_at', { ascending: false }).limit(100),
      supabase.from('net_worth_history').select('*').eq('user_id', p.user_id).order('recorded_at', { ascending: false }).limit(100),
    ]);
    setMarketTx(market.data || []);
    setCasinoTx(casino.data || []);
    setAdminTx(admin.data || []);
    setNetWorthTx(netWorth.data || []);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">💸 Транзакции игроков</h2>
      <p className="text-sm text-muted-foreground">Поиск по нику или ID игрока</p>

      <div className="flex gap-2">
        <Input placeholder="Ник или ID..." value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
        {selected && <Button variant="outline" onClick={() => { setSelected(null); setSearch(''); }}>Сбросить</Button>}
      </div>

      {profiles.length > 0 && !selected && (
        <Card><CardContent className="p-0 divide-y">
          {profiles.map(p => (
            <button key={p.user_id} onClick={() => loadTransactions(p)} className="w-full p-3 text-left hover:bg-muted flex items-center gap-3">
              <span className="text-xl">{p.avatar_emoji}</span>
              <div>
                <p className="font-medium">{p.username}</p>
                <p className="text-xs text-muted-foreground">ID: {p.player_id}</p>
              </div>
            </button>
          ))}
        </CardContent></Card>
      )}

      {selected && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">{selected.avatar_emoji} {selected.username} <span className="text-xs text-muted-foreground">#{selected.player_id}</span></CardTitle></CardHeader>
          </Card>

          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
          ) : (
            <Tabs defaultValue="market">
              <TabsList>
                <TabsTrigger value="market">Маркет ({marketTx.length})</TabsTrigger>
                <TabsTrigger value="casino">Казино ({casinoTx.length})</TabsTrigger>
                <TabsTrigger value="admin">Админ ({adminTx.length})</TabsTrigger>
                <TabsTrigger value="networth">Состояние ({netWorthTx.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="market">
                <Card><CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto">
                  {marketTx.length === 0 ? <p className="p-4 text-muted-foreground">Нет операций</p> : marketTx.map(t => {
                    const isSeller = t.seller_id === selected.user_id;
                    const item = t.item_data?.username ? `@${t.item_data.username}` : t.item_data?.text || t.item_type;
                    return (
                      <div key={t.id} className="p-3 flex justify-between items-start">
                        <div>
                          <p className="text-sm font-medium">{isSeller ? '📤 Продажа' : '📥 Покупка'}: {item}</p>
                          <p className="text-xs text-muted-foreground">Статус: {t.status} · {new Date(t.created_at).toLocaleString()}</p>
                        </div>
                        <p className={`font-mono-game text-sm font-semibold ${isSeller ? 'text-green-500' : 'text-red-500'}`}>
                          {isSeller ? '+' : '-'}${formatMoney(t.price)}
                        </p>
                      </div>
                    );
                  })}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="casino">
                <Card><CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto">
                  {casinoTx.length === 0 ? <p className="p-4 text-muted-foreground">Нет ставок</p> : casinoTx.map(t => (
                    <div key={t.id} className="p-3 flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">🎰 {t.game_type} · {t.result}</p>
                        <p className="text-xs text-muted-foreground">Ставка: ${formatMoney(t.bet_amount)} · {new Date(t.created_at).toLocaleString()}</p>
                      </div>
                      <p className={`font-mono-game text-sm font-semibold ${(t.profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {(t.profit || 0) >= 0 ? '+' : ''}${formatMoney(t.profit || 0)}
                      </p>
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="admin">
                <Card><CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto">
                  {adminTx.length === 0 ? <p className="p-4 text-muted-foreground">Нет действий админов</p> : adminTx.map(t => (
                    <div key={t.id} className="p-3">
                      <p className="text-sm font-medium">⚙️ {t.action}</p>
                      <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
                      {t.details && <p className="text-xs font-mono mt-1 text-muted-foreground/70">{JSON.stringify(t.details)}</p>}
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>

              <TabsContent value="networth">
                <Card><CardContent className="p-0 divide-y max-h-[500px] overflow-y-auto">
                  {netWorthTx.length === 0 ? <p className="p-4 text-muted-foreground">История пока пуста — снимки накапливаются автоматически</p> : netWorthTx.map(t => (
                    <div key={t.id} className="p-3 flex justify-between">
                      <p className="text-xs text-muted-foreground">{new Date(t.recorded_at).toLocaleString()}</p>
                      <p className="font-mono-game text-sm font-semibold">${formatMoney(t.net_worth)}</p>
                    </div>
                  ))}
                </CardContent></Card>
              </TabsContent>
            </Tabs>
          )}
        </>
      )}
    </div>
  );
};

export default AdminTransactionsTab;
