import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { businessCategories } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import { shopItemsData, accessoryItemsData } from '@/data/shopData';
import { stockAssets, cryptoAssets, generatePriceHistory, nextPriceTick } from '@/data/investmentData';
import { useAuth } from '@/context/AuthContext';
import { useCloudSave } from '@/hooks/useCloudSave';
import { supabase } from '@/integrations/supabase/client';

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

// ── Investment types ──
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

interface GameState {
  balance: number;
  clickPower: number;
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

interface GameContextType extends GameState {
  click: () => void;
  buyUpgrade: (id: string) => boolean;
  buyShopItem: (id: string, customPrice?: number) => boolean;
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
  addBalance: (amount: number) => void;
  addLicensePlate: (plate: LicensePlateState) => void;
  assignPlate: (plateId: string, carId: string | null) => void;
  removePlate: (plateId: string) => void;
  formatMoney: (n: number) => string;
}

// Generate progressive upgrade levels
function generateUpgradeLevels(): UpgradeLevel[] {
  const levels: UpgradeLevel[] = [];
  let totalBonus = 0;
  let cost = 50;
  let bonus = 1;
  let level = 1;
  
  while (totalBonus + bonus <= 5900) {
    levels.push({ level, bonus, cost: Math.round(cost) });
    totalBonus += bonus;
    level++;
    if (totalBonus < 10) bonus = 1;
    else if (totalBonus < 50) bonus = 2;
    else if (totalBonus < 200) bonus = 5;
    else if (totalBonus < 500) bonus = 10;
    else if (totalBonus < 1000) bonus = 25;
    else if (totalBonus < 2000) bonus = 50;
    else if (totalBonus < 3500) bonus = 100;
    else bonus = 200;
    cost = cost * 1.35 + bonus * 10;
  }
  
  return levels;
}

const upgradeLevels = generateUpgradeLevels();

const defaultUpgrades: Upgrade[] = [
  {
    id: 'click-power',
    name: 'Сила клика',
    description: 'Увеличивает доход за каждый клик',
    emoji: '👆',
    currentLevel: 0,
    maxLevel: upgradeLevels.length,
    levels: upgradeLevels,
  },
];

const defaultShopItems: ShopItem[] = shopItemsData.map(i => ({
  id: i.id,
  name: i.name,
  category: i.categoryId,
  price: i.basePrice,
  emoji: i.emoji,
  purchased: false,
}));

const defaultAccessories: ShopItem[] = accessoryItemsData.map(i => ({
  id: i.id,
  name: i.name,
  category: i.categoryId,
  price: i.basePrice,
  emoji: i.emoji,
  purchased: false,
}));

const TAX_PERIOD_MS = 72 * 60 * 60 * 1000;
const BUSINESS_TAX_RATE = 0.23;

// Initialize prices
function initPrices(): { stocks: PriceData; crypto: PriceData } {
  const stocks: PriceData = {};
  stockAssets.forEach(a => {
    const history = generatePriceHistory(a.basePrice, a.volatility, 30);
    stocks[a.id] = { current: history[history.length - 1], history };
  });
  const crypto: PriceData = {};
  cryptoAssets.forEach(a => {
    const history = generatePriceHistory(a.basePrice, a.volatility, 30);
    crypto[a.id] = { current: history[history.length - 1], history };
  });
  return { stocks, crypto };
}

const initialPrices = initPrices();

const GameContext = createContext<GameContextType | null>(null);

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be within GameProvider');
  return ctx;
};

export const formatMoney = (n: number): string => {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + ' трлн';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + ' млрд';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + ' млн';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + ' тыс';
  return n.toFixed(2);
};

