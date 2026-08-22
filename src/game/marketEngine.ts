import type { CryptoAsset, StockAsset } from '@/data/investmentData';
import type { PriceData } from './types';

export type MarketRange = '1d' | '3d' | '7d' | '1m' | '6m' | '1y' | '5y' | 'all';
export const MARKET_RANGES: Array<{ id: MarketRange; label: string; durationMs: number; points: number }> = [
  { id: '1d', label: 'День', durationMs: 864e5, points: 48 },
  { id: '3d', label: '3 дня', durationMs: 3 * 864e5, points: 72 },
  { id: '7d', label: '7 дней', durationMs: 7 * 864e5, points: 84 },
  { id: '1m', label: 'Месяц', durationMs: 30 * 864e5, points: 90 },
  { id: '6m', label: 'Полгода', durationMs: 182 * 864e5, points: 120 },
  { id: '1y', label: 'Год', durationMs: 365 * 864e5, points: 150 },
  { id: '5y', label: '5 лет', durationMs: 5 * 365 * 864e5, points: 200 },
  { id: 'all', label: 'Всё время', durationMs: 8 * 365 * 864e5, points: 240 },
];

const EPOCH = Date.UTC(2025, 0, 1);
const YEAR = 365.25 * 864e5;
const hash = (value: string) => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};
const smoothNoise = (id: string, time: number, knotMs: number) => {
  const knot = Math.floor(time / knotMs);
  const part = time / knotMs - knot;
  const eased = part * part * (3 - 2 * part);
  const a = hash(`${id}:${knot}`) * 2 - 1;
  const b = hash(`${id}:${knot + 1}`) * 2 - 1;
  return a + (b - a) * eased;
};
const roundPrice = (price: number) => Number(price.toFixed(price < 1 ? 4 : 2));

/** Deterministic UTC market: every player receives the same price for the same moment. */
export function marketPriceAt(asset: StockAsset | CryptoAsset, kind: 'stocks' | 'crypto', timestamp = Date.now()): number {
  const years = (timestamp - EPOCH) / YEAR;
  const seed = hash(asset.id);
  const annualTrend = kind === 'stocks' ? 0.035 + seed * 0.075 : 0.06 + seed * 0.16;
  const macro = Math.sin(years * Math.PI * (1.1 + seed) + seed * 8) * asset.volatility * 0.22;
  const medium = Math.sin(years * Math.PI * 11 + seed * 20) * asset.volatility * 0.08;
  const noise = smoothNoise(asset.id, timestamp, kind === 'stocks' ? 12 * 36e5 : 6 * 36e5) * asset.volatility * 0.055;
  return roundPrice(Math.max(asset.basePrice * 0.08, asset.basePrice * Math.exp(annualTrend * years + macro + medium + noise)));
}

export function marketHistory(asset: StockAsset | CryptoAsset, kind: 'stocks' | 'crypto', range: MarketRange, now = Date.now()) {
  const config = MARKET_RANGES.find(item => item.id === range) || MARKET_RANGES[0];
  return Array.from({ length: config.points }, (_, index) => {
    const time = now - config.durationMs + config.durationMs * index / (config.points - 1);
    return { time, value: marketPriceAt(asset, kind, time) };
  });
}

export function sharedMarketPrices(stocks: StockAsset[], crypto: CryptoAsset[], now = Date.now()): { stocks: PriceData; crypto: PriceData } {
  const make = (assets: Array<StockAsset | CryptoAsset>, kind: 'stocks' | 'crypto') => Object.fromEntries(assets.map(asset => {
    const history = marketHistory(asset, kind, '1d', now).map(point => point.value);
    return [asset.id, { current: history[history.length - 1], history }];
  }));
  return { stocks: make(stocks, 'stocks'), crypto: make(crypto, 'crypto') };
}
