import type { Business, CryptoHolding, PriceData, ShopItem, StockHolding } from './types';

export interface FinancialSnapshotInput {
  balance: number;
  shopItems: ShopItem[];
  accessoryItems: ShopItem[];
  businesses: Business[];
  stockHoldings: StockHolding[];
  cryptoHoldings: CryptoHolding[];
  stockPrices: PriceData;
  cryptoPrices: PriceData;
}

export function calculateFinancialSnapshot(input: FinancialSnapshotInput) {
  const byCategory = (category: string) => input.shopItems
    .filter(item => item.purchased && item.category === category)
    .reduce((sum, item) => sum + item.price, 0);
  const shop = input.shopItems.filter(item => item.purchased).reduce((sum, item) => sum + item.price, 0);
  const accessories = input.accessoryItems.filter(item => item.purchased).reduce((sum, item) => sum + item.price, 0);
  const businesses = input.businesses.reduce((sum, business) => sum + business.investmentCost, 0);
  const stocks = input.stockHoldings.reduce((sum, holding) => sum + (input.stockPrices[holding.assetId]?.current ?? 0) * holding.quantity, 0);
  const crypto = input.cryptoHoldings.reduce((sum, holding) => sum + (input.cryptoPrices[holding.assetId]?.current ?? 0) * holding.quantity, 0);
  const realEstate = byCategory('realestate');
  const transport = ['cars', 'ships', 'planes'].reduce((sum, category) => sum + byCategory(category), 0);
  const infrastructure = ['garage', 'hangar', 'dock'].reduce((sum, category) => sum + byCategory(category), 0);
  const islands = byCategory('islands');

  return {
    balance: input.balance,
    shop,
    accessories,
    businesses,
    stocks,
    crypto,
    realEstate,
    transport,
    infrastructure,
    islands,
    netWorth: input.balance + shop + accessories + businesses + stocks + crypto,
  };
}