// ── Serialization helpers ──
function serializeState(state: {
  balance: number; clickPower: number;
  totalEarnedClick: number; totalEarnedBusiness: number; totalEarnedRent: number;
  totalEarnedDividends: number; totalEarnedTrading: number; totalEarnedCrypto: number; totalEarnedGems: number;
  upgrades: Upgrade[]; shopItems: ShopItem[]; accessoryItems: ShopItem[];
  businesses: Business[]; stockHoldings: StockHolding[]; cryptoHoldings: CryptoHolding[];
  licensePlates: LicensePlateState[];
}): Record<string, unknown> {
  return {
    balance: state.balance,
    clickPower: state.clickPower,
    totalEarnedClick: state.totalEarnedClick,
    totalEarnedBusiness: state.totalEarnedBusiness,
    totalEarnedRent: state.totalEarnedRent,
    totalEarnedDividends: state.totalEarnedDividends,
    totalEarnedTrading: state.totalEarnedTrading,
    totalEarnedCrypto: state.totalEarnedCrypto,
    totalEarnedGems: state.totalEarnedGems,
    upgradeLevels: state.upgrades.map(u => ({ id: u.id, currentLevel: u.currentLevel })),
    purchasedShop: state.shopItems.filter(i => i.purchased).map(i => ({ id: i.id, price: i.price })),
    purchasedAccessories: state.accessoryItems.filter(i => i.purchased).map(i => i.id),
    businesses: state.businesses,
    stockHoldings: state.stockHoldings,
    cryptoHoldings: state.cryptoHoldings,
    licensePlates: state.licensePlates,
  };
}

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { saveToCloud, loadFromCloud, forceSave } = useCloudSave(user?.id);
  const [loaded, setLoaded] = useState(false);
  const cloudLoadOkRef = useRef(false);

  const [balance, setBalance] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [totalEarnedClick, setTotalEarnedClick] = useState(0);
  const [totalEarnedBusiness, setTotalEarnedBusiness] = useState(0);
  const [totalEarnedRent, setTotalEarnedRent] = useState(0);
  const [totalEarnedDividends, setTotalEarnedDividends] = useState(0);
  const [totalEarnedTrading, setTotalEarnedTrading] = useState(0);
  const [totalEarnedCrypto, setTotalEarnedCrypto] = useState(0);
  const [totalEarnedGems, setTotalEarnedGems] = useState(0);
  const [upgrades, setUpgrades] = useState<Upgrade[]>(defaultUpgrades);
  const [shopItems, setShopItems] = useState<ShopItem[]>(defaultShopItems);
  const [accessoryItems, setAccessoryItems] = useState<ShopItem[]>(defaultAccessories);
  const [businesses, setBusinesses] = useState<Business[]>([]);

  // Investments
  const [stockHoldings, setStockHoldings] = useState<StockHolding[]>([]);
  const [cryptoHoldings, setCryptoHoldings] = useState<CryptoHolding[]>([]);
  const [stockPrices, setStockPrices] = useState<PriceData>(initialPrices.stocks);
  const [cryptoPrices, setCryptoPrices] = useState<PriceData>(initialPrices.crypto);
  const [licensePlates, setLicensePlates] = useState<LicensePlateState[]>([]);

  // ── Reset state to defaults ──
  function resetToDefaults() {
    setBalance(0);
    setClickPower(1);
    setTotalEarnedClick(0);
    setTotalEarnedBusiness(0);
    setTotalEarnedRent(0);
    setTotalEarnedDividends(0);
    setTotalEarnedTrading(0);
    setTotalEarnedCrypto(0);
    setTotalEarnedGems(0);
    setUpgrades(defaultUpgrades.map(u => ({ ...u, currentLevel: 0 })));
    setShopItems(defaultShopItems.map(i => ({ ...i, purchased: false })));
    setAccessoryItems(defaultAccessories.map(i => ({ ...i, purchased: false })));
    setBusinesses([]);
    setStockHoldings([]);
    setCryptoHoldings([]);
    setLicensePlates([]);
  }

  const prevUserId = useRef<string | null | undefined>(undefined);

  // ── Load from local storage or cloud ──
  useEffect(() => {
    const loadState = async () => {
      // If user changed (logout or switch), reset first
      if (prevUserId.current !== undefined && prevUserId.current !== (user?.id ?? null)) {
        resetToDefaults();
      }
      prevUserId.current = user?.id ?? null;

      let saved: Record<string, unknown> | null = null;
      let cloudExistedOrEmpty = false;

      // No user = fresh state, no localStorage fallback
      if (!user?.id) {
        resetToDefaults();
        cloudLoadOkRef.current = false;
        setLoaded(true);
        return;
      }

      // Try cloud first — RETRY on transient failure to avoid wiping save
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const { data, error } = await supabase
            .from('game_saves')
            .select('game_state, pending_balance')
            .eq('user_id', user.id)
            .maybeSingle();
          if (error) throw error;
          cloudExistedOrEmpty = true; // query succeeded
          if (data) {
            const state = (data.game_state as Record<string, unknown>) || {};
            const pending = Number((data as any).pending_balance) || 0;
            if (pending !== 0) {
              state.balance = (Number(state.balance) || 0) + pending;
              await supabase.from('game_saves').update({ pending_balance: 0 } as any)
                .eq('user_id', user.id).eq('pending_balance', pending);
            }
            saved = state;
          }
          break;
        } catch (e) {
          if (attempt === 2) {
            console.error('[GameContext] cloud load failed after retries', e);
          } else {
            await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
          }
        }
      }

      // Fallback to user-scoped localStorage
      if (!saved) {
        const local = localStorage.getItem(`gameState_${user.id}`);
        if (local) {
          try { saved = JSON.parse(local); } catch { /* ignore */ }
        }
      }

      if (saved) {
        applyLoadedState(saved);
      }
      // CRITICAL: only enable autosave if we successfully reached the cloud OR have local backup.
      // Otherwise we'd autosave default zeros and wipe the real cloud save.
      cloudLoadOkRef.current = cloudExistedOrEmpty || !!saved;
      setLoaded(true);
    };
    loadState();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function applyLoadedState(saved: Record<string, unknown>) {
    if (typeof saved.balance === 'number') setBalance(saved.balance);
    if (typeof saved.clickPower === 'number') setClickPower(saved.clickPower);
    if (typeof saved.totalEarnedClick === 'number') setTotalEarnedClick(saved.totalEarnedClick);
    if (typeof saved.totalEarnedBusiness === 'number') setTotalEarnedBusiness(saved.totalEarnedBusiness);
    if (typeof saved.totalEarnedRent === 'number') setTotalEarnedRent(saved.totalEarnedRent);
    if (typeof saved.totalEarnedDividends === 'number') setTotalEarnedDividends(saved.totalEarnedDividends);
    if (typeof saved.totalEarnedTrading === 'number') setTotalEarnedTrading(saved.totalEarnedTrading);
    if (typeof saved.totalEarnedCrypto === 'number') setTotalEarnedCrypto(saved.totalEarnedCrypto);
    if (typeof saved.totalEarnedGems === 'number') setTotalEarnedGems(saved.totalEarnedGems);

    if (Array.isArray(saved.upgradeLevels)) {
      setUpgrades(prev => prev.map(u => {
        const s = (saved.upgradeLevels as Array<{ id: string; currentLevel: number }>).find(x => x.id === u.id);
        return s ? { ...u, currentLevel: s.currentLevel } : u;
      }));
      // Recalculate clickPower from upgrade levels
      const cpUpgrade = (saved.upgradeLevels as Array<{ id: string; currentLevel: number }>).find(x => x.id === 'click-power');
      if (cpUpgrade && cpUpgrade.currentLevel > 0) {
        const totalBonus = upgradeLevels.slice(0, cpUpgrade.currentLevel).reduce((s, l) => s + l.bonus, 0);
        setClickPower(1 + totalBonus);
      }
    }

    if (Array.isArray(saved.purchasedShop)) {
      setShopItems(prev => prev.map(i => {
        const p = (saved.purchasedShop as Array<{ id: string; price: number }>).find(x => x.id === i.id);
        return p ? { ...i, purchased: true, price: p.price } : i;
      }));
    }

    if (Array.isArray(saved.purchasedAccessories)) {
      setAccessoryItems(prev => prev.map(i =>
        (saved.purchasedAccessories as string[]).includes(i.id) ? { ...i, purchased: true } : i
      ));
    }

    if (Array.isArray(saved.businesses)) {
      setBusinesses(saved.businesses as Business[]);
    }
    if (Array.isArray(saved.stockHoldings)) {
      setStockHoldings(saved.stockHoldings as StockHolding[]);
    }
    if (Array.isArray(saved.cryptoHoldings)) {
      setCryptoHoldings(saved.cryptoHoldings as CryptoHolding[]);
    }
    if (Array.isArray(saved.licensePlates)) {
      setLicensePlates(saved.licensePlates as LicensePlateState[]);
    }
  }

  // ── Refs for latest state (used by interval-based save) ──
  const latestState = useRef({
    balance, clickPower, totalEarnedClick, totalEarnedBusiness, totalEarnedRent,
    totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
    upgrades, shopItems, accessoryItems, businesses, stockHoldings, cryptoHoldings,
    stockPrices, cryptoPrices, licensePlates,
  });
  latestState.current = {
    balance, clickPower, totalEarnedClick, totalEarnedBusiness, totalEarnedRent,
    totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
    upgrades, shopItems, accessoryItems, businesses, stockHoldings, cryptoHoldings,
    stockPrices, cryptoPrices, licensePlates,
  };

  const performSave = useCallback(() => {
    const s = latestState.current;
    if (!user?.id) return;

    const state = serializeState({
      balance: s.balance, clickPower: s.clickPower,
      totalEarnedClick: s.totalEarnedClick, totalEarnedBusiness: s.totalEarnedBusiness,
      totalEarnedRent: s.totalEarnedRent, totalEarnedDividends: s.totalEarnedDividends,
      totalEarnedTrading: s.totalEarnedTrading, totalEarnedCrypto: s.totalEarnedCrypto,
      totalEarnedGems: s.totalEarnedGems,
      upgrades: s.upgrades, shopItems: s.shopItems, accessoryItems: s.accessoryItems,
      businesses: s.businesses, stockHoldings: s.stockHoldings, cryptoHoldings: s.cryptoHoldings,
      licensePlates: s.licensePlates,
    });

    // Save to user-scoped localStorage
    localStorage.setItem(`gameState_${user.id}`, JSON.stringify(state));

    // Net worth = same as profile (assets only, NO balance)
    const shopT = s.shopItems.filter(i => i.purchased).reduce((sum, i) => sum + i.price, 0);
    const accT = s.accessoryItems.filter(i => i.purchased).reduce((sum, i) => sum + i.price, 0);
    const bizT = s.businesses.reduce((sum, b) => sum + b.investmentCost, 0);
    const stkV = s.stockHoldings.reduce((sum, h) => sum + (s.stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    const cryV = s.cryptoHoldings.reduce((sum, h) => sum + (s.cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    const nw = shopT + accT + bizT + stkV + cryV;

    // Cloud save (forceSave — no extra debounce)
    forceSave(state, nw);
  }, [user?.id, forceSave]);

  // ── Interval-based auto-save every 3 seconds ──
  useEffect(() => {
    if (!loaded || !user?.id) return;
    const interval = setInterval(() => {
      // Safety: never save if cloud was never reached (would wipe data with defaults)
      if (!cloudLoadOkRef.current) return;
      performSave();
    }, 3000);
    return () => clearInterval(interval);
  }, [loaded, user?.id, performSave]);

  // Save on beforeunload
  useEffect(() => {
    const handleUnload = () => performSave();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [performSave]);

  // --- Income calculations ---
  const hourlyIncomeRent = shopItems.filter(i => i.purchased && i.category === 'realestate')
    .reduce((sum, i) => {
      const data = shopItemsData.find(d => d.id === i.id);
      return sum + (data?.baseIncomePerHour || i.price * 0.01);
    }, 0);

  const now = Date.now();
  const hourlyIncomeBusiness = businesses
    .filter(b => b.taxPaid || now < b.taxDueAt)
    .reduce((sum, b) => sum + b.incomePerHour, 0);

  // Dividend income
  const hourlyIncomeDividends = stockHoldings.reduce((sum, h) => {
    const asset = stockAssets.find(a => a.id === h.assetId);
    if (!asset || !asset.dividendYield) return sum;
    const price = stockPrices[h.assetId]?.current ?? asset.basePrice;
    return sum + (asset.dividendYield * price * h.quantity / 8760);
  }, 0);

  const hourlyIncome = hourlyIncomeRent + hourlyIncomeBusiness + hourlyIncomeDividends;
  const passiveIncome = hourlyIncome / 3600;

  const totalTaxDue = businesses
    .filter(b => !b.taxPaid && Date.now() >= b.taxDueAt)
    .reduce((sum, b) => sum + b.taxAmount, 0);

  // --- Price tick every 3 seconds ---
  useEffect(() => {
    const interval = setInterval(() => {
      setStockPrices(prev => {
        const next = { ...prev };
        stockAssets.forEach(a => {
          const p = next[a.id];
          const newPrice = nextPriceTick(p.current, a.volatility);
          next[a.id] = {
            current: newPrice,
            history: [...p.history.slice(-29), newPrice],
          };
        });
        return next;
      });
      setCryptoPrices(prev => {
        const next = { ...prev };
        cryptoAssets.forEach(a => {
          const p = next[a.id];
          const newPrice = nextPriceTick(p.current, a.volatility);
          next[a.id] = {
            current: newPrice,
            history: [...p.history.slice(-29), newPrice],
          };
        });
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // --- Passive income tick ---
  const refsData = useRef({ passiveIncome, clickPower, hourlyIncomeRent, hourlyIncomeBusiness, hourlyIncomeDividends });
  refsData.current = { passiveIncome, clickPower, hourlyIncomeRent, hourlyIncomeBusiness, hourlyIncomeDividends };

  useEffect(() => {
    const interval = setInterval(() => {
      const { hourlyIncomeRent: rent, hourlyIncomeBusiness: biz, hourlyIncomeDividends: div } = refsData.current;
      if (rent > 0) {
        const rentPerSec = rent / 3600;
        setBalance(b => b + rentPerSec);
        setTotalEarnedRent(t => t + rentPerSec);
      }
      if (biz > 0) {
        const bizPerSec = biz / 3600;
        setBalance(b => b + bizPerSec);
        setTotalEarnedBusiness(t => t + bizPerSec);
      }
      if (div > 0) {
        const divPerSec = div / 3600;
        setBalance(b => b + divPerSec);
        setTotalEarnedDividends(t => t + divPerSec);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- Check pending_balance (market sales, offline income, bid escrow) every 5 seconds ---
  useEffect(() => {
    if (!user?.id || !loaded) return;
    const checkPending = async () => {
      const { data } = await supabase
        .from('game_saves')
        .select('pending_balance')
        .eq('user_id', user.id)
        .single();
      const pending = Number((data as any)?.pending_balance) || 0;
      if (pending !== 0) {
        setBalance(b => Math.max(0, b + pending));
        await supabase.from('game_saves').update({ pending_balance: 0 } as any).eq('user_id', user.id);
      }
    };
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [user?.id, loaded]);

  // --- Offline income claim once on load + heartbeat presence ---
  const offlineClaimedRef = useRef(false);
  useEffect(() => {
    if (!user?.id || !loaded || offlineClaimedRef.current) return;
    offlineClaimedRef.current = true;
    const claim = async () => {
      const hourly = refsData.current.hourlyIncomeRent + refsData.current.hourlyIncomeBusiness + refsData.current.hourlyIncomeDividends;
      try {
        const { data } = await supabase.rpc('claim_offline_income' as any, { p_hourly_income: hourly });
        const amount = Number((data as any)?.amount) || 0;
        const seconds = Number((data as any)?.seconds) || 0;
        if (amount > 0) {
          const hours = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          window.dispatchEvent(new CustomEvent('offline-income', { detail: { amount, hours, mins } }));
        }
      } catch { /* ignore */ }
    };
    const t = setTimeout(claim, 2000);
    return () => clearTimeout(t);
  }, [user?.id, loaded]);

  useEffect(() => {
    if (!user?.id || !loaded) return;
    const beat = () => { (supabase.rpc('heartbeat_presence' as any) as any).then(() => {}); };
    const interval = setInterval(beat, 60000);
    return () => clearInterval(interval);
  }, [user?.id, loaded]);

  // Tax check
  useEffect(() => {
    const interval = setInterval(() => {
      setBusinesses(prev => prev.map(b => {
        if (b.taxPaid && Date.now() >= b.taxDueAt) {
          return { ...b, taxPaid: false, taxAmount: b.incomePerHour * 72 * BUSINESS_TAX_RATE };
        }
        return b;
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const click = useCallback(() => {
    setBalance(b => b + clickPower);
    setTotalEarnedClick(t => t + clickPower);
  }, [clickPower]);

  const buyUpgrade = useCallback((id: string): boolean => {
    const up = upgrades.find(u => u.id === id);
    if (!up || up.currentLevel >= up.maxLevel) return false;
    const nextLevel = up.levels[up.currentLevel];
    if (!nextLevel || balance < nextLevel.cost) return false;
    setBalance(b => b - nextLevel.cost);
    if (id === 'click-power') {
      setClickPower(p => p + nextLevel.bonus);
    }
    setUpgrades(prev => prev.map(u =>
      u.id === id ? { ...u, currentLevel: u.currentLevel + 1 } : u
    ));
    return true;
  }, [upgrades, balance]);

  const buyShopItem = useCallback((id: string, customPrice?: number): boolean => {
    const item = shopItems.find(i => i.id === id);
    const price = customPrice ?? item?.price ?? 0;
    if (!item || item.purchased || balance < price) return false;
    setBalance(b => b - price);
    setShopItems(prev => prev.map(i => i.id === id ? { ...i, purchased: true, price } : i));
    return true;
  }, [shopItems, balance]);

  const buyAccessory = useCallback((id: string): boolean => {
    const item = accessoryItems.find(i => i.id === id);
    if (!item || item.purchased || balance < item.price) return false;
    setBalance(b => b - item.price);
    setAccessoryItems(prev => prev.map(i => i.id === id ? { ...i, purchased: true } : i));
    return true;
  }, [accessoryItems, balance]);

  const openBusiness = useCallback((categoryId: string, name: string): boolean => {
    const cat = businessCategories.find(c => c.id === categoryId);
    if (!cat || balance < cat.cost) return false;
    setBalance(b => b - cat.cost);
    const newBusiness: Business = {
      id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      categoryId: cat.id,
      categoryName: cat.name,
      emoji: cat.emoji,
      investmentCost: cat.cost,
      incomePerHour: cat.baseIncomePerHour,
      taxRate: BUSINESS_TAX_RATE,
      taxDueAt: Date.now() + TAX_PERIOD_MS,
      taxPaid: true,
      taxAmount: 0,
      createdAt: Date.now(),
    };
    setBusinesses(prev => [...prev, newBusiness]);
    return true;
  }, [balance]);

  const mergeBusiness = useCallback((mergerId: string): boolean => {
    const merger = businessMergers.find(m => m.id === mergerId);
    if (!merger) return false;

    const consumedBizIds: string[] = [];
    for (const catId of merger.requiredCategories) {
      const biz = businesses.find(b => b.categoryId === catId && !consumedBizIds.includes(b.id));
      if (!biz) return false;
      consumedBizIds.push(biz.id);
    }

    if (merger.minStockPortfolio) {
      const sv = stockHoldings.reduce((s, h) => s + (stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
      if (sv < merger.minStockPortfolio) return false;
    }
    if (merger.minCryptoPortfolio) {
      const cv = cryptoHoldings.reduce((s, h) => s + (cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
      if (cv < merger.minCryptoPortfolio) return false;
    }
    if (merger.minIslandCount) {
      if (shopItems.filter(i => i.purchased && i.category === 'islands').length < merger.minIslandCount) return false;
    }
    if (merger.minRealEstateValue) {
      const rv = shopItems.filter(i => i.purchased && i.category === 'realestate').reduce((s, i) => s + i.price, 0);
      if (rv < merger.minRealEstateValue) return false;
    }

    const totalInvestment = consumedBizIds.reduce((s, id) => {
      const b = businesses.find(biz => biz.id === id);
      return s + (b?.investmentCost ?? 0);
    }, 0);

    setBusinesses(prev => {
      const filtered = prev.filter(b => !consumedBizIds.includes(b.id));
      const newBiz: Business = {
        id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: merger.name,
        categoryId: merger.id,
        categoryName: merger.name,
        emoji: merger.emoji,
        investmentCost: totalInvestment,
        incomePerHour: merger.resultIncomePerHour,
        taxRate: BUSINESS_TAX_RATE,
        taxDueAt: Date.now() + TAX_PERIOD_MS,
        taxPaid: true,
        taxAmount: 0,
        createdAt: Date.now(),
      };
      return [...filtered, newBiz];
    });

    return true;
  }, [businesses, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, shopItems]);

  const deleteBusiness = useCallback((id: string): boolean => {
    const biz = businesses.find(b => b.id === id);
    if (!biz) return false;
    const refund = biz.investmentCost * 0.45;
    setBalance(b => b + refund);
    setBusinesses(prev => prev.filter(b => b.id !== id));
    return true;
  }, [businesses]);

  const payTaxes = useCallback((): boolean => {
    const unpaid = businesses.filter(b => !b.taxPaid && Date.now() >= b.taxDueAt);
    const totalDue = unpaid.reduce((s, b) => s + b.taxAmount, 0);
    if (totalDue <= 0 || balance < totalDue) return false;
    setBalance(b => b - totalDue);
    setBusinesses(prev => prev.map(b => {
      if (!b.taxPaid && Date.now() >= b.taxDueAt) {
        return { ...b, taxPaid: true, taxDueAt: Date.now() + TAX_PERIOD_MS, taxAmount: 0 };
      }
      return b;
    }));
    return true;
  }, [businesses, balance]);

  // ── Investment functions ──
  const buyStock = useCallback((assetId: string, quantity: number): boolean => {
    const price = stockPrices[assetId]?.current;
    if (!price || quantity <= 0) return false;
    const cost = price * quantity;
    if (balance < cost) return false;
    setBalance(b => b - cost);
    setStockHoldings(prev => {
      const existing = prev.find(h => h.assetId === assetId);
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = (existing.avgBuyPrice * existing.quantity + cost) / newQty;
        return prev.map(h => h.assetId === assetId ? { ...h, quantity: newQty, avgBuyPrice: newAvg } : h);
      }
      return [...prev, { assetId, quantity, avgBuyPrice: price }];
    });
    return true;
  }, [balance, stockPrices]);

  const sellStock = useCallback((assetId: string, quantity: number): boolean => {
    const holding = stockHoldings.find(h => h.assetId === assetId);
    if (!holding || quantity <= 0 || quantity > holding.quantity) return false;
    const price = stockPrices[assetId]?.current;
    if (!price) return false;
    const revenue = price * quantity;
    const profit = revenue - holding.avgBuyPrice * quantity;
    setBalance(b => b + revenue);
    if (profit > 0) setTotalEarnedTrading(t => t + profit);
    setStockHoldings(prev => {
      const newQty = holding.quantity - quantity;
      if (newQty <= 0) return prev.filter(h => h.assetId !== assetId);
      return prev.map(h => h.assetId === assetId ? { ...h, quantity: newQty } : h);
    });
    return true;
  }, [stockHoldings, stockPrices]);

  const buyCrypto = useCallback((assetId: string, amount: number): boolean => {
    const price = cryptoPrices[assetId]?.current;
    if (!price || amount <= 0) return false;
    const cost = price * amount;
    if (balance < cost) return false;
    setBalance(b => b - cost);
    setCryptoHoldings(prev => {
      const existing = prev.find(h => h.assetId === assetId);
      if (existing) {
        const newQty = existing.quantity + amount;
        const newAvg = (existing.avgBuyPrice * existing.quantity + cost) / newQty;
        return prev.map(h => h.assetId === assetId ? { ...h, quantity: newQty, avgBuyPrice: newAvg } : h);
      }
      return [...prev, { assetId, quantity: amount, avgBuyPrice: price }];
    });
    return true;
  }, [balance, cryptoPrices]);

  const sellCrypto = useCallback((assetId: string, amount: number): boolean => {
    const holding = cryptoHoldings.find(h => h.assetId === assetId);
    if (!holding || amount <= 0 || amount > holding.quantity) return false;
    const price = cryptoPrices[assetId]?.current;
    if (!price) return false;
    const revenue = price * amount;
    const profit = revenue - holding.avgBuyPrice * amount;
    setBalance(b => b + revenue);
    if (profit > 0) setTotalEarnedCrypto(t => t + profit);
    setCryptoHoldings(prev => {
      const newQty = holding.quantity - amount;
      if (newQty <= 0) return prev.filter(h => h.assetId !== assetId);
      return prev.map(h => h.assetId === assetId ? { ...h, quantity: newQty } : h);
    });
    return true;
  }, [cryptoHoldings, cryptoPrices]);

  const spendBalance = useCallback((amount: number): boolean => {
    if (amount <= 0 || balance < amount) return false;
    setBalance(b => b - amount);
    return true;
  }, [balance]);

  const addBalance = useCallback((amount: number) => {
    if (amount <= 0) return;
    setBalance(b => b + amount);
  }, []);

  // License plate functions
  const addLicensePlate = useCallback((plate: LicensePlateState) => {
    setLicensePlates(prev => [...prev, plate]);
  }, []);

  const assignPlate = useCallback((plateId: string, carId: string | null) => {
    setLicensePlates(prev => prev.map(p => {
      // Unassign any plate currently on this car
      if (carId && p.assignedTo === carId && p.id !== plateId) return { ...p, assignedTo: null };
      if (p.id === plateId) return { ...p, assignedTo: carId };
      return p;
    }));
  }, []);

  const removePlate = useCallback((plateId: string) => {
    setLicensePlates(prev => prev.filter(p => p.id !== plateId));
  }, []);

  // Net worth
  const shopTotal = shopItems.filter(i => i.purchased).reduce((s, i) => s + i.price, 0);
  const accessoryTotal = accessoryItems.filter(i => i.purchased).reduce((s, i) => s + i.price, 0);
  const businessTotal = businesses.reduce((s, b) => s + b.investmentCost, 0);
  const stockPortfolioValue = stockHoldings.reduce((s, h) => s + (stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
  const cryptoPortfolioValue = cryptoHoldings.reduce((s, h) => s + (cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
  const netWorth = shopTotal + accessoryTotal + businessTotal + stockPortfolioValue + cryptoPortfolioValue;

  return (
    <GameContext.Provider value={{
      balance, clickPower, hourlyIncome, hourlyIncomeBusiness, hourlyIncomeRent, hourlyIncomeDividends,
      totalEarnedClick, totalEarnedBusiness, totalEarnedRent, totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
      upgrades, shopItems, accessoryItems, businesses, passiveIncome, netWorth, totalTaxDue,
      stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, licensePlates,
      click, buyUpgrade, buyShopItem, buyAccessory, openBusiness, mergeBusiness, deleteBusiness, payTaxes,
      buyStock, sellStock, buyCrypto, sellCrypto, spendBalance, addBalance,
      addLicensePlate, assignPlate, removePlate, formatMoney,
    }}>
      {children}
    </GameContext.Provider>
  );
};
