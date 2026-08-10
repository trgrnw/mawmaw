import React, { useState, useEffect } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { shopItemsData, accessoryItemsData } from '@/data/shopData';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import LicensePlate, { type LicensePlateData } from '@/components/LicensePlate';
import GameIcon from '@/components/GameIcon';
import ProfileCustomization, { getBannerCss, getFrameClass } from '@/components/profile/ProfileCustomization';
import PlayerProfileDialog from '@/components/profile/PlayerProfileDialog';
import { toast } from 'sonner';
import { withTimeout } from '@/lib/async';

const COLORS = ['#87CEEB', '#ADD8E6', '#B0E0E6', '#5F9EA0', '#4682B4', '#6495ED', '#7EC8E3', '#00CED1'];

const SHOWCASE_CATEGORIES_KEYS = [
  { id: 'cars', i18n: 'profile.cat_car', icon: 'car' },
  { id: 'planes', i18n: 'profile.cat_plane', icon: 'plane' },
  { id: 'ships', i18n: 'profile.cat_ship', icon: 'ship' },
  { id: 'nft', i18n: 'profile.cat_nft', icon: 'nft' },
];

interface PlayerUsername {
  id: string;
  username: string;
  is_active: boolean;
}

interface SearchResult {
  user_id: string;
  username: string;
  avatar_emoji: string;
  avatar_url: string | null;
  player_id: number;
  net_worth: number | null;
  likes_count: number;
  avg_rating: number | null;
}

