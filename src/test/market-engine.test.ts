import { describe, expect, it } from 'vitest';
import { stockAssets, cryptoAssets } from '@/data/investmentData';
import { MARKET_RANGES, marketHistory, marketPriceAt, sharedMarketPrices } from '@/game/marketEngine';

describe('shared market engine', () => {
  const timestamp = Date.UTC(2026, 7, 22, 12, 0, 0);

  it('returns exactly the same price for the same asset and UTC moment', () => {
    expect(marketPriceAt(stockAssets[0], 'stocks', timestamp)).toBe(marketPriceAt(stockAssets[0], 'stocks', timestamp));
    expect(marketPriceAt(cryptoAssets[0], 'crypto', timestamp)).toBe(marketPriceAt(cryptoAssets[0], 'crypto', timestamp));
  });

  it('builds every requested chart period with positive finite prices', () => {
    for (const range of MARKET_RANGES) {
      const points = marketHistory(stockAssets[0], 'stocks', range.id, timestamp);
      expect(points).toHaveLength(range.points);
      expect(points.every(point => Number.isFinite(point.value) && point.value > 0)).toBe(true);
    }
  });

  it('creates a complete shared snapshot', () => {
    const snapshot = sharedMarketPrices(stockAssets, cryptoAssets, timestamp);
    expect(Object.keys(snapshot.stocks)).toHaveLength(stockAssets.length);
    expect(Object.keys(snapshot.crypto)).toHaveLength(cryptoAssets.length);
  });
});
