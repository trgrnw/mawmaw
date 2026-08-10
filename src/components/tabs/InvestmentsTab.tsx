import React, { useState, useMemo, memo } from 'react';
import { useGame } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import { stockAssets, cryptoAssets } from '@/data/investmentData';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import GameIcon from '@/components/GameIcon';
import AssetLogo from '@/components/AssetLogo';

type View = 'main' | 'stocks' | 'crypto' | 'portfolio';

const MiniChart = memo<{ history: number[]; color: string }>(({ history, color }) => {
  const data = useMemo(() => history.map((v, i) => ({ i, v })), [history]);
  return (
    <ResponsiveContainer width="100%" height={50}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={1.5} isAnimationActive={false} />
        <YAxis domain={['dataMin', 'dataMax']} hide />
      </LineChart>
    </ResponsiveContainer>
  );
});
MiniChart.displayName = 'MiniChart';

const BigChart = memo<{ history: number[]; color: string; formatMoney: (n: number) => string }>(({ history, color, formatMoney }) => {
  const data = useMemo(() => history.map((v, i) => ({ i, v })), [history]);
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} dot={false} strokeWidth={2} isAnimationActive={false} />
        <YAxis domain={['dataMin', 'dataMax']} hide />
        <Tooltip
          formatter={(val: number) => ['$' + formatMoney(val), '']}
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }}
          labelStyle={{ display: 'none' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});
BigChart.displayName = 'BigChart';

const priceChange = (history: number[]) => {
  if (history.length < 2) return 0;
  return ((history[history.length - 1] - history[0]) / history[0]) * 100;
};

