import React, { useState, useMemo } from 'react';
import { useGame, formatMoney } from '@/context/GameContext';
import { useI18n } from '@/i18n/I18nContext';
import { achievements, categoryInfo, type AchievementCategory } from '@/data/achievementsData';
import { Progress } from '@/components/ui/progress';
import GameIcon from '@/components/GameIcon';

type FilterMode = 'all' | 'unlocked' | 'locked';

/** Resolve a metric string to a numeric value from game state */
function getMetricValue(metric: string, state: ReturnType<typeof useGame>): number {
  switch (metric) {
    case 'totalEarnedClick': return state.totalEarnedClick;
    case 'totalEarnedBusiness': return state.totalEarnedBusiness;
    case 'totalEarnedRent': return state.totalEarnedRent;
    case 'totalEarnedDividends': return state.totalEarnedDividends;
    case 'totalEarnedTrading': return state.totalEarnedTrading;
    case 'totalEarnedCrypto': return state.totalEarnedCrypto;
    case 'clickPower': return state.clickPower;
    case 'balance': return state.balance;
    case 'netWorth': return state.netWorth;
    case 'businessCount': return state.businesses.length;
    case 'businessInvestTotal': return state.businesses.reduce((s, b) => s + b.investmentCost, 0);
    case 'businessCategoryCount': return new Set(state.businesses.map(b => b.categoryId)).size;
    case 'shopCount': return state.shopItems.filter(i => i.purchased).length;
    case 'accessoryCount': return state.accessoryItems.filter(i => i.purchased).length;
    case 'stockUniqueCount': return state.stockHoldings.length;
    case 'cryptoUniqueCount': return state.cryptoHoldings.length;
    case 'stockPortfolioValue':
      return state.stockHoldings.reduce((s, h) => s + (state.stockPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    case 'cryptoPortfolioValue':
      return state.cryptoHoldings.reduce((s, h) => s + (state.cryptoPrices[h.assetId]?.current ?? 0) * h.quantity, 0);
    case 'upgradeLevel':
      return state.upgrades.reduce((s, u) => s + u.currentLevel, 0);
    case 'upgradeSpent': {
      return state.upgrades.reduce((total, u) => {
        let spent = 0;
        for (let i = 0; i < u.currentLevel && i < u.levels.length; i++) {
          spent += u.levels[i].cost;
        }
        return total + spent;
      }, 0);
    }
  }

  if (metric.startsWith('shopCategoryCount:')) {
    const cat = metric.split(':')[1];
    return state.shopItems.filter(i => i.purchased && i.category === cat).length;
  }
  if (metric.startsWith('accCategoryCount:')) {
    const cat = metric.split(':')[1];
    return state.accessoryItems.filter(i => i.purchased && i.category === cat).length;
  }
  if (metric.startsWith('hasCrypto:')) {
    const id = metric.split(':')[1];
    return state.cryptoHoldings.some(h => h.assetId === id && h.quantity > 0) ? 1 : 0;
  }

  return 0;
}

const AchievementsTab: React.FC = () => {
  const gameState = useGame();
  const { t, td } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState<AchievementCategory | 'all'>('all');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const achievementStates = useMemo(() => {
    return achievements.map(a => {
      const current = getMetricValue(a.metric, gameState);
      const progress = Math.min(1, current / a.threshold);
      const unlocked = current >= a.threshold;
      return { ...a, current, progress, unlocked };
    });
  }, [
    gameState.totalEarnedClick, gameState.totalEarnedBusiness, gameState.totalEarnedRent,
    gameState.totalEarnedDividends, gameState.totalEarnedTrading, gameState.totalEarnedCrypto,
    gameState.clickPower, gameState.balance, gameState.netWorth,
    gameState.businesses, gameState.shopItems, gameState.accessoryItems,
    gameState.stockHoldings, gameState.cryptoHoldings, gameState.upgrades,
    gameState.stockPrices, gameState.cryptoPrices,
  ]);

  const filtered = useMemo(() => {
    return achievementStates.filter(a => {
      if (selectedCategory !== 'all' && a.category !== selectedCategory) return false;
      if (filter === 'unlocked' && !a.unlocked) return false;
      if (filter === 'locked' && a.unlocked) return false;
      if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase()) && !a.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [achievementStates, selectedCategory, filter, searchQuery]);

  const totalUnlocked = achievementStates.filter(a => a.unlocked).length;
  const totalPercent = Math.round((totalUnlocked / achievements.length) * 100);

  const categories = Object.entries(categoryInfo) as [AchievementCategory, { name: string; icon: string }][];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GameIcon name="star" size={24} themed />
          {t('ach.title')}
        </h2>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {totalUnlocked} / {achievements.length} ({totalPercent}%)
          </span>
          <Progress value={totalPercent} className="flex-1 h-2" />
        </div>
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent'
          }`}
        >
          {t('ach.filter_all')} ({achievements.length})
        </button>
        {categories.map(([key, info]) => {
          const count = achievementStates.filter(a => a.category === key).length;
          const unlocked = achievementStates.filter(a => a.category === key && a.unlocked).length;
          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              <GameIcon name={info.icon} size={14} themed /> {td('d.achcat.' + key, info.name)} ({unlocked}/{count})
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="flex gap-2 items-center flex-wrap">
        <div className="flex bg-muted rounded-lg p-0.5">
          {([['all', t('ach.filter_all')], ['unlocked', t('ach.filter_unlocked')], ['locked', t('ach.filter_locked')]] as [FilterMode, string][]).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === mode
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={t('ach.search')}
          className="px-3 py-1.5 rounded-lg bg-muted border-none text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
        />
        <span className="text-xs text-muted-foreground ml-auto">
          {t('ach.shown')}: {filtered.length}
        </span>
      </div>

      {/* Achievement grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(a => (
          <div
            key={a.id}
            className={`rounded-xl border p-4 transition-all ${
              a.unlocked
                ? 'bg-primary/5 border-primary/20 shadow-sm'
                : 'bg-card border-border opacity-70'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                a.unlocked ? 'bg-primary/10' : 'bg-muted grayscale'
              }`}>
                <GameIcon name={a.icon} size={20} themed />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className={`text-sm font-semibold truncate ${a.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {(() => {
                      const prefix = a.id.replace(/_\d+$/, '');
                      const tpl = td('d.ach.' + prefix + '.t', '');
                      return tpl && a.valLabel ? tpl.replace('{val}', a.valLabel) : td('d.ach.' + a.id + '.t', a.title);
                    })()}
                    {a.unlocked && <span className="ml-1.5 text-primary">✓</span>}
                  </h4>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    a.rarityPercent > 50 ? 'bg-muted text-muted-foreground' :
                    a.rarityPercent > 10 ? 'bg-blue-500/10 text-blue-500' :
                    a.rarityPercent > 1 ? 'bg-purple-500/10 text-purple-500' :
                    'bg-amber-500/10 text-amber-500'
                  }`}>
                    {a.rarityPercent < 0.1 ? '<0.1' : a.rarityPercent}% {t('ach.players') || 'игроков'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{(() => {
                  const prefix = a.id.replace(/_\d+$/, '');
                  const tpl = td('d.ach.' + prefix + '.d', '');
                  return tpl && a.valLabel ? tpl.replace('{val}', a.valLabel) : td('d.ach.' + a.id + '.d', a.description);
                })()}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={a.progress * 100} className="flex-1 h-1.5" />
                  <span className="text-[10px] text-muted-foreground font-mono w-10 text-right">
                    {a.unlocked ? '100%' : `${Math.floor(a.progress * 100)}%`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          {t('ach.empty')}
        </div>
      )}
    </div>
  );
};

export default AchievementsTab;
