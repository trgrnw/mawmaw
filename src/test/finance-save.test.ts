import { describe, expect, it } from 'vitest';
import { calculateFinancialSnapshot } from '@/game/finance';
import { savedStateTimestamp, serializeState } from '@/game/save';

describe('financial snapshot', () => {
  it('includes cash and every owned asset category in net worth', () => {
    const snapshot = calculateFinancialSnapshot({
      balance: 1_000,
      shopItems: [
        { id: 'home', name: 'Home', category: 'realestate', price: 2_000, emoji: '', purchased: true },
        { id: 'garage', name: 'Garage', category: 'garage', price: 3_000, emoji: '', purchased: true },
        { id: 'island', name: 'Island', category: 'islands', price: 4_000, emoji: '', purchased: true },
      ],
      accessoryItems: [{ id: 'art', name: 'Art', category: 'art', price: 5_000, emoji: '', purchased: true }],
      businesses: [{ id: 'biz', name: 'Biz', categoryId: 'it', categoryName: 'IT', emoji: '', investmentCost: 6_000, incomePerHour: 1, taxRate: 0.23, taxDueAt: 0, taxPaid: true, taxAmount: 0, createdAt: 0 }],
      stockHoldings: [{ assetId: 'stock', quantity: 2, avgBuyPrice: 10 }],
      cryptoHoldings: [{ assetId: 'coin', quantity: 3, avgBuyPrice: 10 }],
      stockPrices: { stock: { current: 10, history: [10] } },
      cryptoPrices: { coin: { current: 10, history: [10] } },
    });

    expect(snapshot.infrastructure).toBe(3_000);
    expect(snapshot.islands).toBe(4_000);
    expect(snapshot.netWorth).toBe(21_050);
  });
});

describe('save freshness', () => {
  it('serializes prices and a comparable timestamp', () => {
    const state = serializeState({
      balance: 1, clickPower: 1, playerXp: 0,
      totalEarnedClick: 0, totalEarnedBusiness: 0, totalEarnedRent: 0,
      totalEarnedDividends: 0, totalEarnedTrading: 0, totalEarnedCrypto: 0, totalEarnedGems: 0,
      upgrades: [], shopItems: [], accessoryItems: [], businesses: [], stockHoldings: [], cryptoHoldings: [], licensePlates: [],
      stockPrices: { stock: { current: 123, history: [123] } },
      cryptoPrices: { coin: { current: 456, history: [456] } },
    });

    expect(savedStateTimestamp(state)).toBeGreaterThan(0);
    expect((state.stockPrices as Record<string, { current: number }>).stock.current).toBe(123);
    expect((state.cryptoPrices as Record<string, { current: number }>).coin.current).toBe(456);
  });

  it('keeps purchased businesses, stocks and crypto in the durable snapshot', () => {
    const state = serializeState({
      balance: 50, clickPower: 1, playerXp: 0,
      totalEarnedClick: 0, totalEarnedBusiness: 0, totalEarnedRent: 0,
      totalEarnedDividends: 0, totalEarnedTrading: 0, totalEarnedCrypto: 0, totalEarnedGems: 0,
      upgrades: [], shopItems: [], accessoryItems: [], licensePlates: [],
      businesses: [{ id: 'b1', name: 'Company', categoryId: 'it', categoryName: 'IT', emoji: '', investmentCost: 100, incomePerHour: 5, taxRate: 0.23, taxDueAt: 1, taxPaid: true, taxAmount: 0, createdAt: 1 }],
      stockHoldings: [{ assetId: 'stock', quantity: 2, avgBuyPrice: 10 }],
      cryptoHoldings: [{ assetId: 'coin', quantity: 3, avgBuyPrice: 20 }],
      stockPrices: { stock: { current: 11, history: [10, 11] } },
      cryptoPrices: { coin: { current: 21, history: [20, 21] } },
    });

    expect(state.businesses).toHaveLength(1);
    expect(state.stockHoldings).toEqual([{ assetId: 'stock', quantity: 2, avgBuyPrice: 10 }]);
    expect(state.cryptoHoldings).toEqual([{ assetId: 'coin', quantity: 3, avgBuyPrice: 20 }]);
  });
});
