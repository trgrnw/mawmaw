import React, { useMemo, useState } from 'react';
import GameIcon from '@/components/GameIcon';
import AssetLogo from '@/components/AssetLogo';
import { useAuth } from '@/context/AuthContext';
import { formatMoney, useGame } from '@/context/GameContext';
import { cryptoAssets, stockAssets } from '@/data/investmentData';
import { accessoryItemsData, shopItemsData } from '@/data/shopData';
import { calculateFinancialSnapshot } from '@/game/finance';
import { useI18n } from '@/i18n/I18nContext';
import ProfileTabLegacy from './ProfileTabLegacy';

type ProfileDesign = 'modern' | 'classic';
const DESIGN_KEY = 'profile_design_preference';

const ProfileTab: React.FC = () => {
  const [design, setDesign] = useState<ProfileDesign>(() => localStorage.getItem(DESIGN_KEY) === 'classic' ? 'classic' : 'modern');
  const selectDesign = (next: ProfileDesign) => {
    localStorage.setItem(DESIGN_KEY, next);
    setDesign(next);
  };

  return <div className="space-y-4">
    <div className="flex justify-end">
      <div className="inline-flex rounded-xl border border-border bg-card p-1">
        <button onClick={() => selectDesign('modern')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${design === 'modern' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Новый дизайн</button>
        <button onClick={() => selectDesign('classic')} className={`rounded-lg px-3 py-2 text-xs font-semibold ${design === 'classic' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>Классический</button>
      </div>
    </div>
    {design === 'classic' ? <ProfileTabLegacy /> : <ModernProfile />}
  </div>;
};

const ModernProfile: React.FC = () => {
  const game = useGame();
  const { user, username, avatarEmoji, avatarUrl } = useAuth();
  const { t } = useI18n();
  const finances = calculateFinancialSnapshot(game);
  const ownedShop = game.shopItems.filter(item => item.purchased);
  const ownedAccessories = game.accessoryItems.filter(item => item.purchased);
  const totalEarned = game.totalEarnedClick + game.totalEarnedBusiness + game.totalEarnedRent + game.totalEarnedDividends + game.totalEarnedTrading + game.totalEarnedCrypto + game.totalEarnedGems;

  const assets = useMemo(() => [
    { label: t('profile.stat_business'), value: finances.businesses, color: 'bg-sky-500' },
    { label: t('profile.stat_realestate'), value: finances.realEstate, color: 'bg-emerald-500' },
    { label: t('profile.stat_transport'), value: finances.transport, color: 'bg-amber-500' },
    { label: t('profile.stat_stocks'), value: finances.stocks, color: 'bg-violet-500' },
    { label: t('profile.stat_crypto'), value: finances.crypto, color: 'bg-fuchsia-500' },
    { label: t('profile.stat_collections'), value: finances.accessories, color: 'bg-rose-500' },
    { label: t('profile.stat_infrastructure'), value: finances.infrastructure, color: 'bg-cyan-500' },
    { label: t('profile.stat_islands'), value: finances.islands, color: 'bg-teal-500' },
  ].filter(item => item.value > 0), [finances, t]);
  const maxAsset = Math.max(...assets.map(item => item.value), 1);

  const positions = [
    ...game.stockHoldings.map(position => ({ ...position, asset: stockAssets.find(asset => asset.id === position.assetId), price: game.stockPrices[position.assetId]?.current ?? position.avgBuyPrice })),
    ...game.cryptoHoldings.map(position => ({ ...position, asset: cryptoAssets.find(asset => asset.id === position.assetId), price: game.cryptoPrices[position.assetId]?.current ?? position.avgBuyPrice })),
  ].filter(position => position.asset).sort((a, b) => b.price * b.quantity - a.price * a.quantity).slice(0, 4);

  const collection = [...ownedShop, ...ownedAccessories].map(item => ({ item, data: [...shopItemsData, ...accessoryItemsData].find(data => data.id === item.id) })).filter(entry => entry.data).slice(-6).reverse();
  const earnings = [
    [t('profile.earn_click'), game.totalEarnedClick, 'click'],
    [t('profile.earn_business'), game.totalEarnedBusiness, 'business'],
    [t('profile.earn_rent'), game.totalEarnedRent, 'rent'],
    [t('profile.earn_dividends'), game.totalEarnedDividends, 'stocks'],
    [t('profile.earn_trading'), game.totalEarnedTrading, 'investments'],
    [t('profile.earn_crypto'), game.totalEarnedCrypto, 'crypto'],
  ] as Array<[string, number, string]>;

  return <div className="mx-auto max-w-6xl space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-3xl border border-sky-500/25 bg-card">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-500/20 via-transparent to-violet-500/15" />
      <div className="relative h-28 border-b border-white/5 bg-[radial-gradient(circle_at_20%_0%,rgba(56,189,248,.35),transparent_50%)] sm:h-36" />
      <div className="relative px-5 pb-6 sm:px-7">
        <div className="-mt-11 flex flex-col gap-4 sm:-mt-12 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-card bg-muted text-5xl shadow-xl">{avatarUrl ? <img src={avatarUrl} alt={username} className="h-full w-full object-cover" /> : avatarEmoji}</div>
            <div className="pb-1"><p className="text-xs font-semibold uppercase tracking-[.2em] text-sky-400">{t('profile.title')}</p><h2 className="mt-1 text-2xl font-black sm:text-3xl">{username || 'Player'}</h2><p className="mt-1 text-xs text-muted-foreground">{user?.email ?? 'Guest'} · {t('profile.clickPower')} ${formatMoney(game.clickPower)}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-80"><HeroMetric label={t('profile.stat_networth')} value={`$${formatMoney(finances.netWorth)}`} /><HeroMetric label={t('profile.stat_balance')} value={`$${formatMoney(game.balance)}`} /></div>
        </div>
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Summary icon="business" label={t('profile.cnt_businesses')} value={game.businesses.length.toString()} sub={`$${formatMoney(finances.businesses)}`} />
      <Summary icon="building" label={t('profile.counts')} value={(ownedShop.length + ownedAccessories.length).toString()} sub={t('profile.stat_collections')} />
      <Summary icon="investments" label={t('inv.positions')} value={(game.stockHoldings.length + game.cryptoHoldings.length).toString()} sub={`$${formatMoney(finances.stocks + finances.crypto)}`} />
      <Summary icon="wallet" label={t('profile.earned')} value={`$${formatMoney(totalEarned)}`} sub={t('profile.summary')} />
    </section>

    <div className="grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="mb-5 flex items-center justify-between"><div><h3 className="text-lg font-bold">{t('profile.assets')}</h3><p className="text-xs text-muted-foreground">{t('profile.stat_networth')}: ${formatMoney(finances.netWorth)}</p></div><GameIcon name="stocks" size={24} themed /></div>
        {assets.length === 0 ? <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted-foreground">Активов пока нет</div> : <div className="space-y-4">{assets.map(asset => <div key={asset.label}><div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">{asset.label}</span><b className="font-mono-game">${formatMoney(asset.value)}</b></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${asset.color}`} style={{ width: `${Math.max(3, asset.value / maxAsset * 100)}%` }} /></div></div>)}</div>}
      </section>

      <section className="rounded-3xl border border-border bg-card p-5"><h3 className="mb-4 text-lg font-bold">{t('profile.earned')}</h3><div className="space-y-2">{earnings.map(([label, value, icon]) => <div key={label} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3"><GameIcon name={icon} size={18} themed /><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span><b className="font-mono-game text-xs">${formatMoney(value)}</b></div>)}</div></section>
    </div>

    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border border-border bg-card p-5"><h3 className="mb-4 text-lg font-bold">{t('inv.my_portfolio')}</h3>{positions.length === 0 ? <Empty icon="briefcase" text={t('inv.empty_portfolio')} /> : <div className="space-y-2">{positions.map(position => <div key={position.assetId} className="flex items-center gap-3 rounded-xl bg-muted/40 p-3"><AssetLogo assetId={position.assetId} size={32} /><div className="min-w-0 flex-1"><p className="text-sm font-bold">{position.asset?.ticker}</p><p className="text-[10px] text-muted-foreground">{position.quantity.toFixed(4)}</p></div><b className="font-mono-game text-xs">${formatMoney(position.price * position.quantity)}</b></div>)}</div>}</section>
      <section className="rounded-3xl border border-border bg-card p-5"><h3 className="mb-4 text-lg font-bold">{t('profile.showcase')}</h3>{collection.length === 0 ? <Empty icon="diamond" text="Коллекция пока пуста" /> : <div className="grid grid-cols-3 gap-2">{collection.map(({ item, data }) => <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-muted"><img src={data?.image} alt={item.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-6"><p className="truncate text-[10px] font-semibold text-white">{item.name}</p></div></div>)}</div>}</section>
    </div>

    <p className="text-center text-xs text-muted-foreground">Поиск игроков, кастомизация профиля и выбор витрины доступны в режиме «Классический».</p>
  </div>;
};

const HeroMetric = ({ label, value }: { label: string; value: string }) => <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 backdrop-blur"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 font-mono-game text-sm font-bold">{value}</p></div>;
const Summary = ({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) => <div className="rounded-2xl border border-border bg-card p-4"><div className="flex items-start justify-between"><div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-mono-game text-xl font-black">{value}</p></div><div className="rounded-xl bg-primary/10 p-2"><GameIcon name={icon} size={20} themed /></div></div><p className="mt-3 truncate text-[10px] text-muted-foreground">{sub}</p></div>;
const Empty = ({ icon, text }: { icon: string; text: string }) => <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center"><GameIcon name={icon} size={30} themed /><p className="mt-3 max-w-56 text-xs text-muted-foreground">{text}</p></div>;

export default ProfileTab;
