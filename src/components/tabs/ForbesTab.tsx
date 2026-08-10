import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import GameIcon from '@/components/GameIcon';
import { Loader2 } from 'lucide-react';

interface ForbesEntry {
  user_id: string;
  username: string | null;
  avatar_emoji: string | null;
  player_id: number | null;
  net_worth: number | null;
  updated_at: string | null;
}
interface ClanEntry {
  id: string;
  name: string;
  tag: string;
  emoji: string;
  member_count: number;
  total_net_worth: number;
  owner_name: string;
}

type ScopeType = 'players' | 'clans' | 'friends';
type PeriodType = 'all' | 'day' | 'week' | 'month';
type RegionType = 'global' | 'europe' | 'asia';

const MEDAL_COLORS = ['hsl(45 93% 47%)', 'hsl(210 10% 65%)', 'hsl(25 70% 50%)'];

const ForbesTab: React.FC = () => {
  const { t } = useI18n();
  const [scope, setScope] = useState<ScopeType>('players');
  const [period, setPeriod] = useState<PeriodType>('all');
  const [region, setRegion] = useState<RegionType>('global');
  const [entries, setEntries] = useState<ForbesEntry[]>([]);
  const [clans, setClans] = useState<ClanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const fetchData = async () => {
      if (!initialLoadDone.current) setLoading(true);
      setError('');
      try {
        if (scope === 'clans') {
          const { data, error: queryError } = await supabase.from('clan_leaderboard').select('*').order('total_net_worth', { ascending: false }).limit(100);
          if (queryError) throw queryError;
          setClans((data as any) || []);
        } else if (scope === 'players') {
          const { data, error: queryError } = await supabase.rpc('get_forbes_players' as any);
          if (queryError) throw queryError;
          setEntries((data as unknown as ForbesEntry[]) || []);
        } else {
          setEntries([]);
        }
      } catch (fetchError) {
        console.error('[Forbes] load failed', fetchError);
        setError('Не удалось загрузить рейтинг. Попробуйте ещё раз.');
      } finally {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [scope, period, region, refreshKey]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="forbes" size={24} themed />
          {t('forbes.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('forbes.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <FilterGroup label="Что" value={scope} onChange={v => setScope(v as ScopeType)} options={[
          { value: 'players', label: '👥 Игроки' },
          { value: 'clans', label: '🛡️ Кланы' },
          { value: 'friends', label: '⭐ Друзья' },
        ]} />
        <FilterGroup label="Период" value={period} onChange={v => setPeriod(v as PeriodType)} options={[
          { value: 'all', label: 'Всё время' },
          { value: 'day', label: 'День' },
          { value: 'week', label: 'Неделя' },
          { value: 'month', label: 'Месяц' },
        ]} />
        <FilterGroup label="Регион" value={region} onChange={v => setRegion(v as RegionType)} options={[
          { value: 'global', label: '🌍 Глобально' },
          { value: 'europe', label: '🇪🇺 Европа' },
          { value: 'asia', label: '🌏 Азия' },
        ]} />
      </div>
      {(period !== 'all' || region !== 'global' || scope === 'friends') && (
        <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-2">
          ℹ️ {scope === 'friends' ? 'Система друзей будет добавлена позже' : 'Фильтр применится после интеграции Steam API'}
        </p>
      )}

      {error ? (
        <div className="stat-card rounded-2xl p-8 text-center min-h-[200px] flex flex-col items-center justify-center gap-3">
          <GameIcon name="empty" size={48} className="text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
          <button onClick={() => { initialLoadDone.current = false; setRefreshKey(key => key + 1); }} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground">
            Повторить
          </button>
        </div>
      ) : loading ? (
        <div className="stat-card rounded-2xl p-8 flex items-center justify-center min-h-[200px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : scope === 'clans' ? (
        clans.length === 0 ? (
          <EmptyState text="Кланов ещё нет" />
        ) : (
          <div className="bg-card rounded-2xl border overflow-hidden">
            <div className="grid grid-cols-[3rem_1fr_auto] gap-2 px-4 py-3 bg-muted/30 text-xs font-semibold text-muted-foreground">
              <span>Ранг</span><span>Клан</span><span>Состояние</span>
            </div>
            <div className="divide-y">
              {clans.map((c, i) => (
                <div key={c.id} className="grid grid-cols-[3rem_1fr_auto] gap-2 px-4 py-3 items-center">
                  <span className="text-sm font-bold">{i < 3 ? <GameIcon name="forbes" size={20} color={MEDAL_COLORS[i]} /> : i + 1}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xl">{c.emoji}</span>
                    <div className="min-w-0">
                      <span className="text-sm font-medium truncate block">[{c.tag}] {c.name}</span>
                      <span className="text-[10px] text-muted-foreground">{c.member_count} уч. · {c.owner_name}</span>
                    </div>
                  </div>
                  <span className="font-mono-game text-sm font-semibold">${formatMoney(c.total_net_worth)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      ) : scope === 'friends' ? (
        <EmptyState text="Добавьте друзей, чтобы видеть их в этом списке (скоро)" />
      ) : entries.length === 0 ? (
        <EmptyState text={t('forbes.empty')} />
      ) : (
        <div className="bg-card rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-[3rem_1fr_auto] gap-2 px-4 py-3 bg-muted/30 text-xs font-semibold text-muted-foreground">
            <span>{t('forbes.rank')}</span>
            <span>{t('forbes.player')}</span>
            <span>{t('forbes.networth')}</span>
          </div>
          <div className="divide-y">
            {entries.map((e, i) => (
              <div key={`${e.player_id ?? i}`} className="grid grid-cols-[3rem_1fr_auto] gap-2 px-4 py-3 items-center">
                <span className="text-sm font-bold">{i < 3 ? <GameIcon name="forbes" size={20} color={MEDAL_COLORS[i]} /> : i + 1}</span>
                <div className="flex items-center gap-2 min-w-0">
                  <GameIcon name="profile" size={20} className="text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate block">{e.username || 'Player'}</span>
                    {e.player_id && <span className="text-[10px] text-muted-foreground">ID: {e.player_id.toLocaleString()}</span>}
                  </div>
                </div>
                <span className="font-mono-game text-sm font-semibold">${formatMoney(e.net_worth ?? 0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const FilterGroup: React.FC<{ label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }> = ({ label, value, onChange, options }) => (
  <div className="flex flex-col gap-1">
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</span>
    <div className="flex bg-muted/40 rounded-lg p-0.5">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 text-xs rounded-md transition-colors ${value === o.value ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}>
          {o.label}
        </button>
      ))}
    </div>
  </div>
);

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="stat-card rounded-2xl p-8 flex flex-col items-center justify-center min-h-[200px]">
    <GameIcon name="empty" size={48} className="text-muted-foreground mb-3" />
    <p className="text-muted-foreground">{text}</p>
  </div>
);

export default ForbesTab;