const ProfileTab: React.FC = () => {
  const {
    balance, netWorth, totalEarnedClick, totalEarnedBusiness, totalEarnedRent,
    totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
    shopItems, accessoryItems, businesses, clickPower,
    stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, licensePlates,
  } = useGame();
  const { user, avatarEmoji, avatarUrl, username } = useAuth();
  const { t } = useI18n();
  const [showcaseSelections, setShowcaseSelections] = useState<Record<string, string>>({});
  const [showcaseLoaded, setShowcaseLoaded] = useState(false);
  const [openPicker, setOpenPicker] = useState<string | null>(null);

  // Player info
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [myUsernames, setMyUsernames] = useState<PlayerUsername[]>([]);
  const [customization, setCustomization] = useState({ banner_url: 'default', frame_id: 'none', status_text: '' });
  const [customOpen, setCustomOpen] = useState(false);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Load player_id, usernames, customization, and showcase
  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('player_id, banner_url, frame_id, status_text, showcase_items')
        .eq('user_id', user.id)
        .single();
      if (profile?.player_id) setPlayerId(profile.player_id as number);
      if (profile) {
        setCustomization({
          banner_url: (profile as any).banner_url || 'default',
          frame_id: (profile as any).frame_id || 'none',
          status_text: (profile as any).status_text || '',
        });
        // Reconstruct selections from showcase_items
        const items = (profile as any).showcase_items as Array<{ cat: string; id: string }> | null;
        if (Array.isArray(items)) {
          const sel: Record<string, string> = {};
          items.forEach(it => { if (it?.cat && it?.id) sel[it.cat] = it.id; });
          setShowcaseSelections(sel);
        }
        setShowcaseLoaded(true);
      }

      const { data: unames } = await supabase
        .from('player_usernames')
        .select('id, username, is_active')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (unames) setMyUsernames(unames as PlayerUsername[]);
    };
    load();
  }, [user?.id]);

  const activeUsernames = myUsernames.filter(u => u.is_active);

  // Search players — single batched query via public_player_stats view
  const handleSearch = async () => {
    const q = searchQuery.trim().replace(/^@/, '');
    if (!q) return;
    setSearchLoading(true);
    setSearchCompleted(false);
    setSearchResults([]);
    try {
      const { data: stats, error } = await withTimeout(
        supabase.rpc('search_public_players' as any, { p_query: q }),
        8_000,
        'Поиск игроков занял слишком много времени',
      );
      if (error) throw error;
      const mapped = ((stats as any[]) || []).map((s: any) => ({
      user_id: s.user_id as string,
      username: (s.username as string) || 'Player',
      avatar_emoji: (s.avatar_emoji as string) || '👤',
      avatar_url: (s.avatar_url as string) || null,
      player_id: s.player_id as number,
      net_worth: (s.net_worth as number) ?? null,
      likes_count: (s.likes_count as number) ?? 0,
      avg_rating: (s.avg_rating as number) ?? null,
      }));
      setSearchResults(mapped);
      if (mapped.length === 0) toast.info('Игрок не найден');
      else toast.success(mapped.length === 1 ? 'Игрок найден' : `Найдено игроков: ${mapped.length}`);
    } catch (error) {
      console.error('[Profile] player search failed', error);
      toast.error(error instanceof Error ? error.message : 'Не удалось выполнить поиск игроков');
    } finally {
      setSearchLoading(false);
      setSearchCompleted(true);
    }
  };

  const shopPurchased = shopItems.filter(i => i.purchased);
  const accPurchased = accessoryItems.filter(i => i.purchased);

  const shopTotal = shopPurchased.reduce((s, i) => s + i.price, 0);
  const accTotal = accPurchased.reduce((s, i) => s + i.price, 0);
  const businessTotal = businesses.reduce((s, b) => s + b.investmentCost, 0);
  const realEstate = shopPurchased.filter(i => i.category === 'realestate').reduce((s, i) => s + i.price, 0);
  const transport = shopPurchased.filter(i => ['cars', 'ships', 'planes'].includes(i.category)).reduce((s, i) => s + i.price, 0);
  const stockValue = stockHoldings.reduce((s, h) => s + (stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
  const cryptoValue = cryptoHoldings.reduce((s, h) => s + (cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);

  const chartData = [
    { name: t('profile.stat_balance'), value: balance },
    { name: t('profile.stat_business'), value: businessTotal },
    { name: t('profile.stat_stocks'), value: stockValue },
    { name: t('profile.stat_realestate'), value: realEstate },
    { name: t('profile.stat_transport'), value: transport },
    { name: t('profile.stat_collections'), value: accTotal },
    { name: t('profile.stat_crypto'), value: cryptoValue },
  ].filter(d => d.value > 0);

  const getShowcaseItems = (catId: string) => {
    if (catId === 'nft') return accPurchased.filter(i => i.category === 'nft');
    return shopPurchased.filter(i => i.category === catId);
  };

  const getSelectedShowcase = (catId: string) => {
    const items = getShowcaseItems(catId);
    if (items.length === 0) return null;
    const selectedId = showcaseSelections[catId];
    if (selectedId) {
      const found = items.find(i => i.id === selectedId);
      if (found) return found;
    }
    return items[items.length - 1];
  };

  // Sync showcase selections to DB so other players see the same selection.
  // Builds a snapshot per category from current selections + owned items.
  useEffect(() => {
    if (!user?.id || !showcaseLoaded) return;
    const snapshot = SHOWCASE_CATEGORIES_KEYS.map(cat => {
      const sel = getSelectedShowcase(cat.id);
      if (!sel) return null;
      const data = [...shopItemsData, ...accessoryItemsData].find(d => d.id === sel.id);
      return { cat: cat.id, id: sel.id, name: sel.name, image: data?.image || '' };
    }).filter(Boolean);
    const handle = setTimeout(() => {
      supabase.rpc('update_profile_extras', {
        p_avatar_url: null,
        p_showcase: snapshot as any,
      });
    }, 600);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showcaseSelections, shopItems, accessoryItems, showcaseLoaded, user?.id]);

  const countByCategory = (cat: string) => shopPurchased.filter(i => i.category === cat).length;
  const nftCount = accPurchased.filter(i => i.category === 'nft').length;

  const stats = [
    { label: t('profile.stat_networth'), value: `$${formatMoney(netWorth)}`, icon: 'wallet' },
    { label: t('profile.stat_balance'), value: `$${formatMoney(balance)}`, icon: 'balance' },
    { label: t('profile.stat_business'), value: `$${formatMoney(businessTotal)}`, icon: 'business' },
    { label: t('profile.stat_stocks'), value: `$${formatMoney(stockValue)}`, icon: 'stocks' },
    { label: t('profile.stat_realestate'), value: `$${formatMoney(realEstate)}`, icon: 'rent' },
    { label: t('profile.stat_transport'), value: `$${formatMoney(transport)}`, icon: 'car' },
    { label: t('profile.stat_collections'), value: `$${formatMoney(accTotal)}`, icon: 'diamond' },
    { label: t('profile.stat_crypto'), value: `$${formatMoney(cryptoValue)}`, icon: 'crypto' },
  ];

  const counts = [
    { label: t('profile.cnt_businesses'), value: businesses.length },
    { label: t('profile.cnt_realestate'), value: countByCategory('realestate') },
    { label: t('profile.cnt_cars'), value: countByCategory('cars') },
    { label: t('profile.cnt_ships'), value: countByCategory('ships') },
    { label: t('profile.cnt_planes'), value: countByCategory('planes') },
    { label: t('profile.cnt_collectibles'), value: accPurchased.length },
    { label: t('profile.cnt_islands'), value: countByCategory('islands') },
    { label: t('profile.cnt_nft'), value: nftCount },
  ];

  const earnings = [
    { label: t('profile.earn_click'), value: totalEarnedClick },
    { label: t('profile.earn_business'), value: totalEarnedBusiness },
    { label: t('profile.earn_rent'), value: totalEarnedRent },
    { label: t('profile.earn_dividends'), value: totalEarnedDividends },
    { label: t('profile.earn_trading'), value: totalEarnedTrading },
    { label: t('profile.earn_crypto'), value: totalEarnedCrypto },
    { label: t('profile.earn_gems'), value: totalEarnedGems },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="profile" size={24} themed /> {t('profile.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('profile.clickPower')}: <span className="font-mono-game font-semibold text-foreground">${formatMoney(clickPower)}</span></p>
      </div>

      {/* Customizable Profile Header */}
      {user && (
        <div className="rounded-2xl overflow-hidden border bg-card relative">
          <div className="h-32 relative" style={{ background: getBannerCss(customization.banner_url) }}>
            <button
              onClick={() => setCustomOpen(true)}
              className="absolute top-3 right-3 px-3 py-1.5 bg-black/40 hover:bg-black/60 backdrop-blur text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              ✏️ Кастомизация
            </button>
            <div className="absolute -bottom-10 left-5">
              <div className={`w-20 h-20 rounded-full bg-card border-4 border-card flex items-center justify-center text-4xl overflow-hidden ${getFrameClass(customization.frame_id)}`}>
                {avatarUrl ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : avatarEmoji}
              </div>
            </div>
          </div>
          <div className="pt-12 pb-4 px-5 space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <h3 className="text-lg font-bold text-foreground">{username}</h3>
              {playerId && <span className="text-xs text-muted-foreground font-mono">#{playerId.toLocaleString()}</span>}
            </div>
            {customization.status_text && (
              <p className="text-sm text-muted-foreground italic">"{customization.status_text}"</p>
            )}
            {activeUsernames.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeUsernames.map(u => (
                  <span key={u.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-medium">
                    @{u.username}
                  </span>
                ))}
              </div>
            )}
            {myUsernames.length > 0 && activeUsernames.length < myUsernames.length && (
              <p className="text-[10px] text-muted-foreground">
                {t('profile.usernames_count')}: {myUsernames.length}/25 • {t('profile.active_count')}: {activeUsernames.length}/15
              </p>
            )}
          </div>
        </div>
      )}

      <ProfileCustomization
        open={customOpen}
        onClose={() => setCustomOpen(false)}
        current={customization}
        onSaved={setCustomization}
      />

      {/* Player Search */}
      {user && (
        <div className="bg-card rounded-2xl border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><GameIcon name="search" size={16} themed /> {t('profile.search')}</h3>
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder={t('profile.search_placeholder')}
              className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <button
              onClick={handleSearch}
              disabled={searchLoading || !searchQuery.trim()}
              className="rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {searchLoading ? '...' : t('profile.find')}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="divide-y border rounded-xl overflow-hidden">
              {searchResults.map(r => (
                <button
                  key={r.user_id}
                  onClick={() => setSelectedUserId(r.user_id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 text-left transition-colors"
                >
                  {r.avatar_url ? (
                    <img src={r.avatar_url} alt={r.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="text-2xl flex-shrink-0">{r.avatar_emoji}</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.username}</p>
                    <p className="text-[10px] text-muted-foreground">
                      ID: {r.player_id?.toLocaleString()} · ❤ {r.likes_count}
                      {r.avg_rating != null && ` · ⭐ ${r.avg_rating}`}
                    </p>
                  </div>
                  {r.net_worth != null && (
                    <span className="font-mono-game text-xs text-foreground">${formatMoney(r.net_worth)}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          {searchCompleted && !searchLoading && searchResults.length === 0 && (
            <p className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">Игрок не найден</p>
          )}
        </div>
      )}

      <PlayerProfileDialog userId={selectedUserId} onClose={() => setSelectedUserId(null)} />

      {/* Showcase */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('profile.showcase')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SHOWCASE_CATEGORIES_KEYS.map(cat => {
            const selected = getSelectedShowcase(cat.id);
            const items = getShowcaseItems(cat.id);
            const isOpen = openPicker === cat.id;

            const itemData = selected ? [...shopItemsData, ...accessoryItemsData].find(d => d.id === selected.id) : null;
            const carPlate = (cat.id === 'cars' && selected) ? licensePlates.find(p => p.assignedTo === selected.id) : null;
            return (
              <div key={cat.id} className="relative">
                <button
                  onClick={() => items.length > 1 ? setOpenPicker(isOpen ? null : cat.id) : undefined}
                  className="w-full bg-card rounded-xl border overflow-hidden text-center transition-all hover:border-primary/50"
                >
                  {itemData?.image ? (
                    <div className="aspect-square relative overflow-hidden">
                      <img src={itemData.image} alt={selected?.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                      {carPlate && (
                        <div className="absolute top-1.5 right-1.5">
                          <LicensePlate plate={carPlate as LicensePlateData} size="sm" />
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-[10px] text-white/70">{t(cat.i18n)}</p>
                        <p className="font-mono-game text-[11px] font-semibold text-white truncate">{selected?.name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3">
                      <span className="block mb-1"><GameIcon name={cat.icon} size={32} themed /></span>
                      <p className="text-xs text-muted-foreground">{t(cat.i18n)}</p>
                      <p className="font-mono-game text-xs font-semibold text-foreground truncate">—</p>
                    </div>
                  )}
                  {items.length > 1 && (
                    <p className="text-[10px] text-primary py-1">{t('profile.select')}</p>
                  )}
                </button>

                {isOpen && items.length > 1 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-card border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {items.map(item => (
                      <button
                        key={item.id}
                        onClick={() => {
                          setShowcaseSelections(prev => ({ ...prev, [cat.id]: item.id }));
                          setOpenPicker(null);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted/50 flex items-center gap-2 ${
                          showcaseSelections[cat.id] === item.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <span className="truncate">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="bg-card rounded-2xl border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">{t('profile.assets')}</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${formatMoney(v)}`} />
              <Tooltip formatter={(v: number) => `$${formatMoney(v)}`} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('profile.summary')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(s => (
            <div key={s.label} className="stat-card rounded-xl p-3 text-center">
              <GameIcon name={s.icon} size={24} themed />
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              <p className="font-mono-game text-sm font-semibold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Counts */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('profile.counts')}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {counts.map(c => (
            <div key={c.label} className="bg-card rounded-xl border p-3 text-center">
              <p className="font-mono-game text-lg font-bold text-foreground">{c.value}</p>
              <p className="text-xs text-muted-foreground">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Earnings breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">{t('profile.earned')}</h3>
        <div className="bg-card rounded-xl border divide-y">
          {earnings.map(e => (
            <div key={e.label} className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">{e.label}</span>
              <span className="font-mono-game text-sm font-semibold text-foreground">${formatMoney(e.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProfileTab;
