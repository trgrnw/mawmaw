import React, { memo, useMemo, useState } from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts';
import { toast } from 'sonner';
import AssetLogo from '@/components/AssetLogo';
import GameIcon from '@/components/GameIcon';
import { useGame } from '@/context/GameContext';
import { cryptoAssets, stockAssets } from '@/data/investmentData';
import { useI18n } from '@/i18n/I18nContext';

type Market = 'stocks' | 'crypto' | 'portfolio';
type Trade = 'buy' | 'sell';

const Chart = memo(({ history, positive }: { history: number[]; positive: boolean }) => {
  const data = useMemo(() => history.map((value, index) => ({ index, value })), [history]);
  return <ResponsiveContainer width="100%" height={190}><LineChart data={data}><YAxis hide domain={['dataMin', 'dataMax']} /><Tooltip formatter={(value: number) => [`$${value.toLocaleString()}`, '']} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12 }} labelStyle={{ display: 'none' }} /><Line type="monotone" dataKey="value" stroke={positive ? '#22c55e' : '#ef4444'} strokeWidth={2.5} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>;
});
Chart.displayName = 'Chart';

const changePercent = (history: number[]) => history.length < 2 || !history[0] ? 0 : ((history.at(-1)! - history[0]) / history[0]) * 100;

const InvestmentsTab: React.FC = () => {
  const game = useGame();
  const { t } = useI18n();
  const [market, setMarket] = useState<Market>('stocks');
  const [assetId, setAssetId] = useState(stockAssets[0]?.id ?? '');
  const [trade, setTrade] = useState<Trade>('buy');
  const [quantity, setQuantity] = useState('1');
  const [saving, setSaving] = useState(false);

  const stockValue = game.stockHoldings.reduce((sum, item) => sum + (game.stockPrices[item.assetId]?.current ?? item.avgBuyPrice) * item.quantity, 0);
  const cryptoValue = game.cryptoHoldings.reduce((sum, item) => sum + (game.cryptoPrices[item.assetId]?.current ?? item.avgBuyPrice) * item.quantity, 0);
  const pnl = [...game.stockHoldings, ...game.cryptoHoldings].reduce((sum, item) => {
    const current = game.stockPrices[item.assetId]?.current ?? game.cryptoPrices[item.assetId]?.current ?? item.avgBuyPrice;
    return sum + (current - item.avgBuyPrice) * item.quantity;
  }, 0);

  const assets = market === 'crypto' ? cryptoAssets : stockAssets;
  const prices = market === 'crypto' ? game.cryptoPrices : game.stockPrices;
  const holdings = market === 'crypto' ? game.cryptoHoldings : game.stockHoldings;
  const asset = assets.find(item => item.id === assetId) ?? assets[0];
  const priceData = asset ? prices[asset.id] : undefined;
  const holding = asset ? holdings.find(item => item.assetId === asset.id) : undefined;
  const rawQuantity = Number(quantity);
  const effectiveQuantity = market === 'stocks' ? Math.floor(rawQuantity) : rawQuantity;
  const total = (priceData?.current ?? 0) * (Number.isFinite(effectiveQuantity) ? effectiveQuantity : 0);
  const canTrade = !!asset && !!priceData && effectiveQuantity > 0 && (trade === 'buy' ? game.balance >= total : !!holding && holding.quantity >= effectiveQuantity);

  const switchMarket = (next: Market) => {
    setMarket(next);
    setAssetId(next === 'crypto' ? cryptoAssets[0]?.id ?? '' : stockAssets[0]?.id ?? '');
    setTrade('buy');
    setQuantity('1');
  };

  const executeTrade = async () => {
    if (!asset || !canTrade || saving) return;
    setSaving(true);
    try {
      const completed = market === 'stocks'
        ? trade === 'buy' ? game.buyStock(asset.id, effectiveQuantity) : game.sellStock(asset.id, effectiveQuantity)
        : trade === 'buy' ? game.buyCrypto(asset.id, effectiveQuantity) : game.sellCrypto(asset.id, effectiveQuantity);
      if (!completed) {
        toast.error(trade === 'buy' ? 'Недостаточно средств для сделки' : 'Недостаточно актива для продажи');
        return;
      }
      await game.syncProgress();
      toast.success(`${trade === 'buy' ? t('inv.buy') : t('inv.sell')}: ${asset.ticker}`);
      setQuantity(market === 'stocks' ? '1' : '0.01');
    } catch (error) {
      console.error('[InvestmentsTab] trade save failed', error);
      toast.error('Сделка сохранена на устройстве. Облачная синхронизация повторится автоматически.');
    } finally {
      setSaving(false);
    }
  };

  return <div className="max-w-6xl space-y-5 pb-8">
    <header className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-card p-5 sm:p-7">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15"><GameIcon name="investments" size={26} themed /></div><h2 className="text-2xl font-bold sm:text-3xl">{t('inv.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('inv.subtitle')}</p></div><div className="grid grid-cols-3 gap-2"><Metric label={t('inv.portfolio')} value={`$${game.formatMoney(stockValue + cryptoValue)}`} /><Metric label="P&L" value={`${pnl >= 0 ? '+' : ''}$${game.formatMoney(pnl)}`} tone={pnl >= 0 ? 'good' : 'bad'} /><Metric label={t('shop.balance')} value={`$${game.formatMoney(game.balance)}`} /></div></div>
    </header>

    <nav className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card/80 p-1.5">
      {([['stocks', t('inv.stocks'), 'stocks'], ['crypto', t('inv.crypto'), 'crypto'], ['portfolio', t('inv.my_portfolio'), 'briefcase']] as Array<[Market, string, string]>).map(([id, label, icon]) => <button key={id} onClick={() => switchMarket(id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl px-2 text-xs font-semibold transition-colors sm:text-sm ${market === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><GameIcon name={icon} size={17} /><span className="truncate">{label}</span></button>)}
    </nav>

    {market === 'portfolio' ? <Portfolio game={game} stockValue={stockValue} cryptoValue={cryptoValue} open={(kind, id) => { setMarket(kind); setAssetId(id); setTrade('sell'); setQuantity(kind === 'stocks' ? '1' : '0.01'); }} t={t} /> : asset && priceData && <div className="grid gap-4 xl:grid-cols-[1fr_370px]">
      <section className="space-y-3">
        <div className="flex items-center justify-between"><div><h3 className="text-xl font-bold">{market === 'stocks' ? t('inv.stock_market') : t('inv.crypto_market')}</h3><p className="text-sm text-muted-foreground">{assets.length} {market === 'stocks' ? t('inv.companies') : t('inv.coins')}</p></div><span className="text-sm text-muted-foreground">{t('inv.portfolio')}: <b className="text-foreground">${game.formatMoney(market === 'stocks' ? stockValue : cryptoValue)}</b></span></div>
        <div className="grid gap-2 sm:grid-cols-2">{assets.map(item => { const price = prices[item.id]; if (!price) return null; const change = changePercent(price.history); const owned = holdings.find(position => position.assetId === item.id); return <button key={item.id} onClick={() => { setAssetId(item.id); setTrade('buy'); setQuantity(market === 'stocks' ? '1' : '0.01'); }} className={`flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition-colors ${asset.id === item.id ? 'border-violet-400 bg-violet-500/5' : 'border-border hover:bg-muted/50'}`}><AssetLogo assetId={item.id} size={34} /><div className="min-w-0 flex-1"><p className="font-bold">{item.ticker}</p><p className="truncate text-[11px] text-muted-foreground">{item.name}{owned ? ` · ${owned.quantity.toFixed(market === 'stocks' ? 0 : 4)}` : ''}</p></div><div className="text-right"><p className="font-mono-game text-xs font-bold">${game.formatMoney(price.current)}</p><p className={`text-[10px] ${change >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%</p></div></button>; })}</div>
      </section>

      <aside className="h-fit rounded-3xl border border-violet-500/25 bg-card p-5 xl:sticky xl:top-4">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><AssetLogo assetId={asset.id} size={42} /><div><h3 className="text-xl font-bold">{asset.ticker}</h3><p className="text-xs text-muted-foreground">{asset.name}</p></div></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${changePercent(priceData.history) >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>{changePercent(priceData.history).toFixed(2)}%</span></div>
        <p className="mt-4 font-mono-game text-3xl font-bold">${game.formatMoney(priceData.current)}</p><div className="my-3 overflow-hidden rounded-2xl bg-muted/30 p-2"><Chart history={priceData.history} positive={changePercent(priceData.history) >= 0} /></div>
        {holding && <div className="mb-4 grid grid-cols-2 gap-2"><Small label={t('inv.quantity')} value={holding.quantity.toFixed(market === 'stocks' ? 0 : 4)} /><Small label={t('inv.avg_price')} value={`$${game.formatMoney(holding.avgBuyPrice)}`} /><Small label={t('inv.value')} value={`$${game.formatMoney(holding.quantity * priceData.current)}`} /><Small label="P&L" value={`${priceData.current >= holding.avgBuyPrice ? '+' : ''}$${game.formatMoney((priceData.current - holding.avgBuyPrice) * holding.quantity)}`} /></div>}
        <div className="grid grid-cols-2 gap-2"><button onClick={() => setTrade('buy')} className={`rounded-xl py-2.5 text-sm font-bold ${trade === 'buy' ? 'bg-emerald-500 text-white' : 'bg-muted text-muted-foreground'}`}>{t('inv.buy')}</button><button onClick={() => setTrade('sell')} className={`rounded-xl py-2.5 text-sm font-bold ${trade === 'sell' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground'}`}>{t('inv.sell')}</button></div>
        <label className="mt-4 block text-xs font-semibold text-muted-foreground">{t('inv.quantity')}</label><input type="number" min={market === 'stocks' ? 1 : .0001} step={market === 'stocks' ? 1 : .01} value={quantity} onChange={event => setQuantity(event.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-violet-400" />
        <div className="mt-4 space-y-2 border-t border-border pt-4"><Row label={t('inv.total_cost')} value={`$${game.formatMoney(total)}`} /><Row label={trade === 'buy' ? t('shop.balance') : t('inv.available')} value={trade === 'buy' ? `$${game.formatMoney(game.balance)}` : holding?.quantity.toFixed(market === 'stocks' ? 0 : 4) ?? '0'} /><button onClick={executeTrade} disabled={!canTrade || saving} className={`mt-2 w-full rounded-xl py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 ${trade === 'buy' ? 'bg-emerald-500' : 'bg-destructive'}`}>{saving ? 'Сохраняю сделку…' : `${trade === 'buy' ? t('inv.buy') : t('inv.sell')} ${asset.ticker}`}</button></div>
      </aside>
    </div>}
  </div>;
};

const Portfolio = ({ game, stockValue, cryptoValue, open, t }: { game: ReturnType<typeof useGame>; stockValue: number; cryptoValue: number; open: (kind: 'stocks' | 'crypto', id: string) => void; t: (key: string) => string }) => {
  const positions = [...game.stockHoldings.map(item => ({ ...item, kind: 'stocks' as const, asset: stockAssets.find(asset => asset.id === item.assetId), price: game.stockPrices[item.assetId]?.current ?? item.avgBuyPrice })), ...game.cryptoHoldings.map(item => ({ ...item, kind: 'crypto' as const, asset: cryptoAssets.find(asset => asset.id === item.assetId), price: game.cryptoPrices[item.assetId]?.current ?? item.avgBuyPrice }))];
  return <section className="space-y-4"><div className="grid grid-cols-2 gap-3"><Metric label={t('inv.stocks')} value={`$${game.formatMoney(stockValue)}`} /><Metric label={t('inv.crypto')} value={`$${game.formatMoney(cryptoValue)}`} /></div>{positions.length === 0 ? <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card/50 p-8 text-center"><GameIcon name="briefcase" size={42} themed /><p className="mt-4 text-sm text-muted-foreground">{t('inv.empty_portfolio')}</p></div> : <div className="grid gap-3 md:grid-cols-2">{positions.map(position => { if (!position.asset) return null; const positionPnl = (position.price - position.avgBuyPrice) * position.quantity; return <button key={`${position.kind}-${position.assetId}`} onClick={() => open(position.kind, position.assetId)} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left hover:border-violet-400/50"><AssetLogo assetId={position.assetId} size={38} /><div className="min-w-0 flex-1"><p className="font-bold">{position.asset.ticker}</p><p className="text-xs text-muted-foreground">{position.quantity.toFixed(position.kind === 'stocks' ? 0 : 4)} · avg ${game.formatMoney(position.avgBuyPrice)}</p></div><div className="text-right"><p className="font-mono-game text-sm font-bold">${game.formatMoney(position.price * position.quantity)}</p><p className={`text-xs ${positionPnl >= 0 ? 'text-emerald-500' : 'text-destructive'}`}>{positionPnl >= 0 ? '+' : ''}${game.formatMoney(positionPnl)}</p></div></button>; })}</div>}</section>;
};

const Metric = ({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) => <div className="rounded-2xl border border-border/70 bg-background/50 px-3 py-3"><p className="text-[10px] text-muted-foreground">{label}</p><p className={`mt-1 whitespace-nowrap font-mono-game text-xs font-bold sm:text-sm ${tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-destructive' : ''}`}>{value}</p></div>;
const Small = ({ label, value }: { label: string; value: string }) => <div className="rounded-xl bg-muted/50 p-2.5"><p className="text-[10px] text-muted-foreground">{label}</p><p className="mt-1 truncate font-mono-game text-xs font-bold">{value}</p></div>;
const Row = ({ label, value }: { label: string; value: string }) => <div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{label}</span><b className="font-mono-game">{value}</b></div>;

export default InvestmentsTab;