const InvestmentsTab: React.FC = () => {
  const {
    balance, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices,
    buyStock, sellStock, buyCrypto, sellCrypto, formatMoney,
  } = useGame();
  const { t } = useI18n();

  const [view, setView] = useState<View>('main');
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [tradeQty, setTradeQty] = useState('1');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');

  const stockValue = stockHoldings.reduce((s, h) => s + (stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
  const cryptoValue = cryptoHoldings.reduce((s, h) => s + (cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
  const totalPnL = useMemo(() => {
    const sPnL = stockHoldings.reduce((s, h) => {
      const cur = stockPrices[h.assetId]?.current ?? h.avgBuyPrice;
      return s + (cur - h.avgBuyPrice) * h.quantity;
    }, 0);
    const cPnL = cryptoHoldings.reduce((s, h) => {
      const cur = cryptoPrices[h.assetId]?.current ?? h.avgBuyPrice;
      return s + (cur - h.avgBuyPrice) * h.quantity;
    }, 0);
    return sPnL + cPnL;
  }, [stockHoldings, cryptoHoldings, stockPrices, cryptoPrices]);

  const handleStockTrade = () => {
    if (!selectedAsset) return;
    const qty = parseFloat(tradeQty);
    if (isNaN(qty) || qty <= 0) return;
    const intQty = Math.floor(qty);
    if (tradeType === 'buy') buyStock(selectedAsset, intQty);
    else sellStock(selectedAsset, intQty);
    setTradeQty('1');
  };

  const handleCryptoTrade = () => {
    if (!selectedAsset) return;
    const qty = parseFloat(tradeQty);
    if (isNaN(qty) || qty <= 0) return;
    if (tradeType === 'buy') buyCrypto(selectedAsset, qty);
    else sellCrypto(selectedAsset, qty);
    setTradeQty('1');
  };

  // ── MAIN VIEW ──
  if (view === 'main') {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold mb-1 flex items-center gap-2"><GameIcon name="investments" size={24} themed /> {t('inv.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('inv.subtitle')}</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-card"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('inv.portfolio')}</p>
            <p className="text-lg font-bold text-foreground">${formatMoney(stockValue + cryptoValue)}</p>
          </CardContent></Card>
          <Card className="bg-card"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">P&L</p>
            <p className={`text-lg font-bold ${totalPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatMoney(totalPnL)}
            </p>
          </CardContent></Card>
          <Card className="bg-card"><CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t('inv.positions')}</p>
            <p className="text-lg font-bold text-foreground">{stockHoldings.length + cryptoHoldings.length}</p>
          </CardContent></Card>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[
            { id: 'stocks' as View, icon: 'stocks', title: t('inv.stocks'), desc: `${stockAssets.length} ${t('inv.companies')}`, sub: `${t('inv.portfolio')}: $${formatMoney(stockValue)}` },
            { id: 'crypto' as View, icon: 'crypto', title: t('inv.crypto'), desc: `${cryptoAssets.length} ${t('inv.coins')}`, sub: `${t('inv.portfolio')}: $${formatMoney(cryptoValue)}` },
            { id: 'portfolio' as View, icon: 'briefcase', title: t('inv.my_portfolio'), desc: `${stockHoldings.length + cryptoHoldings.length} ${t('inv.positions')}`, sub: `${t('inv.total')}: $${formatMoney(stockValue + cryptoValue)}` },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => { setView(c.id); setSelectedAsset(null); }}
              className="stat-card rounded-2xl p-5 text-left flex items-center gap-4 hover:ring-2 hover:ring-primary/30 transition-all"
            >
              <GameIcon name={c.icon} size={40} themed />
              <div className="flex-1">
                <h3 className="font-bold text-foreground">{c.title}</h3>
                <p className="text-sm text-muted-foreground">{c.desc}</p>
              </div>
              <span className="text-sm font-medium text-muted-foreground">{c.sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── STOCKS VIEW ──
  if (view === 'stocks') {
    const isTrading = selectedAsset !== null;
    const asset = isTrading ? stockAssets.find(a => a.id === selectedAsset) : null;
    const priceData = isTrading && asset ? stockPrices[asset.id] : null;
    const holding = isTrading ? stockHoldings.find(h => h.assetId === selectedAsset) : null;
    const qty = parseFloat(tradeQty) || 0;
    const cost = priceData ? priceData.current * Math.floor(qty) : 0;

    if (isTrading && asset && priceData) {
      const change = priceChange(priceData.history);
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedAsset(null)} className="text-sm text-primary hover:underline">{t('inv.back_stocks')}</button>
          <div className="flex items-center gap-3">
            <AssetLogo assetId={asset.id} size={40} />
            <div>
              <h2 className="text-xl font-bold text-foreground">{asset.ticker}</h2>
              <p className="text-sm text-muted-foreground">{asset.name} · {asset.sector}</p>
            </div>
          </div>

          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">${formatMoney(priceData.current)}</span>
            <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
            </span>
          </div>

          <Card className="bg-card"><CardContent className="p-3">
            <BigChart history={priceData.history} color={change >= 0 ? '#22c55e' : '#ef4444'} formatMoney={formatMoney} />
          </CardContent></Card>

          {holding && (
            <Card className="bg-card"><CardContent className="p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('inv.quantity')}:</span>
                <span className="font-medium text-foreground">{holding.quantity} {t('inv.pcs')}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t('inv.avg_price')}:</span>
                <span className="font-medium text-foreground">${formatMoney(holding.avgBuyPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t('inv.value')}:</span>
                <span className="font-medium text-foreground">${formatMoney(priceData.current * holding.quantity)}</span>
              </div>
              {(() => {
                const pnl = (priceData.current - holding.avgBuyPrice) * holding.quantity;
                return (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">P&L:</span>
                    <span className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                    </span>
                  </div>
                );
              })()}
              {asset.dividendYield > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">{t('inv.dividends_year')}:</span>
                  <span className="font-medium text-green-500">{(asset.dividendYield * 100).toFixed(1)}%</span>
                </div>
              )}
            </CardContent></Card>
          )}

          <Card className="bg-card"><CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setTradeType('buy')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeType === 'buy' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>{t('inv.buy')}</button>
              <button onClick={() => setTradeType('sell')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeType === 'sell' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>{t('inv.sell')}</button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('inv.qty_pcs')}</label>
              <Input type="number" min="1" step="1" value={tradeQty} onChange={e => setTradeQty(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('inv.total_cost')}:</span>
              <span className="font-bold text-foreground">${formatMoney(cost)}</span>
            </div>
            {tradeType === 'sell' && holding && (
              <p className="text-xs text-muted-foreground">{t('inv.available')}: {holding.quantity} {t('inv.pcs')}</p>
            )}
            <button
              onClick={handleStockTrade}
              disabled={qty <= 0 || (tradeType === 'buy' && cost > balance) || (tradeType === 'sell' && (!holding || Math.floor(qty) > holding.quantity))}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-40 ${tradeType === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {tradeType === 'buy' ? `${t('inv.buy')} ${Math.floor(qty)} ${t('inv.pcs')}` : `${t('inv.sell')} ${Math.floor(qty)} ${t('inv.pcs')}`}
            </button>
          </CardContent></Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <button onClick={() => setView('main')} className="text-sm text-primary hover:underline">{t('inv.back')}</button>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><GameIcon name="stocks" size={22} themed /> {t('inv.stock_market')}</h2>
        <div className="space-y-2">
          {stockAssets.map(a => {
            const p = stockPrices[a.id];
            const change = priceChange(p.history);
            const h = stockHoldings.find(h => h.assetId === a.id);
            return (
              <button
                key={a.id}
                onClick={() => { setSelectedAsset(a.id); setTradeType('buy'); setTradeQty('1'); }}
                className="stat-card w-full rounded-xl p-3 flex items-center gap-3 hover:ring-2 hover:ring-primary/30 transition-all text-left"
              >
                <AssetLogo assetId={a.id} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{a.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate">{a.name}</span>
                  </div>
                  {h && <span className="text-xs text-primary">{h.quantity} {t('inv.pcs')}</span>}
                </div>
                <div className="w-20">
                  <MiniChart history={p.history} color={change >= 0 ? '#22c55e' : '#ef4444'} />
                </div>
                <div className="text-right min-w-[70px]">
                  <p className="text-sm font-bold text-foreground">${formatMoney(p.current)}</p>
                  <p className={`text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── CRYPTO VIEW ──
  if (view === 'crypto') {
    const isTrading = selectedAsset !== null;
    const asset = isTrading ? cryptoAssets.find(a => a.id === selectedAsset) : null;
    const priceData = isTrading && asset ? cryptoPrices[asset.id] : null;
    const holding = isTrading ? cryptoHoldings.find(h => h.assetId === selectedAsset) : null;
    const qty = parseFloat(tradeQty) || 0;
    const cost = priceData ? priceData.current * qty : 0;

    if (isTrading && asset && priceData) {
      const change = priceChange(priceData.history);
      return (
        <div className="space-y-4">
          <button onClick={() => setSelectedAsset(null)} className="text-sm text-primary hover:underline">{t('inv.back_crypto')}</button>
          <div className="flex items-center gap-3">
            <AssetLogo assetId={asset.id} size={40} />
            <div>
              <h2 className="text-xl font-bold text-foreground">{asset.ticker}</h2>
              <p className="text-sm text-muted-foreground">{asset.name}</p>
            </div>
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold text-foreground">${formatMoney(priceData.current)}</span>
            <span className={`text-sm font-medium ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(2)}%
            </span>
          </div>

          <Card className="bg-card"><CardContent className="p-3">
            <BigChart history={priceData.history} color={change >= 0 ? '#22c55e' : '#ef4444'} formatMoney={formatMoney} />
          </CardContent></Card>

          {holding && (
            <Card className="bg-card"><CardContent className="p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t('inv.quantity')}:</span>
                <span className="font-medium text-foreground">{holding.quantity.toFixed(4)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t('inv.avg_price')}:</span>
                <span className="font-medium text-foreground">${formatMoney(holding.avgBuyPrice)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-muted-foreground">{t('inv.value')}:</span>
                <span className="font-medium text-foreground">${formatMoney(priceData.current * holding.quantity)}</span>
              </div>
              {(() => {
                const pnl = (priceData.current - holding.avgBuyPrice) * holding.quantity;
                return (
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-muted-foreground">P&L:</span>
                    <span className={`font-medium ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {pnl >= 0 ? '+' : ''}{formatMoney(pnl)}
                    </span>
                  </div>
                );
              })()}
            </CardContent></Card>
          )}

          <Card className="bg-card"><CardContent className="p-4 space-y-3">
            <div className="flex gap-2">
              <button onClick={() => setTradeType('buy')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeType === 'buy' ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'}`}>{t('inv.buy')}</button>
              <button onClick={() => setTradeType('sell')} className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${tradeType === 'sell' ? 'bg-red-500 text-white' : 'bg-muted text-muted-foreground'}`}>{t('inv.sell')}</button>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">{t('inv.quantity')}</label>
              <Input type="number" min="0.0001" step="0.01" value={tradeQty} onChange={e => setTradeQty(e.target.value)} className="mt-1" />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t('inv.total_cost')}:</span>
              <span className="font-bold text-foreground">${formatMoney(cost)}</span>
            </div>
            {tradeType === 'sell' && holding && (
              <p className="text-xs text-muted-foreground">{t('inv.available')}: {holding.quantity.toFixed(4)}</p>
            )}
            <button
              onClick={handleCryptoTrade}
              disabled={qty <= 0 || (tradeType === 'buy' && cost > balance) || (tradeType === 'sell' && (!holding || qty > holding.quantity))}
              className={`w-full py-3 rounded-xl font-bold text-white transition-all disabled:opacity-40 ${tradeType === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600'}`}
            >
              {tradeType === 'buy' ? `${t('inv.buy')} ${qty}` : `${t('inv.sell')} ${qty}`} {asset.ticker}
            </button>
          </CardContent></Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <button onClick={() => setView('main')} className="text-sm text-primary hover:underline">{t('inv.back')}</button>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><GameIcon name="crypto" size={22} themed /> {t('inv.crypto_market')}</h2>
        <div className="space-y-2">
          {cryptoAssets.map(a => {
            const p = cryptoPrices[a.id];
            const change = priceChange(p.history);
            const h = cryptoHoldings.find(h => h.assetId === a.id);
            return (
              <button
                key={a.id}
                onClick={() => { setSelectedAsset(a.id); setTradeType('buy'); setTradeQty('1'); }}
                className="stat-card w-full rounded-xl p-3 flex items-center gap-3 hover:ring-2 hover:ring-primary/30 transition-all text-left"
              >
                <AssetLogo assetId={a.id} size={24} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{a.ticker}</span>
                    <span className="text-xs text-muted-foreground truncate">{a.name}</span>
                  </div>
                  {h && <span className="text-xs text-primary">{h.quantity.toFixed(4)}</span>}
                </div>
                <div className="w-20">
                  <MiniChart history={p.history} color={change >= 0 ? '#22c55e' : '#ef4444'} />
                </div>
                <div className="text-right min-w-[70px]">
                  <p className="text-sm font-bold text-foreground">${formatMoney(p.current)}</p>
                  <p className={`text-xs ${change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {change >= 0 ? '+' : ''}{change.toFixed(1)}%
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── PORTFOLIO VIEW ──
  return (
    <div className="space-y-4">
      <button onClick={() => setView('main')} className="text-sm text-primary hover:underline">{t('inv.back')}</button>
      <h2 className="text-xl font-bold text-foreground flex items-center gap-2"><GameIcon name="briefcase" size={22} themed /> {t('inv.my_portfolio')}</h2>

      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t('inv.stocks')}</p>
          <p className="text-lg font-bold text-foreground">${formatMoney(stockValue)}</p>
        </CardContent></Card>
        <Card className="bg-card"><CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">{t('inv.crypto')}</p>
          <p className="text-lg font-bold text-foreground">${formatMoney(cryptoValue)}</p>
        </CardContent></Card>
      </div>

      {stockHoldings.length === 0 && cryptoHoldings.length === 0 ? (
        <div className="stat-card rounded-2xl p-8 text-center">
          <span className="block mb-3"><GameIcon name="briefcase" size={48} className="text-muted-foreground" /></span>
          <p className="text-muted-foreground">{t('inv.empty_portfolio')}</p>
        </div>
      ) : (
        <>
          {stockHoldings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><GameIcon name="stocks" size={14} /> {t('inv.stocks')}</h3>
              <div className="space-y-2">
                {stockHoldings.map(h => {
                  const a = stockAssets.find(a => a.id === h.assetId)!;
                  const cur = stockPrices[h.assetId]?.current ?? h.avgBuyPrice;
                  const pnl = (cur - h.avgBuyPrice) * h.quantity;
                  const pnlPct = ((cur - h.avgBuyPrice) / h.avgBuyPrice) * 100;
                  return (
                    <button
                      key={h.assetId}
                      onClick={() => { setView('stocks'); setSelectedAsset(h.assetId); setTradeType('sell'); }}
                      className="stat-card w-full rounded-xl p-3 flex items-center gap-3 text-left hover:ring-2 hover:ring-primary/30 transition-all"
                    >
                      <AssetLogo assetId={a.id} size={24} />
                      <div className="flex-1">
                        <span className="font-bold text-foreground text-sm">{a.ticker}</span>
                        <p className="text-xs text-muted-foreground">{h.quantity} {t('inv.pcs')} · avg ${formatMoney(h.avgBuyPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">${formatMoney(cur * h.quantity)}</p>
                        <p className={`text-xs ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {pnl >= 0 ? '+' : ''}{formatMoney(pnl)} ({pnlPct.toFixed(1)}%)
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {cryptoHoldings.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-1"><GameIcon name="crypto" size={14} /> {t('inv.crypto')}</h3>
              <div className="space-y-2">
                {cryptoHoldings.map(h => {
                  const a = cryptoAssets.find(a => a.id === h.assetId)!;
                  const cur = cryptoPrices[h.assetId]?.current ?? h.avgBuyPrice;
                  const pnl = (cur - h.avgBuyPrice) * h.quantity;
                  const pnlPct = ((cur - h.avgBuyPrice) / h.avgBuyPrice) * 100;
                  return (
                    <button
                      key={h.assetId}
                      onClick={() => { setView('crypto'); setSelectedAsset(h.assetId); setTradeType('sell'); }}
                      className="stat-card w-full rounded-xl p-3 flex items-center gap-3 text-left hover:ring-2 hover:ring-primary/30 transition-all"
                    >
                      <AssetLogo assetId={a.id} size={24} />
                      <div className="flex-1">
                        <span className="font-bold text-foreground text-sm">{a.ticker}</span>
                        <p className="text-xs text-muted-foreground">{h.quantity.toFixed(4)} · avg ${formatMoney(h.avgBuyPrice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">${formatMoney(cur * h.quantity)}</p>
                        <p className={`text-xs ${pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                          {pnl >= 0 ? '+' : ''}{formatMoney(pnl)} ({pnlPct.toFixed(1)}%)
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InvestmentsTab;
