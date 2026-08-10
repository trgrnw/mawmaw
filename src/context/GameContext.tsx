import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { businessCategories } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import { stockAssets, cryptoAssets, generatePriceHistory, nextPriceTick } from '@/data/investmentData';
import { useAuth } from '@/context/AuthContext';
import { useCloudSave } from '@/hooks/useCloudSave';
import { supabase } from '@/integrations/supabase/client';
import type {
  Business,
  CryptoHolding,
  GameContextType,
  LicensePlateState,
  PriceData,
  ShopItem,
  StockHolding,
  Upgrade,
} from '@/game/types';
import { defaultAccessories, defaultShopItems } from '@/game/defaults';
import { defaultUpgrades } from '@/game/upgrades';
import { TAX_PERIOD_MS } from '@/game/constants';
import {
  calculateBusinessRefund,
  calculateTotalTaxDue,
  createBusiness,
} from '@/game/businesses';
import {
  calculatePortfolioValue,
  calculateTradeProfit,
  calculateWeightedAveragePrice,
} from '@/game/investments';
import { serializeState } from '@/game/save';
import { formatMoney } from '@/game/format';
import {
  progressionFromXp,
  rewardsBetweenLevels,
  XP_PER_CLICK,
} from '@/game/progression';

export { formatMoney };

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

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { saveToCloud, loadFromCloud, forceSave } = useCloudSave(user?.id);
  const [loaded, setLoaded] = useState(false);
  const cloudLoadOkRef = useRef(false);

  const [balance, setBalance] = useState(0);
  const [clickPower, setClickPower] = useState(1);
  const [playerXp, setPlayerXp] = useState(0);
  const playerXpRef = useRef(0);
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
    playerXpRef.current = 0;
    setPlayerXp(0);
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
    if (typeof saved.playerXp === 'number') {
      const safeXp = Math.max(0, Math.floor(saved.playerXp));
      playerXpRef.current = safeXp;
      setPlayerXp(safeXp);
    }
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
    balance, clickPower, playerXp, totalEarnedClick, totalEarnedBusiness, totalEarnedRent,
    totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
    upgrades, shopItems, accessoryItems, businesses, stockHoldings, cryptoHoldings,
    stockPrices, cryptoPrices, licensePlates,
  });
  latestState.current = {
    balance, clickPower, playerXp, totalEarnedClick, totalEarnedBusiness, totalEarnedRent,
    totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
    upgrades, shopItems, accessoryItems, businesses, stockHoldings, cryptoHoldings,
    stockPrices, cryptoPrices, licensePlates,
  };

  const performSave = useCallback(() => {
    const s = latestState.current;
    if (!user?.id) return;

    const state = serializeState({
      balance: s.balance, clickPower: s.clickPower, playerXp: s.playerXp,
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

  const addExperience = useCallback((amount: number) => {
    const gainedXp = Math.max(0, Math.floor(amount));
    if (gainedXp === 0) return;

    const previousXp = playerXpRef.current;
    const nextXp = previousXp + gainedXp;
    const previousLevel = progressionFromXp(previousXp).level;
    const nextLevel = progressionFromXp(nextXp).level;

    playerXpRef.current = nextXp;
    setPlayerXp(nextXp);

    if (nextLevel > previousLevel) {
      const reward = rewardsBetweenLevels(previousLevel, nextLevel);
      setBalance(current => current + reward);
      window.dispatchEvent(new CustomEvent('player-level-up', {
        detail: { level: nextLevel, reward },
      }));
    }
  }, []);

  const click = useCallback(() => {
    setBalance(b => b + clickPower);
    setTotalEarnedClick(t => t + clickPower);
    addExperience(XP_PER_CLICK);
  }, [clickPower, addExperience]);

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
    addExperience(15 + up.currentLevel * 5);
    return true;
  }, [upgrades, balance, addExperience]);

  const buyShopItem = useCallback((id: string, customPrice?: number): boolean => {
    const item = shopItems.find(i => i.id === id);
    const price = customPrice ?? item?.price ?? 0;
    if (!item || item.purchased || balance < price) return false;
    setBalance(b => b - price);
    setShopItems(prev => prev.map(i => i.id === id ? { ...i, purchased: true, price } : i));
    addExperience(40);
    return true;
  }, [shopItems, balance, addExperience]);

  const buyAccessory = useCallback((id: string): boolean => {
    const item = accessoryItems.find(i => i.id === id);
    if (!item || item.purchased || balance < item.price) return false;
    setBalance(b => b - item.price);
    setAccessoryItems(prev => prev.map(i => i.id === id ? { ...i, purchased: true } : i));
    addExperience(30);
    return true;
  }, [accessoryItems, balance, addExperience]);

  const openBusiness = useCallback((categoryId: string, name: string): boolean => {
    const cat = businessCategories.find(c => c.id === categoryId);
    if (!cat || balance < cat.cost) return false;
    setBalance(b => b - cat.cost);
    const newBusiness = createBusiness({
      id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      categoryId: cat.id,
      categoryName: cat.name,
      emoji: cat.emoji,
      investmentCost: cat.cost,
      incomePerHour: cat.baseIncomePerHour,
    });
    setBusinesses(prev => [...prev, newBusiness]);
    addExperience(75);
    return true;
  }, [balance, addExperience]);

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
      const sv = calculatePortfolioValue(stockHoldings, stockPrices);
      if (sv < merger.minStockPortfolio) return false;
    }
    if (merger.minCryptoPortfolio) {
      const cv = calculatePortfolioValue(cryptoHoldings, cryptoPrices);
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
      const newBiz = createBusiness({
        id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: merger.name,
        categoryId: merger.id,
        categoryName: merger.name,
        emoji: merger.emoji,
        investmentCost: totalInvestment,
        incomePerHour: merger.resultIncomePerHour,
      });
      return [...filtered, newBiz];
    });

    addExperience(150);

    return true;
  }, [businesses, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, shopItems, addExperience]);

  const deleteBusiness = useCallback((id: string): boolean => {
    const biz = businesses.find(b => b.id === id);
    if (!biz) return false;
    const refund = calculateBusinessRefund(biz);
    setBalance(b => b + refund);
    setBusinesses(prev => prev.filter(b => b.id !== id));
    return true;
  }, [businesses]);

  const payTaxes = useCallback((): boolean => {
    const now = Date.now();
    const totalDue = calculateTotalTaxDue(businesses, now);
    if (totalDue <= 0 || balance < totalDue) return false;
    setBalance(b => b - totalDue);
    setBusinesses(prev => prev.map(b => {
      if (!b.taxPaid && now >= b.taxDueAt) {
        return { ...b, taxPaid: true, taxDueAt: now + TAX_PERIOD_MS, taxAmount: 0 };
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
        const newAvg = calculateWeightedAveragePrice({
          currentQuantity: existing.quantity,
          currentAveragePrice: existing.avgBuyPrice,
          addedQuantity: quantity,
          addedCost: cost,
        });
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
    const profit = calculateTradeProfit({
      sellPrice: price,
      averageBuyPrice: holding.avgBuyPrice,
      quantity,
    });
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
        const newAvg = calculateWeightedAveragePrice({
          currentQuantity: existing.quantity,
          currentAveragePrice: existing.avgBuyPrice,
          addedQuantity: amount,
          addedCost: cost,
        });
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
    const profit = calculateTradeProfit({
      sellPrice: price,
      averageBuyPrice: holding.avgBuyPrice,
      quantity: amount,
    });
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
  const progression = progressionFromXp(playerXp);

  return (
    <GameContext.Provider value={{
      balance, clickPower, playerXp, playerLevel: progression.level,
      levelStartXp: progression.levelStartXp, nextLevelXp: progression.nextLevelXp,
      levelProgress: progression.progress,
      hourlyIncome, hourlyIncomeBusiness, hourlyIncomeRent, hourlyIncomeDividends,
      totalEarnedClick, totalEarnedBusiness, totalEarnedRent, totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
      upgrades, shopItems, accessoryItems, businesses, passiveIncome, netWorth, totalTaxDue,
      stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, licensePlates,
      click, buyUpgrade, buyShopItem, buyAccessory, openBusiness, mergeBusiness, deleteBusiness, payTaxes,
      buyStock, sellStock, buyCrypto, sellCrypto, spendBalance, addBalance, addExperience,
      addLicensePlate, assignPlate, removePlate, formatMoney,
    }}>
      {children}
    </GameContext.Provider>
  );
};
