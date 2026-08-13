import type {
  Business,
  CryptoHolding,
  LicensePlateState,
  ShopItem,
  StockHolding,
  Upgrade,
} from './types';

export interface SerializableGameState {
  balance: number;
  clickPower: number;
  playerXp: number;
  totalEarnedClick: number;
  totalEarnedBusiness: number;
  totalEarnedRent: number;
  totalEarnedDividends: number;
  totalEarnedTrading: number;
  totalEarnedCrypto: number;
  totalEarnedGems: number;
  upgrades: Upgrade[];
  shopItems: ShopItem[];
  accessoryItems: ShopItem[];
  businesses: Business[];
  stockHoldings: StockHolding[];
  cryptoHoldings: CryptoHolding[];
  licensePlates: LicensePlateState[];
  stockPrices: Record<string, { current: number; history: number[] }>;
  cryptoPrices: Record<string, { current: number; history: number[] }>;
}

export function serializeState(state: SerializableGameState): Record<string, unknown> {
  return {
    savedAt: Date.now(),
    balance: state.balance,
    clickPower: state.clickPower,
    playerXp: state.playerXp,
    totalEarnedClick: state.totalEarnedClick,
    totalEarnedBusiness: state.totalEarnedBusiness,
    totalEarnedRent: state.totalEarnedRent,
    totalEarnedDividends: state.totalEarnedDividends,
    totalEarnedTrading: state.totalEarnedTrading,
    totalEarnedCrypto: state.totalEarnedCrypto,
    totalEarnedGems: state.totalEarnedGems,
    upgradeLevels: state.upgrades.map(upgrade => ({
      id: upgrade.id,
      currentLevel: upgrade.currentLevel,
    })),
    purchasedShop: state.shopItems
      .filter(item => item.purchased)
      .map(item => ({ id: item.id, price: item.price })),
    purchasedAccessories: state.accessoryItems
      .filter(item => item.purchased)
      .map(item => item.id),
    businesses: state.businesses,
    stockHoldings: state.stockHoldings,
    cryptoHoldings: state.cryptoHoldings,
    licensePlates: state.licensePlates,
    stockPrices: state.stockPrices,
    cryptoPrices: state.cryptoPrices,
  };
}

export function savedStateTimestamp(state: Record<string, unknown> | null): number {
  if (!state) return 0;
  const value = Number(state.savedAt);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/** A device-local save is authoritative; cloud is only for first-time restore. */
export function selectStartupState(
  localState: Record<string, unknown> | null,
  cloudState: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return localState ?? cloudState;
}
