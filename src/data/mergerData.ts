export interface BusinessMerger {
  id: string;
  name: string;
  emoji: string;
  /** Business category IDs required (one business from each consumed) */
  requiredCategories: string[];
  /** Minimum stock portfolio value */
  minStockPortfolio?: number;
  /** Minimum crypto portfolio value */
  minCryptoPortfolio?: number;
  /** Minimum real-estate shop items value */
  minRealEstateValue?: number;
  /** Minimum islands count purchased */
  minIslandCount?: number;
  /** Income per hour for the merged business */
  resultIncomePerHour: number;
}

export const businessMergers: BusinessMerger[] = [
  {
    id: 'clothing-brand',
    name: 'Бренд одежды',
    emoji: '👗',
    requiredCategories: ['retail', 'manufacturing'],
    resultIncomePerHour: 5_500,
  },
  {
    id: 'holding-company',
    name: 'Холдинговая компания',
    emoji: '🏛️',
    requiredCategories: ['bank'],
    minStockPortfolio: 5_000_000,
    resultIncomePerHour: 1_500_000,
  },
  {
    id: 'hotel-industry',
    name: 'Гостиничная индустрия',
    emoji: '🏨',
    requiredCategories: ['taxi'],
    minRealEstateValue: 5_000_000,
    minIslandCount: 1,
    resultIncomePerHour: 50_000,
  },
  {
    id: 'blockchain-platform',
    name: 'Блокчейн-платформа',
    emoji: '⛓️',
    requiredCategories: ['it'],
    minCryptoPortfolio: 1_000_000_000,
    resultIncomePerHour: 500_000,
  },
];
