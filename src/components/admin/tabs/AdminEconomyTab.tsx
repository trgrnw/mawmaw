import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/game/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type Summary = { players: number; balance: number; worth: number; pending: number; businesses: number; assets: number; activeDay: number };

export default function AdminEconomyTab() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const total: Summary = { players: 0, balance: 0, worth: 0, pending: 0, businesses: 0, assets: 0, activeDay: 0 };
      // Paginate rather than silently reporting only Supabase's first 1000 rows.
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('game_saves')
          .select('user_id, game_state, net_worth, pending_balance, last_seen_at')
          .order('user_id').range(offset, offset + 499);
        if (error) throw error;
        for (const row of data || []) {
          const state = row.game_state as { balance?: number; businesses?: unknown[]; purchasedShop?: unknown[]; purchasedAccessories?: unknown[] } | null;
          total.players++;
          total.balance += Number(state?.balance || 0);
          total.worth += Number(row.net_worth || 0);
          total.pending += Number(row.pending_balance || 0);
          total.businesses += state?.businesses?.length || 0;
          total.assets += (state?.purchasedShop?.length || 0) + (state?.purchasedAccessories?.length || 0);
          if (row.last_seen_at && Date.now() - Date.parse(row.last_seen_at) < 86400000) total.activeDay++;
        }
        if (!data || data.length < 500) break;
      }
      setSummary(total);
    } catch (error) { setError(error instanceof Error ? error.message : 'Не удалось загрузить экономику'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const metrics = summary ? [
    ['Сохранений игроков', String(summary.players)], ['Активны за 24 часа', String(summary.activeDay)],
    ['Деньги на балансах', `$${formatMoney(summary.balance)}`], ['Совокупное состояние', `$${formatMoney(summary.worth)}`],
    ['Ожидающие начисления', `$${formatMoney(summary.pending)}`], ['Предприятий', String(summary.businesses)], ['Купленных предметов', String(summary.assets)],
  ] : [];
  return <div className="space-y-5"><div className="flex items-center justify-between gap-3"><h2 className="text-2xl font-bold">Экономика игры</h2><Button variant="outline" disabled={loading} onClick={load}>{loading ? 'Загрузка…' : 'Обновить'}</Button></div>
    <p className="text-sm text-muted-foreground">Показатели по сохранённому прогрессу игроков. Для изменения баланса откройте раздел «Игроки».</p>
    {error && <div role="alert" className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive">{error}</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{metrics.map(([label, value]) => <Card key={label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader><CardContent><p className="break-words font-mono-game text-xl font-bold">{value}</p></CardContent></Card>)}</div>
  </div>;
}
