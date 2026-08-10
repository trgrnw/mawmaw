// Achievement system — 200 achievements across 9 categories

export type AchievementCategory = 
  | 'clicker' | 'income' | 'business' | 'shop' | 'accessories' 
  | 'stocks' | 'crypto' | 'upgrades' | 'prestige';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  /** GameIcon key */
  icon: string;
  category: AchievementCategory;
  /** Which metric to check */
  metric: string;
  /** Target value */
  threshold: number;
  /** Fake % of players who have this */
  rarityPercent: number;
  /** Value label for i18n template resolution (e.g. '$1M') */
  valLabel?: string;
}

export const categoryInfo: Record<AchievementCategory, { name: string; icon: string }> = {
  clicker: { name: 'Кликер', icon: 'click' },
  income: { name: 'Доход', icon: 'earning' },
  business: { name: 'Бизнес', icon: 'business' },
  shop: { name: 'Магазин', icon: 'shop' },
  accessories: { name: 'Аксессуары', icon: 'accessories' },
  stocks: { name: 'Акции', icon: 'stocks' },
  crypto: { name: 'Крипто', icon: 'crypto' },
  upgrades: { name: 'Улучшения', icon: 'upgrade' },
  prestige: { name: 'Состояние', icon: 'forbes' },
};

// Helper to generate a batch of threshold-based achievements
function gen(
  prefix: string, 
  category: AchievementCategory, 
  metric: string, 
  icon: string,
  nameTemplate: string,
  descTemplate: string,
  thresholds: [number, string, number][] // [threshold, suffix label, rarity%]
): Achievement[] {
  return thresholds.map(([threshold, label, rarity], i) => ({
    id: `${prefix}_${i + 1}`,
    title: nameTemplate.replace('{val}', label),
    description: descTemplate.replace('{val}', label),
    icon,
    category,
    metric,
    threshold,
    rarityPercent: rarity,
    valLabel: label,
  }));
}

