import { describe, expect, it } from 'vitest';
import {
  calculateBusinessRefund,
  calculateBusinessTax,
  calculateTotalTaxDue,
  createBusiness,
} from '@/game/businesses';
import {
  calculatePortfolioValue,
  calculateTradeProfit,
  calculateWeightedAveragePrice,
} from '@/game/investments';
import { serializeState } from '@/game/save';
import { defaultUpgrades } from '@/game/upgrades';
import {
  levelFromXp,
  progressionFromXp,
  rewardForLevel,
  rewardsBetweenLevels,
  totalXpForLevel,
} from '@/game/progression';

const NOW = 1_700_000_000_000;

describe('game economy helpers', () => {
  it('keeps business tax at 23% for 72 hours', () => {
    expect(calculateBusinessTax({ incomePerHour: 1000 })).toBeCloseTo(16_560);
  });

  it('keeps the 45% business sale refund', () => {
    expect(calculateBusinessRefund({ investmentCost: 100_000 })).toBe(45_000);
  });

  it('creates businesses with the existing tax schedule', () => {
    const business = createBusiness({
      id: 'biz-1',
      name: 'Test',
      categoryId: 'test',
      categoryName: 'Test',
      emoji: '🏢',
      investmentCost: 1000,
      incomePerHour: 100,
      now: NOW,
    });

    expect(business.taxRate).toBe(0.23);
    expect(business.taxDueAt).toBe(NOW + 72 * 60 * 60 * 1000);
    expect(business.taxPaid).toBe(true);
  });

  it('counts only overdue unpaid taxes', () => {
    const overdue = createBusiness({
      id: 'overdue', name: 'A', categoryId: 'a', categoryName: 'A', emoji: 'A',
      investmentCost: 1, incomePerHour: 100, now: NOW - 73 * 60 * 60 * 1000,
    });
    overdue.taxPaid = false;
    overdue.taxAmount = 123;

    const paid = { ...overdue, id: 'paid', taxPaid: true, taxAmount: 999 };
    expect(calculateTotalTaxDue([overdue, paid], NOW)).toBe(123);
  });

  it('calculates portfolio values and weighted averages', () => {
    expect(calculatePortfolioValue(
      [{ assetId: 'x', quantity: 2, avgBuyPrice: 10 }],
      { x: { current: 25, history: [25] } },
    )).toBe(50);

    expect(calculateWeightedAveragePrice({
      currentQuantity: 2,
      currentAveragePrice: 10,
      addedQuantity: 2,
      addedCost: 60,
    })).toBe(20);
  });

  it('calculates realized trade profit', () => {
    expect(calculateTradeProfit({ sellPrice: 15, averageBuyPrice: 10, quantity: 4 })).toBe(20);
  });

  it('preserves the existing save shape', () => {
    const serialized = serializeState({
      balance: 100,
      clickPower: 2,
      playerXp: 125,
      totalEarnedClick: 10,
      totalEarnedBusiness: 20,
      totalEarnedRent: 30,
      totalEarnedDividends: 40,
      totalEarnedTrading: 50,
      totalEarnedCrypto: 60,
      totalEarnedGems: 70,
      upgrades: defaultUpgrades,
      shopItems: [],
      accessoryItems: [],
      businesses: [],
      stockHoldings: [],
      cryptoHoldings: [],
      licensePlates: [],
    });

    expect(serialized).toHaveProperty('upgradeLevels');
    expect(serialized).toHaveProperty('purchasedShop');
    expect(serialized).toHaveProperty('purchasedAccessories');
    expect(serialized).not.toHaveProperty('upgrades');
    expect(serialized.playerXp).toBe(125);
  });

  it('calculates deterministic levels, progress and rewards', () => {
    expect(totalXpForLevel(1)).toBe(0);
    expect(totalXpForLevel(2)).toBe(100);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(progressionFromXp(100).progress).toBe(0);
    expect(rewardsBetweenLevels(1, 3)).toBe(rewardForLevel(2) + rewardForLevel(3));
  });
});
