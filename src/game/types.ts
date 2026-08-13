export interface UpgradeLevel {
  level: number;
  bonus: number;
  cost: number;
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  emoji: string;
  currentLevel: number;
  maxLevel: number;
  levels: UpgradeLevel[];
}

export interface LicensePlateState {
  id: string;
  text: string;
  country: string;
  assignedTo: string | null;
  isCustom: boolean;
}

export interface ShopItem {
  id: string;
  name: string;
  category: string;
  price: number;
  emoji: string;
  purchased: boolean;
}

export interface Business {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  emoji: string;
  investmentCost: number;
  incomePerHour: number;
  taxRate: number;
  taxDueAt: number;
  taxPaid: boolean;
  taxAmount: number;
  createdAt: number;
}

export interface StockHolding {
  assetId: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface CryptoHolding {
  assetId: string;
  quantity: number;
  avgBuyPrice: number;
}

export interface PriceData {
  [assetId: string]: {
    current: number;
    history: number[];
  };
}

export interface GameState {
  balance: number;
  clickPower: number;
  playerXp: number;
  playerLevel: number;
  levelStartXp: number;
  nextLevelXp: number;
  levelProgress: number;
  hourlyIncome: number;
  hourlyIncomeBusiness: number;
  hourlyIncomeRent: number;
  hourlyIncomeDividends: number;
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
  passiveIncome: number;
  netWorth: number;
  totalTaxDue: number;
  stockHoldings: StockHolding[];
  cryptoHoldings: CryptoHolding[];
  stockPrices: PriceData;
  cryptoPrices: PriceData;
  licensePlates: LicensePlateState[];
}

export interface GameContextType extends GameState {
  click: () => void;
  buyUpgrade: (id: string) => boolean;
  buyShopItem: (id: string, customPrice?: number) => boolean;
  syncProgress: () => Promise<void>;
  buyAccessory: (id: string) => boolean;
  openBusiness: (categoryId: string, name: string) => boolean;
  mergeBusiness: (mergerId: string) => boolean;
  deleteBusiness: (id: string) => boolean;
  payTaxes: () => boolean;
  buyStock: (assetId: string, quantity: number) => boolean;
  sellStock: (assetId: string, quantity: number) => boolean;
  buyCrypto: (assetId: string, amount: number) => boolean;
  sellCrypto: (assetId: string, amount: number) => boolean;
  spendBalance: (amount: number) => boolean;
  addBalance: (amount: number, earnedAmount?: number) => void;
  replaceBalance: (amount: number) => void;
  addExperience: (amount: number) => void;
  addLicensePlate: (plate: LicensePlateState) => void;
  assignPlate: (plateId: string, carId: string | null) => void;
  removePlate: (plateId: string) => void;
  formatMoney: (n: number) => string;
}