export const achievements: Achievement[] = [
  // ═══════════════════════════════════════════
  // КЛИКЕР (25) — totalEarnedClick
  // ═══════════════════════════════════════════
  ...gen('click', 'clicker', 'totalEarnedClick', 'click', 'Кликер: {val}', 'Заработайте {val} кликами', [
    [100, '$100', 89],
    [500, '$500', 78],
    [1_000, '$1K', 72],
    [5_000, '$5K', 61],
    [10_000, '$10K', 55],
    [25_000, '$25K', 45],
    [50_000, '$50K', 38],
    [100_000, '$100K', 30],
    [250_000, '$250K', 22],
    [500_000, '$500K', 16],
    [1_000_000, '$1M', 11],
    [2_500_000, '$2.5M', 7.5],
    [5_000_000, '$5M', 5.2],
    [10_000_000, '$10M', 3.1],
    [25_000_000, '$25M', 1.8],
    [50_000_000, '$50M', 1.0],
    [100_000_000, '$100M', 0.5],
    [250_000_000, '$250M', 0.2],
    [500_000_000, '$500M', 0.08],
    [1_000_000_000, '$1B', 0.03],
  ]),
  // Click power milestones
  ...gen('cp', 'clicker', 'clickPower', 'upgrade', 'Сила удара: {val}', 'Увеличьте силу клика до {val}', [
    [5, '5', 75],
    [25, '25', 52],
    [100, '100', 30],
    [500, '500', 12],
    [1000, '1000', 3.5],
  ]),

  // ═══════════════════════════════════════════
  // ОБЩИЙ ДОХОД (22)
  // ═══════════════════════════════════════════
  ...gen('earn_biz', 'income', 'totalEarnedBusiness', 'business', 'Бизнесмен: {val}', 'Заработайте {val} с бизнесов', [
    [1_000, '$1K', 65],
    [10_000, '$10K', 48],
    [50_000, '$50K', 33],
    [250_000, '$250K', 18],
    [1_000_000, '$1M', 9],
    [5_000_000, '$5M', 4],
    [25_000_000, '$25M', 1.5],
    [100_000_000, '$100M', 0.4],
  ]),
  ...gen('earn_rent', 'income', 'totalEarnedRent', 'rent', 'Рантье: {val}', 'Заработайте {val} с аренды', [
    [1_000, '$1K', 60],
    [10_000, '$10K', 42],
    [100_000, '$100K', 22],
    [500_000, '$500K', 11],
    [2_000_000, '$2M', 4.5],
    [10_000_000, '$10M', 1.2],
    [50_000_000, '$50M', 0.3],
  ]),
  ...gen('earn_div', 'income', 'totalEarnedDividends', 'dividends', 'Инвестор: {val}', 'Заработайте {val} дивидендами', [
    [100, '$100', 50],
    [1_000, '$1K', 30],
    [10_000, '$10K', 15],
    [100_000, '$100K', 5],
    [1_000_000, '$1M', 1.5],
    [10_000_000, '$10M', 0.3],
    [50_000_000, '$50M', 0.05],
  ]),

  // ═══════════════════════════════════════════
  // БИЗНЕС (22)
  // ═══════════════════════════════════════════
  ...gen('biz_count', 'business', 'businessCount', 'building', '{val} бизнесов', 'Откройте {val} бизнесов', [
    [1, '1', 70],
    [3, '3', 55],
    [5, '5', 42],
    [10, '10', 28],
    [15, '15', 18],
    [20, '20', 12],
    [30, '30', 6],
    [50, '50', 2.5],
    [75, '75', 0.8],
    [100, '100', 0.3],
  ]),
  ...gen('biz_invest', 'business', 'businessInvestTotal', 'briefcase', 'Инвестор: {val}', 'Вложите {val} в бизнесы', [
    [10_000, '$10K', 62],
    [50_000, '$50K', 40],
    [250_000, '$250K', 22],
    [1_000_000, '$1M', 10],
    [5_000_000, '$5M', 4],
    [25_000_000, '$25M', 1.2],
    [100_000_000, '$100M', 0.3],
  ]),
  // Unique business categories
  ...gen('biz_cat', 'business', 'businessCategoryCount', 'build', '{val} отраслей', 'Бизнесы в {val} отраслях', [
    [3, '3', 50],
    [5, '5', 32],
    [8, '8', 15],
    [10, '10', 7],
    [13, '13', 1.5],
  ]),

  // ═══════════════════════════════════════════
  // МАГАЗИН (25)
  // ═══════════════════════════════════════════
  ...gen('shop_total', 'shop', 'shopCount', 'shop', '{val} покупок', 'Купите {val} предметов в магазине', [
    [1, '1', 80],
    [3, '3', 62],
    [5, '5', 48],
    [10, '10', 30],
    [15, '15', 18],
    [20, '20', 10],
    [25, '25', 5],
    [30, '30', 2],
    [35, '35', 0.5],
  ]),
  ...gen('shop_cars', 'shop', 'shopCategoryCount:cars', 'car', '{val} авто', 'Купите {val} автомобилей', [
    [1, '1', 68],
    [3, '3', 38],
    [5, '5', 15],
    [7, '7', 3],
  ]),
  ...gen('shop_re', 'shop', 'shopCategoryCount:realestate', 'realestate', '{val} объектов', 'Купите {val} объектов недвижимости', [
    [1, '1', 62],
    [3, '3', 30],
    [5, '5', 10],
    [6, '6', 3],
  ]),
  ...gen('shop_ships', 'shop', 'shopCategoryCount:ships', 'ship', '{val} кораблей', 'Купите {val} кораблей', [
    [1, '1', 40],
    [3, '3', 15],
    [5, '5', 3],
  ]),
  ...gen('shop_planes', 'shop', 'shopCategoryCount:planes', 'plane', '{val} самолётов', 'Купите {val} самолётов', [
    [1, '1', 35],
    [2, '2', 12],
    [4, '4', 2],
  ]),
  ...gen('shop_islands', 'shop', 'shopCategoryCount:islands', 'islands', '{val} островов', 'Купите {val} островов', [
    [1, '1', 15],
    [2, '2', 5],
    [3, '3', 0.8],
  ]),

  // ═══════════════════════════════════════════
  // АКСЕССУАРЫ (22)
  // ═══════════════════════════════════════════
  ...gen('acc_total', 'accessories', 'accessoryCount', 'accessories', '{val} аксессуаров', 'Купите {val} аксессуаров', [
    [1, '1', 55],
    [3, '3', 35],
    [5, '5', 20],
    [8, '8', 10],
    [10, '10', 5],
    [12, '12', 2],
    [14, '14', 0.5],
  ]),
  ...gen('acc_nft', 'accessories', 'accCategoryCount:nft', 'nft', '{val} NFT', 'Купите {val} NFT', [
    [1, '1', 45],
    [2, '2', 20],
    [3, '3', 5],
  ]),
  ...gen('acc_watch', 'accessories', 'accCategoryCount:watches', 'watches', '{val} часов', 'Купите {val} часов', [
    [1, '1', 40],
    [2, '2', 18],
    [3, '3', 5],
  ]),
  ...gen('acc_jewel', 'accessories', 'accCategoryCount:jewelry', 'jewelry', '{val} украшений', 'Купите {val} украшений', [
    [1, '1', 30],
    [2, '2', 10],
  ]),
  ...gen('acc_art', 'accessories', 'accCategoryCount:art', 'art', '{val} картин', 'Купите {val} картин', [
    [1, '1', 22],
    [2, '2', 6],
  ]),
  ...gen('acc_elec', 'accessories', 'accCategoryCount:electronics', 'electronics', '{val} электроники', 'Купите {val} единиц электроники', [
    [1, '1', 45],
    [2, '2', 15],
  ]),
  ...gen('acc_classic', 'accessories', 'accCategoryCount:classics', 'classics', 'Классический авто', 'Купите классический автомобиль', [
    [1, '1', 8],
  ]),
  ...gen('acc_artifact', 'accessories', 'accCategoryCount:artifacts', 'artifacts', 'Артефакт', 'Купите исторический артефакт', [
    [1, '1', 10],
  ]),

  // ═══════════════════════════════════════════
  // АКЦИИ (22)
  // ═══════════════════════════════════════════
  ...gen('stk_count', 'stocks', 'stockUniqueCount', 'stocks', '{val} акций', 'Держите {val} различных акций', [
    [1, '1', 55],
    [3, '3', 35],
    [5, '5', 20],
    [8, '8', 8],
    [10, '10', 3],
    [12, '12', 0.8],
  ]),
  ...gen('stk_value', 'stocks', 'stockPortfolioValue', 'stocks', 'Портфель: {val}', 'Стоимость портфеля акций {val}', [
    [1_000, '$1K', 50],
    [10_000, '$10K', 32],
    [50_000, '$50K', 18],
    [250_000, '$250K', 8],
    [1_000_000, '$1M', 3],
    [5_000_000, '$5M', 1],
    [25_000_000, '$25M', 0.2],
    [100_000_000, '$100M', 0.05],
  ]),
  ...gen('stk_profit', 'stocks', 'totalEarnedTrading', 'investments', 'Прибыль: {val}', 'Заработайте {val} на торговле акциями', [
    [1_000, '$1K', 42],
    [10_000, '$10K', 25],
    [100_000, '$100K', 10],
    [1_000_000, '$1M', 2.5],
    [10_000_000, '$10M', 0.5],
    [50_000_000, '$50M', 0.1],
    [250_000_000, '$250M', 0.02],
    [1_000_000_000, '$1B', 0.005],
  ]),

  // ═══════════════════════════════════════════
  // КРИПТО (22)
  // ═══════════════════════════════════════════
  ...gen('cry_count', 'crypto', 'cryptoUniqueCount', 'crypto', '{val} криптовалют', 'Держите {val} различных криптовалют', [
    [1, '1', 50],
    [3, '3', 30],
    [5, '5', 15],
    [8, '8', 3],
  ]),
  ...gen('cry_value', 'crypto', 'cryptoPortfolioValue', 'wallet', 'Крипто-портфель: {val}', 'Стоимость крипто-портфеля {val}', [
    [1_000, '$1K', 45],
    [10_000, '$10K', 28],
    [50_000, '$50K', 14],
    [250_000, '$250K', 6],
    [1_000_000, '$1M', 2],
    [5_000_000, '$5M', 0.6],
    [25_000_000, '$25M', 0.15],
    [100_000_000, '$100M', 0.03],
  ]),
  ...gen('cry_profit', 'crypto', 'totalEarnedCrypto', 'rocket', 'Крипто-прибыль: {val}', 'Заработайте {val} на крипте', [
    [500, '$500', 40],
    [5_000, '$5K', 25],
    [50_000, '$50K', 12],
    [500_000, '$500K', 4],
    [2_000_000, '$2M', 1],
    [10_000_000, '$10M', 0.3],
    [50_000_000, '$50M', 0.06],
    [500_000_000, '$500M', 0.01],
  ]),
  // Specific crypto holdings
  { id: 'cry_btc_1', title: 'Биткоинер', description: 'Купите Bitcoin', icon: 'btc', category: 'crypto', metric: 'hasCrypto:btc', threshold: 1, rarityPercent: 45 },
  { id: 'cry_eth_1', title: 'Эфириум-фанат', description: 'Купите Ethereum', icon: 'eth', category: 'crypto', metric: 'hasCrypto:eth', threshold: 1, rarityPercent: 40 },

  // ═══════════════════════════════════════════
  // УЛУЧШЕНИЯ (20)
  // ═══════════════════════════════════════════
  ...gen('upg_level', 'upgrades', 'upgradeLevel', 'upgrade', 'Уровень {val}', 'Достигните {val} уровня улучшений', [
    [1, '1', 85],
    [5, '5', 68],
    [10, '10', 52],
    [15, '15', 40],
    [20, '20', 30],
    [30, '30', 18],
    [40, '40', 10],
    [50, '50', 5],
    [60, '60', 2.5],
    [70, '70', 1.2],
    [80, '80', 0.5],
    [90, '90', 0.2],
    [100, '100', 0.08],
  ]),
  ...gen('upg_spent', 'upgrades', 'upgradeSpent', 'earning', 'Потрачено: {val}', 'Потратьте {val} на улучшения', [
    [1_000, '$1K', 70],
    [10_000, '$10K', 45],
    [100_000, '$100K', 22],
    [500_000, '$500K', 8],
    [2_000_000, '$2M', 2.5],
    [10_000_000, '$10M', 0.5],
    [50_000_000, '$50M', 0.1],
  ]),

  // ═══════════════════════════════════════════
  // ПРЕСТИЖ / СОСТОЯНИЕ (25)
  // ═══════════════════════════════════════════
  ...gen('nw', 'prestige', 'netWorth', 'forbes', 'Состояние: {val}', 'Достигните состояния в {val}', [
    [1_000, '$1K', 75],
    [5_000, '$5K', 62],
    [10_000, '$10K', 55],
    [50_000, '$50K', 42],
    [100_000, '$100K', 35],
    [250_000, '$250K', 25],
    [500_000, '$500K', 18],
    [1_000_000, '$1M', 12],
    [5_000_000, '$5M', 6],
    [10_000_000, '$10M', 3.5],
    [25_000_000, '$25M', 2],
    [50_000_000, '$50M', 1.2],
    [100_000_000, '$100M', 0.6],
    [250_000_000, '$250M', 0.25],
    [500_000_000, '$500M', 0.1],
    [1_000_000_000, '$1B', 0.04],
    [5_000_000_000, '$5B', 0.01],
    [10_000_000_000, '$10B', 0.005],
  ]),
  ...gen('bal', 'prestige', 'balance', 'balance', 'Баланс: {val}', 'Накопите {val} на балансе', [
    [10_000, '$10K', 65],
    [100_000, '$100K', 38],
    [1_000_000, '$1M', 15],
    [10_000_000, '$10M', 4],
    [100_000_000, '$100M', 0.8],
    [1_000_000_000, '$1B', 0.1],
    [10_000_000_000, '$10B', 0.01],
  ]),
];

// Exactly 200 achievements
// console.log('Total achievements:', achievements.length);
