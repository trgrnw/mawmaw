import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { businessCategories } from '@/data/businessNames';
import { businessMergers } from '@/data/mergerData';
import { stockAssets, cryptoAssets, generatePriceHistory, nextPriceTick } from '@/data/investmentData';
import { shopItemsData } from '@/data/shopData';
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
import { defaultUpgrades, upgradeLevels } from '@/game/upgrades';
import { BUSINESS_TAX_RATE, TAX_PERIOD_MS } from '@/game/constants';
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
import { isSaveKeyReady, savedStateTimestamp, serializeState } from '@/game/save';
import { calculateFinancialSnapshot } from '@/game/finance';
import { withTimeout } from '@/lib/async';
import { formatMoney } from '@/game/format';
import {
  progressionFromXp,
  rewardsBetweenLevels,
  XP_PER_CLICK,
} from '@/game/progression';
import GameIcon from '@/components/GameIcon';

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
  const { forceSave, forceSaveNow, claimPending } = useCloudSave(user?.id);
  const [loaded, setLoaded] = useState(false);
  const cloudLoadOkRef = useRef(false);
  const loadGenerationRef = useRef(0);
  const readySaveKeyRef = useRef<string | null>(null);
  const saveKey = user?.id ? `gameState_${user.id}` : 'gameState_guest';

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
    const generation = ++loadGenerationRef.current;
    // Invalidate saving synchronously for this effect run. The autosave effect
    // from the same render may still have `loaded === true` from the previous
    // identity, so the key guard below is the authoritative readiness check.
    readySaveKeyRef.current = null;

    const loadState = async () => {
      setLoaded(false);
      // If user changed (logout or switch), reset first
      if (prevUserId.current !== undefined && prevUserId.current !== (user?.id ?? null)) {
        resetToDefaults();
      }
      prevUserId.current = user?.id ?? null;

      let cloudSaved: Record<string, unknown> | null = null;
      let cloudExistedOrEmpty = false;
      const localKey = saveKey;
      let localSaved: Record<string, unknown> | null = null;
      const local = localStorage.getItem(localKey);
      if (local) {
        try { localSaved = JSON.parse(local); } catch { /* ignore corrupt local data */ }
      }
      let guestSaved: Record<string, unknown> | null = null;
      const shouldMigrateGuest = user?.id && localStorage.getItem('pendingGuestProgressMigration') === '1';
      if (shouldMigrateGuest) {
        try {
          const rawGuest = localStorage.getItem('gameState_guest');
          if (rawGuest) guestSaved = JSON.parse(rawGuest);
        } catch { /* ignore corrupt guest save */ }
      }

      // Guests use a durable local save.
      if (!user?.id) {
        if (localSaved) applyLoadedState(localSaved);
        else resetToDefaults();
        cloudLoadOkRef.current = true;
        readySaveKeyRef.current = localKey;
        setLoaded(true);
        return;
      }

      // A stalled Supabase request must never leave the app on the loader.
      try {
          const { data, error } = await withTimeout(
            supabase
            .from('game_saves')
            .select('game_state, updated_at')
            .eq('user_id', user.id)
            .maybeSingle(),
            5_000,
            'Cloud save load timed out',
          );
          if (error) throw error;
          cloudExistedOrEmpty = true; // query succeeded
          if (data) {
            const state = (data.game_state as Record<string, unknown>) || {};
            if (!savedStateTimestamp(state) && data.updated_at) state.savedAt = new Date(data.updated_at).getTime();
            cloudSaved = state;
          }
      } catch (e) {
        console.error('[GameContext] cloud load failed; using local save', e);
      }

      // A response for a previous guest/account must never touch the current
      // player's in-memory state or enable saving under another key.
      if (generation !== loadGenerationRef.current) return;

      // Supabase is authoritative for authenticated players. Never allow a
      // different browser's local cache to roll back the account save.
      if (cloudSaved) {
        applyLoadedState(cloudSaved);
        localStorage.setItem(localKey, JSON.stringify(cloudSaved));
        localStorage.removeItem('pendingGuestProgressMigration');
      } else if (cloudExistedOrEmpty && guestSaved) {
        // A newly-created account inherits the current guest run once.
        applyLoadedState(guestSaved);
        localStorage.setItem(localKey, JSON.stringify(guestSaved));
      } else if (cloudExistedOrEmpty && localSaved) {
        // First login after upgrading from local-only storage: migrate once.
        applyLoadedState(localSaved);
      } else if (!cloudExistedOrEmpty && localSaved) {
        // Offline fallback is a cache only; it never outranks a reachable cloud.
        applyLoadedState(localSaved);
      } else {
        resetToDefaults();
      }
      // CRITICAL: only enable autosave if we successfully reached the cloud OR have local backup.
      // Otherwise we'd autosave default zeros and wipe the real cloud save.
      cloudLoadOkRef.current = cloudExistedOrEmpty;
      readySaveKeyRef.current = localKey;
      setLoaded(true);
    };
    loadState().catch(error => {
      if (generation !== loadGenerationRef.current) return;
      console.error('[GameContext] unexpected load failure; continuing with local state', error);
      cloudLoadOkRef.current = false;
      readySaveKeyRef.current = saveKey;
      setLoaded(true);
    });
  }, [user?.id, saveKey]); // eslint-disable-line react-hooks/exhaustive-deps

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
      setAccessoryItems(prev => prev.map(i => {
        const entries = saved.purchasedAccessories as Array<string | { id: string; price?: number }>;
        const match = entries.find(entry => typeof entry === 'string' ? entry === i.id : entry.id === i.id);
        return match ? { ...i, purchased: true, price: typeof match === 'object' && match.price ? match.price : i.price } : i;
      }));
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
    if (saved.stockPrices && typeof saved.stockPrices === 'object') setStockPrices(saved.stockPrices as PriceData);
    if (saved.cryptoPrices && typeof saved.cryptoPrices === 'object') setCryptoPrices(saved.cryptoPrices as PriceData);
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

  const persistImmediate = useCallback((overrides: Partial<typeof latestState.current>) => {
    if (!isSaveKeyReady(readySaveKeyRef.current, saveKey)) return false;
    const s = { ...latestState.current, ...overrides };
    const state = serializeState({
      balance: s.balance, clickPower: s.clickPower, playerXp: s.playerXp,
      totalEarnedClick: s.totalEarnedClick, totalEarnedBusiness: s.totalEarnedBusiness,
      totalEarnedRent: s.totalEarnedRent, totalEarnedDividends: s.totalEarnedDividends,
      totalEarnedTrading: s.totalEarnedTrading, totalEarnedCrypto: s.totalEarnedCrypto,
      totalEarnedGems: s.totalEarnedGems,
      upgrades: s.upgrades, shopItems: s.shopItems, accessoryItems: s.accessoryItems,
      businesses: s.businesses, stockHoldings: s.stockHoldings, cryptoHoldings: s.cryptoHoldings,
      licensePlates: s.licensePlates, stockPrices: s.stockPrices, cryptoPrices: s.cryptoPrices,
    });
    localStorage.setItem(saveKey, JSON.stringify(state));
    latestState.current = s;
    if (user?.id && cloudLoadOkRef.current) {
      const nw = calculateFinancialSnapshot(s).netWorth;
      forceSave(state, nw).then(() => {
        if (localStorage.getItem('pendingGuestProgressMigration') === '1') {
          localStorage.removeItem('pendingGuestProgressMigration');
          localStorage.removeItem('gameState_guest');
        }
      }).catch(error => console.error('[GameContext] immediate cloud save failed', error));
    }
    return true;
  }, [user?.id, saveKey, forceSave]);

  const performSave = useCallback(() => {
    if (!isSaveKeyReady(readySaveKeyRef.current, saveKey)) return;
    const s = latestState.current;

    const state = serializeState({
      balance: s.balance, clickPower: s.clickPower, playerXp: s.playerXp,
      totalEarnedClick: s.totalEarnedClick, totalEarnedBusiness: s.totalEarnedBusiness,
      totalEarnedRent: s.totalEarnedRent, totalEarnedDividends: s.totalEarnedDividends,
      totalEarnedTrading: s.totalEarnedTrading, totalEarnedCrypto: s.totalEarnedCrypto,
      totalEarnedGems: s.totalEarnedGems,
      upgrades: s.upgrades, shopItems: s.shopItems, accessoryItems: s.accessoryItems,
      businesses: s.businesses, stockHoldings: s.stockHoldings, cryptoHoldings: s.cryptoHoldings,
      licensePlates: s.licensePlates, stockPrices: s.stockPrices, cryptoPrices: s.cryptoPrices,
    });

    localStorage.setItem(saveKey, JSON.stringify(state));
    const nw = calculateFinancialSnapshot(s).netWorth;

    // Local persistence must never depend on Supabase availability. Cloud
    // writes are enabled only after a trustworthy cloud/local load.
    if (user?.id && cloudLoadOkRef.current) {
      forceSave(state, nw).catch(error => console.error('[GameContext] cloud save failed', error));
    }
  }, [user?.id, saveKey, forceSave]);

  const syncProgress = useCallback(async () => {
    if (!user?.id || !cloudLoadOkRef.current) return;
    const s = latestState.current;
    const state = serializeState({
      balance: s.balance, clickPower: s.clickPower, playerXp: s.playerXp,
      totalEarnedClick: s.totalEarnedClick, totalEarnedBusiness: s.totalEarnedBusiness,
      totalEarnedRent: s.totalEarnedRent, totalEarnedDividends: s.totalEarnedDividends,
      totalEarnedTrading: s.totalEarnedTrading, totalEarnedCrypto: s.totalEarnedCrypto,
      totalEarnedGems: s.totalEarnedGems,
      upgrades: s.upgrades, shopItems: s.shopItems, accessoryItems: s.accessoryItems,
      businesses: s.businesses, stockHoldings: s.stockHoldings, cryptoHoldings: s.cryptoHoldings,
      licensePlates: s.licensePlates, stockPrices: s.stockPrices, cryptoPrices: s.cryptoPrices,
    });
    localStorage.setItem(saveKey, JSON.stringify(state));
    await forceSaveNow(state, calculateFinancialSnapshot(s).netWorth);
  }, [user?.id, saveKey, forceSaveNow]);

  // Save shortly after every meaningful state change. Local storage is
  // synchronous; cloud writes are serialized by useCloudSave.
  useEffect(() => {
    if (!loaded) return;
    performSave();
  }, [loaded, performSave, balance, clickPower, playerXp, totalEarnedClick,
    totalEarnedBusiness, totalEarnedRent, totalEarnedDividends, totalEarnedTrading,
    totalEarnedCrypto, totalEarnedGems, upgrades, shopItems, accessoryItems,
    businesses, stockHoldings, cryptoHoldings, licensePlates, stockPrices, cryptoPrices]);

  // Save on beforeunload
  useEffect(() => {
    const handleUnload = () => performSave();
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [performSave]);

  // --- Income calculations ---
  const hasAutoclicker = upgrades.some(u => u.id === 'autoclicker' && u.currentLevel > 0);
  const hasAutoTax = upgrades.some(u => u.id === 'auto-tax' && u.currentLevel > 0);
  const hourlyIncomeRent = shopItems.filter(i => i.purchased && i.category === 'realestate')
    .reduce((sum, i) => {
      const data = shopItemsData.find(d => d.id === i.id);
      return sum + (data?.baseIncomePerHour || i.price * 0.01);
    }, 0);

  const now = Date.now();
  const hourlyIncomeBusiness = businesses
    .filter(b => b.taxPaid || now < b.taxDueAt)
    .reduce((sum, b) => sum + b.incomePerHour * (hasAutoTax ? (1 - b.taxRate) : 1), 0);

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

  const lastPassiveTickRef = useRef(Date.now());
  useEffect(() => {
    const accrue = () => {
      const tickNow = Date.now();
      const elapsedSeconds = Math.min(12 * 3600, Math.max(0, (tickNow - lastPassiveTickRef.current) / 1000));
      lastPassiveTickRef.current = tickNow;
      const { hourlyIncomeRent: rent, hourlyIncomeBusiness: biz, hourlyIncomeDividends: div } = refsData.current;
      if (rent > 0) {
        const earned = rent / 3600 * elapsedSeconds;
        setBalance(b => b + earned);
        setTotalEarnedRent(t => t + earned);
      }
      if (biz > 0) {
        const earned = biz / 3600 * elapsedSeconds;
        setBalance(b => b + earned);
        setTotalEarnedBusiness(t => t + earned);
      }
      if (div > 0) {
        const earned = div / 3600 * elapsedSeconds;
        setBalance(b => b + earned);
        setTotalEarnedDividends(t => t + earned);
      }
    };
    const interval = window.setInterval(accrue, 1000);
    const onVisibility = () => { if (!document.hidden) accrue(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', onVisibility); };
  }, []);

  // --- Check pending_balance (market sales, offline income, bid escrow) every 5 seconds ---
  useEffect(() => {
    if (!user?.id || !loaded) return;
    const checkPending = async () => {
      const pending = await claimPending();
      if (pending !== 0) {
        setBalance(b => Math.max(0, b + pending));
        if (pending > 0) setTotalEarnedGems(current => current + pending);
      }
    };
    checkPending();
    const interval = setInterval(checkPending, 5000);
    return () => clearInterval(interval);
  }, [user?.id, loaded, claimPending]);

  // --- Offline income claim once on load + heartbeat presence ---
  const offlineClaimedRef = useRef(false);
  useEffect(() => { offlineClaimedRef.current = false; }, [user?.id]);
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
          const claimed = await claimPending();
          if (claimed !== 0) {
            setBalance(current => Math.max(0, current + claimed));
            if (claimed > 0) setTotalEarnedGems(current => current + claimed);
          }
          const hours = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          window.dispatchEvent(new CustomEvent('offline-income', { detail: { amount, hours, mins } }));
        }
      } catch { /* ignore */ }
    };
    const t = setTimeout(claim, 2000);
    return () => clearTimeout(t);
  }, [user?.id, loaded, claimPending]);

  useEffect(() => {
    if (!user?.id || !loaded) return;
    const beat = () => { if (!document.hidden) (supabase.rpc('heartbeat_presence' as any) as any).then(() => {}); };
    const interval = setInterval(beat, 60000);
    return () => clearInterval(interval);
  }, [user?.id, loaded]);

  // Tax check
  useEffect(() => {
    const interval = setInterval(() => {
      setBusinesses(prev => prev.map(b => {
        if (hasAutoTax && Date.now() >= b.taxDueAt) {
          return { ...b, taxPaid: true, taxDueAt: Date.now() + TAX_PERIOD_MS, taxAmount: 0 };
        }
        if (b.taxPaid && Date.now() >= b.taxDueAt) {
          return { ...b, taxPaid: false, taxAmount: b.incomePerHour * 72 * BUSINESS_TAX_RATE };
        }
        return b;
      }));
    }, 10000);
    return () => clearInterval(interval);
  }, [hasAutoTax]);

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
      setTotalEarnedGems(current => current + reward);
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
    const nextBalance = balance - nextLevel.cost;
    const nextUpgrades = upgrades.map(u => u.id === id ? { ...u, currentLevel: u.currentLevel + 1 } : u);
    persistImmediate({ balance: nextBalance, upgrades: nextUpgrades });
    setBalance(nextBalance);
    if (id === 'click-power') {
      setClickPower(p => p + nextLevel.bonus);
    }
    setUpgrades(nextUpgrades);
    addExperience(15 + up.currentLevel * 5);
    return true;
  }, [upgrades, balance, addExperience, persistImmediate]);

  const buyShopItem = useCallback((id: string, customPrice?: number): boolean => {
    const item = shopItems.find(i => i.id === id);
    const price = customPrice ?? item?.price ?? 0;
    if (!item || item.purchased || balance < price) return false;
    const nextBalance = balance - price;
    const nextItems = shopItems.map(i => i.id === id ? { ...i, purchased: true, price } : i);
    persistImmediate({ balance: nextBalance, shopItems: nextItems });
    setBalance(nextBalance);
    setShopItems(nextItems);
    addExperience(40);
    return true;
  }, [shopItems, balance, addExperience, persistImmediate]);

  const buyAccessory = useCallback((id: string): boolean => {
    const item = accessoryItems.find(i => i.id === id);
    if (!item || item.purchased || balance < item.price) return false;
    const nextBalance = balance - item.price;
    const nextItems = accessoryItems.map(i => i.id === id ? { ...i, purchased: true } : i);
    persistImmediate({ balance: nextBalance, accessoryItems: nextItems });
    setBalance(nextBalance);
    setAccessoryItems(nextItems);
    addExperience(30);
    return true;
  }, [accessoryItems, balance, addExperience, persistImmediate]);

  const sellShopItem = useCallback((id: string): boolean => {
    const item = shopItems.find(i => i.id === id);
    if (!item?.purchased) return false;
    const refund = Math.round(item.price * 0.25);
    const nextItems = shopItems.map(i => i.id === id ? { ...i, purchased: false } : i);
    const nextPlates = licensePlates.map(p => p.assignedTo === id ? { ...p, assignedTo: null } : p);
    const nextBalance = balance + refund;
    persistImmediate({ balance: nextBalance, shopItems: nextItems, licensePlates: nextPlates });
    setBalance(nextBalance);
    setShopItems(nextItems);
    setLicensePlates(nextPlates);
    return true;
  }, [shopItems, licensePlates, balance, persistImmediate]);

  const sellAccessory = useCallback((id: string): boolean => {
    const item = accessoryItems.find(i => i.id === id);
    if (!item?.purchased || item.category === 'misc') return false;
    const refund = Math.round(item.price * 0.25);
    const nextItems = accessoryItems.map(i => i.id === id ? { ...i, purchased: false } : i);
    const nextBalance = balance + refund;
    persistImmediate({ balance: nextBalance, accessoryItems: nextItems });
    setBalance(nextBalance);
    setAccessoryItems(nextItems);
    return true;
  }, [accessoryItems, balance, persistImmediate]);

  const openBusiness = useCallback(async (categoryId: string, name: string): Promise<boolean> => {
    const cat = businessCategories.find(c => c.id === categoryId);
    if (!cat || balance < cat.cost) return false;
    const newBusiness = createBusiness({
      id: `biz-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      categoryId: cat.id,
      categoryName: cat.name,
      emoji: cat.emoji,
      investmentCost: cat.cost,
      incomePerHour: cat.baseIncomePerHour,
    });
    const nextBalance = balance - cat.cost;
    const nextBusinesses = [...businesses, newBusiness];
    persistImmediate({ balance: nextBalance, businesses: nextBusinesses });
    setBalance(nextBalance);
    setBusinesses(nextBusinesses);
    addExperience(75);
    await syncProgress();
    return true;
  }, [balance, businesses, addExperience, persistImmediate, syncProgress]);

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

    const filtered = businesses.filter(b => !consumedBizIds.includes(b.id));
    const newBiz = createBusiness({
      id: `merge-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: merger.name,
      categoryId: merger.id,
      categoryName: merger.name,
      emoji: merger.emoji,
      investmentCost: totalInvestment,
      incomePerHour: merger.resultIncomePerHour,
    });
    const nextBusinesses = [...filtered, newBiz];
    persistImmediate({ businesses: nextBusinesses });
    setBusinesses(nextBusinesses);

    addExperience(150);

    return true;
  }, [businesses, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, shopItems, addExperience, persistImmediate]);

  const deleteBusiness = useCallback((id: string): boolean => {
    const biz = businesses.find(b => b.id === id);
    if (!biz) return false;
    const refund = calculateBusinessRefund(biz);
    const nextBalance = balance + refund;
    const nextBusinesses = businesses.filter(b => b.id !== id);
    persistImmediate({ balance: nextBalance, businesses: nextBusinesses });
    setBalance(nextBalance);
    setBusinesses(nextBusinesses);
    return true;
  }, [balance, businesses, persistImmediate]);

  const payTaxes = useCallback((): boolean => {
    const now = Date.now();
    const totalDue = calculateTotalTaxDue(businesses, now);
    if (totalDue <= 0 || balance < totalDue) return false;
    const nextBalance = balance - totalDue;
    const nextBusinesses = businesses.map(b => {
      if (!b.taxPaid && now >= b.taxDueAt) {
        return { ...b, taxPaid: true, taxDueAt: now + TAX_PERIOD_MS, taxAmount: 0 };
      }
      return b;
    });
    persistImmediate({ balance: nextBalance, businesses: nextBusinesses });
    setBalance(nextBalance);
    setBusinesses(nextBusinesses);
    return true;
  }, [businesses, balance, persistImmediate]);

  useEffect(() => {
    if (!loaded || !hasAutoclicker) return;
    const interval = window.setInterval(() => {
      setBalance(current => current + clickPower);
      setTotalEarnedClick(current => current + clickPower);
    }, 1_000);
    return () => window.clearInterval(interval);
  }, [loaded, hasAutoclicker, clickPower]);

  // ── Investment functions ──
  const buyStock = useCallback((assetId: string, quantity: number): boolean => {
    const price = stockPrices[assetId]?.current;
    if (!price || quantity <= 0) return false;
    const cost = price * quantity;
    if (balance < cost) return false;
    const existing = stockHoldings.find(h => h.assetId === assetId);
    let nextHoldings: StockHolding[];
      if (existing) {
        const newQty = existing.quantity + quantity;
        const newAvg = calculateWeightedAveragePrice({
          currentQuantity: existing.quantity,
          currentAveragePrice: existing.avgBuyPrice,
          addedQuantity: quantity,
          addedCost: cost,
        });
        nextHoldings = stockHoldings.map(h => h.assetId === assetId ? { ...h, quantity: newQty, avgBuyPrice: newAvg } : h);
      } else {
        nextHoldings = [...stockHoldings, { assetId, quantity, avgBuyPrice: price }];
      }
    const nextBalance = balance - cost;
    persistImmediate({ balance: nextBalance, stockHoldings: nextHoldings });
    setBalance(nextBalance);
    setStockHoldings(nextHoldings);
    return true;
  }, [balance, stockPrices, stockHoldings, persistImmediate]);

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
    const newQty = holding.quantity - quantity;
    const nextHoldings = newQty <= 0 ? stockHoldings.filter(h => h.assetId !== assetId) : stockHoldings.map(h => h.assetId === assetId ? { ...h, quantity: newQty } : h);
    const nextBalance = balance + revenue;
    const nextEarned = profit > 0 ? totalEarnedTrading + profit : totalEarnedTrading;
    persistImmediate({ balance: nextBalance, stockHoldings: nextHoldings, totalEarnedTrading: nextEarned });
    setBalance(nextBalance);
    setTotalEarnedTrading(nextEarned);
    setStockHoldings(nextHoldings);
    return true;
  }, [balance, stockHoldings, stockPrices, totalEarnedTrading, persistImmediate]);

  const buyCrypto = useCallback((assetId: string, amount: number): boolean => {
    const price = cryptoPrices[assetId]?.current;
    if (!price || amount <= 0) return false;
    const cost = price * amount;
    if (balance < cost) return false;
    const existing = cryptoHoldings.find(h => h.assetId === assetId);
    let nextHoldings: CryptoHolding[];
      if (existing) {
        const newQty = existing.quantity + amount;
        const newAvg = calculateWeightedAveragePrice({
          currentQuantity: existing.quantity,
          currentAveragePrice: existing.avgBuyPrice,
          addedQuantity: amount,
          addedCost: cost,
        });
        nextHoldings = cryptoHoldings.map(h => h.assetId === assetId ? { ...h, quantity: newQty, avgBuyPrice: newAvg } : h);
      } else {
        nextHoldings = [...cryptoHoldings, { assetId, quantity: amount, avgBuyPrice: price }];
      }
    const nextBalance = balance - cost;
    persistImmediate({ balance: nextBalance, cryptoHoldings: nextHoldings });
    setBalance(nextBalance);
    setCryptoHoldings(nextHoldings);
    return true;
  }, [balance, cryptoPrices, cryptoHoldings, persistImmediate]);

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
    const newQty = holding.quantity - amount;
    const nextHoldings = newQty <= 0 ? cryptoHoldings.filter(h => h.assetId !== assetId) : cryptoHoldings.map(h => h.assetId === assetId ? { ...h, quantity: newQty } : h);
    const nextBalance = balance + revenue;
    const nextEarned = profit > 0 ? totalEarnedCrypto + profit : totalEarnedCrypto;
    persistImmediate({ balance: nextBalance, cryptoHoldings: nextHoldings, totalEarnedCrypto: nextEarned });
    setBalance(nextBalance);
    setTotalEarnedCrypto(nextEarned);
    setCryptoHoldings(nextHoldings);
    return true;
  }, [balance, cryptoHoldings, cryptoPrices, totalEarnedCrypto, persistImmediate]);

  const spendBalance = useCallback((amount: number): boolean => {
    if (amount <= 0 || balance < amount) return false;
    setBalance(b => b - amount);
    return true;
  }, [balance]);

  const addBalance = useCallback((amount: number, earnedAmount = 0) => {
    if (amount <= 0) return;
    setBalance(b => b + amount);
    if (earnedAmount > 0) setTotalEarnedGems(current => current + earnedAmount);
  }, []);

  const replaceBalance = useCallback((amount: number) => {
    if (!Number.isFinite(amount)) return;
    setBalance(Math.max(0, amount));
  }, []);

  // License plate functions
  const addLicensePlate = useCallback((plate: LicensePlateState) => {
    setLicensePlates(prev => {
      const existing = prev.find(item => item.id === plate.id);
      if (existing && existing.text === plate.text && existing.country === plate.country && existing.isCustom === plate.isCustom) return prev;
      return existing
        ? prev.map(item => item.id === plate.id ? { ...plate, assignedTo: item.assignedTo } : item)
        : [...prev, plate];
    });
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

  const netWorth = calculateFinancialSnapshot({ balance, shopItems, accessoryItems, businesses, stockHoldings, cryptoHoldings, stockPrices, cryptoPrices }).netWorth;
  const progression = progressionFromXp(playerXp);

  if (!loaded) return <div className="min-h-screen flex items-center justify-center bg-background"><GameIcon name="gamepad" size={44} themed className="animate-pulse" /></div>;

  return (
    <GameContext.Provider value={{
      balance, clickPower, playerXp, playerLevel: progression.level,
      levelStartXp: progression.levelStartXp, nextLevelXp: progression.nextLevelXp,
      levelProgress: progression.progress,
      hourlyIncome, hourlyIncomeBusiness, hourlyIncomeRent, hourlyIncomeDividends,
      totalEarnedClick, totalEarnedBusiness, totalEarnedRent, totalEarnedDividends, totalEarnedTrading, totalEarnedCrypto, totalEarnedGems,
      upgrades, shopItems, accessoryItems, businesses, passiveIncome, netWorth, totalTaxDue,
      stockHoldings, cryptoHoldings, stockPrices, cryptoPrices, licensePlates,
      click, buyUpgrade, buyShopItem, sellShopItem, syncProgress, buyAccessory, sellAccessory, openBusiness, mergeBusiness, deleteBusiness, payTaxes,
      buyStock, sellStock, buyCrypto, sellCrypto, spendBalance, addBalance, replaceBalance, addExperience,
      addLicensePlate, assignPlate, removePlate, formatMoney,
    }}>
      {children}
    </GameContext.Provider>
  );
};
