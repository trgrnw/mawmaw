import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/i18n/I18nContext';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import GameIcon from '@/components/GameIcon';
import LicensePlate, { type LicensePlateData, PLATE_COUNTRIES } from '@/components/LicensePlate';

interface MarketListing {
  id: string;
  seller_id: string;
  buyer_id?: string | null;
  item_type: 'username' | 'license_plate';
  item_data: Record<string, unknown>;
  price: number;
  status: string;
  created_at: string;
  sold_at?: string | null;
  seller_username?: string;
  // Auction fields
  listing_kind: 'fixed' | 'auction';
  auction_ends_at?: string | null;
  min_bid?: number | null;
  current_bid?: number | null;
  current_bidder_id?: string | null;
  bid_count: number;
}

type Tab = 'browse' | 'auctions' | 'mine' | 'history' | 'favorites';
type FilterType = 'all' | 'username' | 'license_plate';
type SortType = 'newest' | 'oldest' | 'cheapest' | 'expensive' | 'ending_soon';

const AUCTION_DURATIONS = [1, 6, 12, 24, 48];

const MarketTab: React.FC = () => {
  const { balance, spendBalance, addLicensePlate, licensePlates } = useGame();
  const { user } = useAuth();
  const { t } = useI18n();

  const [tab, setTab] = useState<Tab>('browse');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [history, setHistory] = useState<MarketListing[]>([]);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Sell dialogs
  const [sellOpen, setSellOpen] = useState<null | 'username' | 'license_plate'>(null);
  const [sellKind, setSellKind] = useState<'fixed' | 'auction'>('fixed');
  const [sellPrice, setSellPrice] = useState('');
  const [auctionDuration, setAuctionDuration] = useState(24);
  const [selectedSellId, setSelectedSellId] = useState<string | null>(null);
  const [myUsernames, setMyUsernames] = useState<{ id: string; username: string }[]>([]);

  // Buy/Bid dialogs
  const [buyDialogOpen, setBuyDialogOpen] = useState(false);
  const [bidDialogOpen, setBidDialogOpen] = useState(false);
  const [bidAmount, setBidAmount] = useState('');
  const [selectedListing, setSelectedListing] = useState<MarketListing | null>(null);
  const [bidsHistory, setBidsHistory] = useState<{ bidder_name: string; amount: number; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const initialLoadDone = useRef(false);

  // ── Load data ──
  const loadAll = useCallback(async () => {
    if (!initialLoadDone.current) setLoading(true);

    // Active listings
    const { data: ldata } = await supabase
      .from('market_listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(300);

    // History (mine: sold + cancelled where I'm seller or buyer)
    let hdata: any[] = [];
    if (user?.id) {
      const { data } = await supabase
        .from('market_listings')
        .select('*')
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .in('status', ['sold', 'cancelled'])
        .order('sold_at', { ascending: false, nullsFirst: false })
        .limit(100);
      hdata = data || [];
    }

    // Favorites
    if (user?.id) {
      const { data: fdata } = await supabase
        .from('market_favorites')
        .select('listing_id')
        .eq('user_id', user.id);
      setFavorites(new Set((fdata || []).map((f: any) => f.listing_id)));
    }

    // Resolve seller usernames
    const allRows = [...(ldata || []), ...hdata];
    const sellerIds = [...new Set(allRows.map((d: any) => d.seller_id))];
    const profileMap = new Map<string, string>();
    if (sellerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username')
        .in('user_id', sellerIds);
      (profiles || []).forEach((p: any) => profileMap.set(p.user_id, p.username));
    }

    const enrich = (d: any): MarketListing => ({
      ...d,
      item_data: d.item_data as Record<string, unknown>,
      seller_username: profileMap.get(d.seller_id) || 'Player',
    });
    setListings((ldata || []).map(enrich));
    setHistory(hdata.map(enrich));
    setLoading(false);
    initialLoadDone.current = true;
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Poll every 4s + finalize expired auctions every 15s
  useEffect(() => {
    const i1 = setInterval(loadAll, 4000);
    const i2 = setInterval(() => {
      supabase.rpc('finalize_expired_auctions' as any).then(() => {});
    }, 15000);
    return () => { clearInterval(i1); clearInterval(i2); };
  }, [loadAll]);

  // Load my usernames when sell dialog opens
  useEffect(() => {
    if (!user?.id || sellOpen !== 'username') return;
    supabase.from('player_usernames').select('id, username').eq('user_id', user.id)
      .then(({ data }) => { if (data) setMyUsernames(data); });
  }, [user?.id, sellOpen]);

  // ── Filtering / Sorting per tab ──
  const visibleListings = (() => {
    let src: MarketListing[] = [];
    if (tab === 'browse') src = listings.filter(l => l.listing_kind === 'fixed');
    else if (tab === 'auctions') src = listings.filter(l => l.listing_kind === 'auction');
    else if (tab === 'mine') src = listings.filter(l => l.seller_id === user?.id);
    else if (tab === 'history') src = history;
    else if (tab === 'favorites') src = listings.filter(l => favorites.has(l.id));

    return src
      .filter(l => {
        if (filterType !== 'all' && l.item_type !== filterType) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const data = l.item_data as any;
          const text = l.item_type === 'username' ? (data.username || '') : (data.text || '');
          return String(text).toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (sortType === 'cheapest') return a.price - b.price;
        if (sortType === 'expensive') return b.price - a.price;
        if (sortType === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        if (sortType === 'ending_soon' && a.auction_ends_at && b.auction_ends_at) {
          return new Date(a.auction_ends_at).getTime() - new Date(b.auction_ends_at).getTime();
        }
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
  })();

  // ── Actions ──
  const handleListFixed = async () => {
    if (!user?.id || !selectedSellId || !sellPrice) return;
    const price = parseFloat(sellPrice);
    if (isNaN(price) || price <= 0) return;
    setBusy(true); setErrorMsg(null);
    try {
      let item_data: any;
      if (sellOpen === 'username') {
        const u = myUsernames.find(x => x.id === selectedSellId);
        if (!u) return;
        item_data = { username_id: u.id, username: u.username };
        await supabase.from('player_usernames').update({ is_active: false }).eq('id', u.id);
      } else {
        const p = licensePlates.find(x => x.id === selectedSellId);
        if (!p) return;
        item_data = { plate_id: p.id, text: p.text, country: p.country, isCustom: p.isCustom };
      }
      const { error } = await supabase.from('market_listings').insert({
        seller_id: user.id,
        item_type: sellOpen!,
        item_data,
        price,
        listing_kind: 'fixed',
      } as any);
      if (error) throw error;
      closeSell();
      loadAll();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error');
    } finally { setBusy(false); }
  };

  const handleListAuction = async () => {
    if (!user?.id || !selectedSellId || !sellPrice) return;
    const minBid = parseFloat(sellPrice);
    if (isNaN(minBid) || minBid <= 0) return;
    setBusy(true); setErrorMsg(null);
    try {
      let item_data: any;
      if (sellOpen === 'username') {
        const u = myUsernames.find(x => x.id === selectedSellId);
        if (!u) return;
        item_data = { username_id: u.id, username: u.username };
        await supabase.from('player_usernames').update({ is_active: false }).eq('id', u.id);
      } else {
        const p = licensePlates.find(x => x.id === selectedSellId);
        if (!p) return;
        item_data = { plate_id: p.id, text: p.text, country: p.country, isCustom: p.isCustom };
      }
      const { error } = await supabase.rpc('create_auction_listing' as any, {
        p_item_type: sellOpen,
        p_item_data: item_data,
        p_min_bid: minBid,
        p_duration_hours: auctionDuration,
      });
      if (error) throw error;
      closeSell();
      loadAll();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error');
    } finally { setBusy(false); }
  };

  const closeSell = () => {
    setSellOpen(null); setSellPrice(''); setSelectedSellId(null);
    setSellKind('fixed'); setAuctionDuration(24); setErrorMsg(null);
  };

  const handleBuy = async () => {
    if (!user?.id || !selectedListing || busy) return;
    if (selectedListing.seller_id === user.id) return;
    if (balance < selectedListing.price) return;
    setBusy(true); setErrorMsg(null);
    try {
      const { error } = await supabase.rpc('buy_market_listing', { p_listing_id: selectedListing.id });
      if (error) throw error;
      spendBalance(selectedListing.price);
      if (selectedListing.item_type === 'license_plate') {
        const d = selectedListing.item_data as any;
        addLicensePlate({
          id: `plate-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          text: d.text, country: d.country, assignedTo: null, isCustom: d.isCustom || false,
        });
      }
      setBuyDialogOpen(false); setSelectedListing(null);
      loadAll();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error');
    } finally { setBusy(false); }
  };

  const handleBid = async () => {
    if (!user?.id || !selectedListing || busy) return;
    const amt = parseFloat(bidAmount);
    if (isNaN(amt) || amt <= 0) return;
    setBusy(true); setErrorMsg(null);
    try {
      const { error } = await supabase.rpc('place_bid' as any, { p_listing_id: selectedListing.id, p_amount: amt });
      if (error) throw error;
      setBidDialogOpen(false); setSelectedListing(null); setBidAmount('');
      loadAll();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error');
    } finally { setBusy(false); }
  };

  const handleCancel = async (l: MarketListing) => {
    if (l.listing_kind === 'auction') {
      const { error } = await supabase.rpc('cancel_auction' as any, { p_listing_id: l.id });
      if (error) { alert(error.message); return; }
    } else {
      await supabase.from('market_listings').update({ status: 'cancelled' }).eq('id', l.id);
      if (l.item_type === 'username') {
        await supabase.from('player_usernames').update({ is_active: false }).eq('id', (l.item_data as any).username_id);
      }
    }
    loadAll();
  };

  const toggleFavorite = async (listingId: string) => {
    if (!user?.id) return;
    if (favorites.has(listingId)) {
      await supabase.from('market_favorites').delete().eq('user_id', user.id).eq('listing_id', listingId);
      setFavorites(s => { const n = new Set(s); n.delete(listingId); return n; });
    } else {
      await supabase.from('market_favorites').insert({ user_id: user.id, listing_id: listingId } as any);
      setFavorites(s => new Set(s).add(listingId));
    }
  };

  const openBuyDialog = (l: MarketListing) => { setSelectedListing(l); setBuyDialogOpen(true); setErrorMsg(null); };
  const openBidDialog = async (l: MarketListing) => {
    setSelectedListing(l);
    const minNext = (l.current_bid ?? l.min_bid ?? 0) + (l.current_bid ? Math.max(l.current_bid * 0.05, 1) : 0);
    setBidAmount(String(Math.ceil(Math.max(l.min_bid || 0, minNext))));
    setBidDialogOpen(true); setErrorMsg(null);
    const { data } = await supabase.from('market_bids').select('bidder_name, amount, created_at')
      .eq('listing_id', l.id).order('created_at', { ascending: false }).limit(20);
    setBidsHistory((data as any) || []);
  };

  // ── Tabs ──
  const tabs: { id: Tab; label: string; icon: string; needAuth?: boolean }[] = [
    { id: 'browse', label: 'Покупка', icon: 'shop' },
    { id: 'auctions', label: 'Аукционы', icon: 'forbes' },
    { id: 'mine', label: 'Мои лоты', icon: 'tag', needAuth: true },
    { id: 'history', label: 'История', icon: 'star', needAuth: true },
    { id: 'favorites', label: 'Избранное', icon: 'star', needAuth: true },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <GameIcon name="shop" size={24} themed /> {t('market.title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('market.subtitle')}</p>
      </div>

      {/* Sell buttons */}
      {user && (
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => { setSellOpen('username'); setSellKind('fixed'); setSellPrice(''); setSelectedSellId(null); }}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all">
            <GameIcon name="tag" size={16} /> {t('market.sell_username')}
          </button>
          <button onClick={() => { setSellOpen('license_plate'); setSellKind('fixed'); setSellPrice(''); setSelectedSellId(null); }}
            className="flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 active:scale-[0.98] transition-all">
            <GameIcon name="plate" size={16} /> {t('market.sell_plate')}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-border pb-2">
        {tabs.map(tb => {
          if (tb.needAuth && !user) return null;
          const active = tab === tb.id;
          return (
            <button key={tb.id} onClick={() => setTab(tb.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}>
              <GameIcon name={tb.icon} size={14} /> {tb.label}
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border p-4 space-y-3">
        <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('market.search')}
          className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50" />

        <div className="flex flex-wrap gap-2">
          {([
            { id: 'all' as FilterType, label: t('market.filter_all'), icon: 'shop' },
            { id: 'username' as FilterType, label: t('market.filter_usernames'), icon: 'tag' },
            { id: 'license_plate' as FilterType, label: t('market.filter_plates'), icon: 'plate' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterType === f.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}>
              <GameIcon name={f.icon} size={12} /> {f.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            { id: 'newest' as SortType, label: t('market.sort_newest') },
            { id: 'oldest' as SortType, label: 'Старые' },
            { id: 'cheapest' as SortType, label: t('market.sort_cheapest') },
            { id: 'expensive' as SortType, label: t('market.sort_expensive') },
            ...(tab === 'auctions' ? [{ id: 'ending_soon' as SortType, label: 'Скоро финал' }] : []),
          ]).map(s => (
            <button key={s.id} onClick={() => setSortType(s.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sortType === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted/50'
              }`}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Listings grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{t('market.loading')}</div>
      ) : visibleListings.length === 0 ? (
        <div className="text-center py-16">
          <GameIcon name="shop" size={48} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">{t('market.empty')}</p>
          <p className="text-muted-foreground/60 text-xs mt-1">{t('market.empty_hint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleListings.map(listing => (
            <ListingCard
              key={listing.id}
              listing={listing}
              userId={user?.id}
              balance={balance}
              isFavorite={favorites.has(listing.id)}
              isHistory={tab === 'history'}
              onBuy={() => openBuyDialog(listing)}
              onBid={() => openBidDialog(listing)}
              onCancel={() => handleCancel(listing)}
              onToggleFavorite={() => toggleFavorite(listing.id)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Sell dialog */}
      <Dialog open={!!sellOpen} onOpenChange={o => !o && closeSell()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{sellOpen === 'username' ? t('market.sell_username_title') : t('market.sell_plate_title')}</DialogTitle>
            <DialogDescription>{sellOpen === 'username' ? t('market.sell_username_desc') : t('market.sell_plate_desc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Kind toggle */}
            <div className="flex gap-2 bg-muted/40 p-1 rounded-lg">
              {(['fixed', 'auction'] as const).map(k => (
                <button key={k} onClick={() => setSellKind(k)}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    sellKind === k ? 'bg-background shadow-sm' : 'text-muted-foreground'
                  }`}>{k === 'fixed' ? '💰 Фикс. цена' : '⚖️ Аукцион'}</button>
              ))}
            </div>

            {/* Item picker */}
            {sellOpen === 'username' ? (
              myUsernames.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('market.no_usernames')}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {myUsernames.map(u => (
                    <button key={u.id} onClick={() => setSelectedSellId(u.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        selectedSellId === u.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}>
                      <GameIcon name="tag" size={16} themed />
                      <span className="text-sm font-medium">@{u.username}</span>
                      {selectedSellId === u.id && <span className="ml-auto text-primary text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )
            ) : (
              licensePlates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">{t('market.no_plates')}</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {licensePlates.map(p => (
                    <button key={p.id} onClick={() => setSelectedSellId(p.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                        selectedSellId === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                      }`}>
                      <LicensePlate plate={p as LicensePlateData} size="sm" />
                      <span className="text-xs text-muted-foreground">{p.isCustom ? t('market.custom') : t('market.random')}</span>
                      {selectedSellId === p.id && <span className="ml-auto text-primary text-xs">✓</span>}
                    </button>
                  ))}
                </div>
              )
            )}

            {sellKind === 'auction' && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Длительность аукциона</label>
                <div className="flex gap-1.5">
                  {AUCTION_DURATIONS.map(h => (
                    <button key={h} onClick={() => setAuctionDuration(h)}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        auctionDuration === h ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                      }`}>{h}ч</button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {sellKind === 'fixed' ? t('market.sell_price') : 'Минимальная ставка ($)'}
              </label>
              <input type="number" value={sellPrice} onChange={e => setSellPrice(e.target.value)}
                placeholder="10000" min="1"
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono-game" />
            </div>

            {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}

            <button onClick={sellKind === 'fixed' ? handleListFixed : handleListAuction}
              disabled={!selectedSellId || !sellPrice || parseFloat(sellPrice) <= 0 || busy}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {busy ? '...' : t('market.list_for_sale')}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Buy dialog */}
      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('market.buy_confirm_title')}</DialogTitle>
            <DialogDescription>{t('market.buy_confirm_desc')}</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <ItemPreview listing={selectedListing} t={t} />
              <div className="space-y-2">
                <Row label={t('market.seller')} value={selectedListing.seller_username || ''} />
                <Row label={t('market.price')} value={`$${formatMoney(selectedListing.price)}`} bold />
                <Row label={t('market.your_balance')} value={`$${formatMoney(balance)}`} muted />
              </div>
              {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
              <button onClick={handleBuy} disabled={balance < selectedListing.price || busy}
                className={`w-full rounded-xl py-2.5 text-sm font-semibold transition-all ${
                  balance >= selectedListing.price && !busy
                    ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]'
                    : 'bg-muted text-muted-foreground cursor-not-allowed'
                }`}>{busy ? '...' : t('market.confirm_buy')}</button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bid dialog */}
      <Dialog open={bidDialogOpen} onOpenChange={setBidDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Сделать ставку</DialogTitle>
            <DialogDescription>Деньги резервируются до окончания аукциона</DialogDescription>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <ItemPreview listing={selectedListing} t={t} />
              <div className="space-y-2">
                <Row label="Текущая ставка" value={selectedListing.current_bid ? `$${formatMoney(selectedListing.current_bid)}` : 'Нет ставок'} bold />
                <Row label="Мин. след. ставка" value={`$${formatMoney(Math.max(selectedListing.min_bid || 0, (selectedListing.current_bid ?? 0) + (selectedListing.current_bid ? Math.max(selectedListing.current_bid * 0.05, 1) : 0)))}`} />
                <Row label="Окончание" value={selectedListing.auction_ends_at ? <Countdown to={selectedListing.auction_ends_at} /> as any : ''} />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ваша ставка ($)</label>
                <input type="number" value={bidAmount} onChange={e => setBidAmount(e.target.value)} min="1"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm font-mono-game focus:outline-none focus:ring-2 focus:ring-primary/50" />
              </div>
              {errorMsg && <p className="text-xs text-destructive">{errorMsg}</p>}
              <button onClick={handleBid} disabled={busy || !bidAmount || parseFloat(bidAmount) <= 0}
                className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-all">
                {busy ? '...' : 'Поставить'}
              </button>
              {bidsHistory.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">История ставок</p>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {bidsHistory.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs">
                        <span className="text-foreground">{b.bidder_name}</span>
                        <span className="font-mono-game text-muted-foreground">${formatMoney(b.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ── Helpers ──
const Row: React.FC<{ label: string; value: React.ReactNode; bold?: boolean; muted?: boolean }> = ({ label, value, bold, muted }) => (
  <div className="flex justify-between items-center">
    <span className={`text-sm ${muted ? 'text-muted-foreground text-xs' : 'text-muted-foreground'}`}>{label}</span>
    <span className={`text-sm ${bold ? 'font-bold font-mono-game' : ''} ${muted ? 'text-xs font-mono-game' : ''}`}>{value}</span>
  </div>
);

const ItemPreview: React.FC<{ listing: MarketListing; t: (k: string) => string }> = ({ listing, t }) => {
  const data = listing.item_data as any;
  return (
    <div className="bg-muted/30 rounded-xl p-4 flex flex-col items-center gap-2">
      {listing.item_type === 'username' ? (
        <>
          <GameIcon name="tag" size={32} themed />
          <span className="text-xl font-bold">@{data.username}</span>
        </>
      ) : (
        <LicensePlate plate={{ id: '', text: data.text, country: data.country, assignedTo: null, isCustom: data.isCustom } as LicensePlateData} size="lg" />
      )}
    </div>
  );
};

const Countdown: React.FC<{ to: string }> = ({ to }) => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const ms = new Date(to).getTime() - now;
  if (ms <= 0) return <span className="text-destructive font-medium">Завершён</span>;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return <span className={`font-mono-game ${ms < 60000 ? 'text-destructive font-bold' : ''}`}>
    {h > 0 ? `${h}ч ` : ''}{m}м {sec}с
  </span>;
};

const ListingCard: React.FC<{
  listing: MarketListing; userId?: string; balance: number;
  isFavorite: boolean; isHistory: boolean;
  onBuy: () => void; onBid: () => void; onCancel: () => void; onToggleFavorite: () => void;
  t: (k: string) => string;
}> = ({ listing, userId, balance, isFavorite, isHistory, onBuy, onBid, onCancel, onToggleFavorite, t }) => {
  const isMine = listing.seller_id === userId;
  const isUsername = listing.item_type === 'username';
  const data = listing.item_data as any;
  const isAuction = listing.listing_kind === 'auction';
  const ended = isAuction && listing.auction_ends_at && new Date(listing.auction_ends_at).getTime() <= Date.now();

  return (
    <div className={`bg-card rounded-2xl border overflow-hidden transition-all hover:shadow-lg hover:border-primary/30 relative ${
      isMine ? 'border-primary/20' : 'border-border'
    }`}>
      {/* Badges */}
      <div className="absolute top-2 left-2 flex gap-1 z-10">
        {isAuction && (
          <span className="text-[9px] bg-amber-500/90 text-white px-2 py-0.5 rounded-full font-bold uppercase">⚖️ Аукцион</span>
        )}
        {isHistory && (
          <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
            listing.status === 'sold' ? 'bg-green-500/90 text-white' : 'bg-muted text-muted-foreground'
          }`}>{listing.status === 'sold' ? (listing.buyer_id === userId ? '🛒 Куплено' : '✅ Продано') : '✕ Отменено'}</span>
        )}
      </div>
      {userId && !isMine && !isHistory && (
        <button onClick={onToggleFavorite}
          className={`absolute top-2 right-2 z-10 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
            isFavorite ? 'bg-yellow-400/90 text-white' : 'bg-background/80 text-muted-foreground hover:text-yellow-400'
          }`}
          title="Избранное"><span className="text-sm">{isFavorite ? '★' : '☆'}</span></button>
      )}

      <div className={`p-5 flex flex-col items-center justify-center min-h-[120px] ${
        isUsername ? 'bg-gradient-to-br from-primary/5 to-primary/10' : 'bg-gradient-to-br from-muted/30 to-muted/50'
      }`}>
        {isUsername ? (
          <>
            <GameIcon name="tag" size={28} themed />
            <span className="mt-2 text-lg font-bold">@{data.username}</span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{t('market.username_label')}</span>
          </>
        ) : (
          <>
            <LicensePlate plate={{ id: '', text: data.text, country: data.country, assignedTo: null, isCustom: data.isCustom } as LicensePlateData} size="lg" />
            <span className="text-[10px] text-muted-foreground mt-2">
              {data.isCustom ? t('market.custom') : t('market.random')} • {PLATE_COUNTRIES.find(c => c.id === data.country)?.name}
            </span>
          </>
        )}
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-mono-game text-lg font-bold">${formatMoney(listing.price)}</span>
            {isAuction && listing.bid_count > 0 && (
              <span className="text-[10px] text-muted-foreground ml-2">{listing.bid_count} ставок</span>
            )}
          </div>
          {isMine && !isHistory && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{t('market.your_lot')}</span>
          )}
        </div>

        {isAuction && listing.auction_ends_at && !isHistory && (
          <div className="text-xs text-muted-foreground">
            ⏱ <Countdown to={listing.auction_ends_at} />
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <GameIcon name="profile" size={12} />
          <span className="truncate">{listing.seller_username}</span>
          <span className="ml-auto">{new Date(isHistory && listing.sold_at ? listing.sold_at : listing.created_at).toLocaleDateString()}</span>
        </div>

        {isHistory ? null : isMine ? (
          <button onClick={onCancel}
            disabled={isAuction && (listing.bid_count || 0) > 0}
            title={isAuction && listing.bid_count > 0 ? 'Нельзя отменить аукцион со ставками' : ''}
            className="w-full rounded-xl py-2 text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
            {t('market.cancel_listing')}
          </button>
        ) : userId ? (
          isAuction ? (
            <button onClick={onBid} disabled={!!ended}
              className={`w-full rounded-xl py-2 text-sm font-semibold transition-all ${
                !ended ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]' : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}>{ended ? 'Завершён' : 'Сделать ставку'}</button>
          ) : (
            <button onClick={onBuy} disabled={balance < listing.price}
              className={`w-full rounded-xl py-2 text-sm font-semibold transition-all ${
                balance >= listing.price ? 'bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]' : 'bg-muted text-muted-foreground cursor-not-allowed'
              }`}>{balance >= listing.price ? t('market.buy') : t('market.insufficient')}</button>
          )
        ) : (
          <p className="text-xs text-muted-foreground text-center">{t('market.login_to_buy')}</p>
        )}
      </div>
    </div>
  );
};

export default MarketTab;
