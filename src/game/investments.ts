import type { CryptoHolding, PriceData, StockHolding } from './types';

export function calculatePortfolioValue(
  holdings: Array<StockHolding | CryptoHolding>,
  prices: PriceData,
): number {
  return holdings.reduce(
    (sum, holding) => sum + (prices[holding.assetId]?.current ?? 0) * holding.quantity,
    0,
  );
}

export function calculateWeightedAveragePrice(input: {
  currentQuantity: number;
  currentAveragePrice: number;
  addedQuantity: number;
  addedCost: number;
}): number {
  const newQuantity = input.currentQuantity + input.addedQuantity;
  if (newQuantity <= 0) return 0;
  return (
    input.currentAveragePrice * input.currentQuantity + input.addedCost
  ) / newQuantity;
}

export function calculateTradeProfit(input: {
  sellPrice: number;
  averageBuyPrice: number;
  quantity: number;
}): number {
  return (input.sellPrice - input.averageBuyPrice) * input.quantity;
}
