// ── Stock & Crypto assets ──

export interface StockAsset {
  id: string;
  ticker: string;
  name: string;
  emoji: string;
  sector: string;
  basePrice: number;
  volatility: number; // 0-1, higher = more volatile
  dividendYield: number; // annual % yield, 0 for no dividends
  marketCap: number;
  availableShares: number;
}

export interface CryptoAsset {
  id: string;
  ticker: string;
  name: string;
  emoji: string;
  basePrice: number;
  volatility: number;
  marketCap: number;
  availableSupply: number;
}

export const stockAssets: StockAsset[] = [
  { id: 'aapl', ticker: 'AAPL', name: 'Apple Inc.', emoji: '🍎', sector: 'Технологии', basePrice: 178, volatility: 0.25, dividendYield: 0.005, marketCap: 3.1e12, availableShares: 15.4e9 },
  { id: 'googl', ticker: 'GOOGL', name: 'Alphabet Inc.', emoji: '🔍', sector: 'Технологии', basePrice: 141, volatility: 0.3, dividendYield: 0, marketCap: 2.1e12, availableShares: 12.4e9 },
  { id: 'tsla', ticker: 'TSLA', name: 'Tesla Inc.', emoji: '🚗', sector: 'Авто', basePrice: 245, volatility: 0.55, dividendYield: 0, marketCap: 780e9, availableShares: 3.2e9 },
  { id: 'amzn', ticker: 'AMZN', name: 'Amazon.com', emoji: '📦', sector: 'Ритейл', basePrice: 185, volatility: 0.3, dividendYield: 0, marketCap: 1.95e12, availableShares: 10.5e9 },
  { id: 'msft', ticker: 'MSFT', name: 'Microsoft', emoji: '💻', sector: 'Технологии', basePrice: 415, volatility: 0.2, dividendYield: 0.007, marketCap: 3.05e12, availableShares: 7.43e9 },
  { id: 'nvda', ticker: 'NVDA', name: 'NVIDIA', emoji: '🎮', sector: 'Чипы', basePrice: 875, volatility: 0.5, dividendYield: 0.001, marketCap: 2.2e12, availableShares: 2.47e9 },
  { id: 'jpm', ticker: 'JPM', name: 'JPMorgan Chase', emoji: '🏦', sector: 'Финансы', basePrice: 198, volatility: 0.2, dividendYield: 0.025, marketCap: 570e9, availableShares: 2.88e9 },
  { id: 'ko', ticker: 'KO', name: 'Coca-Cola', emoji: '🥤', sector: 'Напитки', basePrice: 60, volatility: 0.1, dividendYield: 0.03, marketCap: 260e9, availableShares: 4.31e9 },
  { id: 'dis', ticker: 'DIS', name: 'Walt Disney', emoji: '🏰', sector: 'Развлечения', basePrice: 112, volatility: 0.3, dividendYield: 0, marketCap: 205e9, availableShares: 1.83e9 },
  { id: 'ba', ticker: 'BA', name: 'Boeing', emoji: '✈️', sector: 'Авиа', basePrice: 210, volatility: 0.4, dividendYield: 0, marketCap: 128e9, availableShares: 610e6 },
  { id: 'xom', ticker: 'XOM', name: 'ExxonMobil', emoji: '⛽', sector: 'Энергетика', basePrice: 104, volatility: 0.25, dividendYield: 0.035, marketCap: 410e9, availableShares: 3.95e9 },
  { id: 'pfe', ticker: 'PFE', name: 'Pfizer', emoji: '💊', sector: 'Фарма', basePrice: 28, volatility: 0.3, dividendYield: 0.06, marketCap: 158e9, availableShares: 5.66e9 },
];

export const cryptoAssets: CryptoAsset[] = [
  { id: 'btc', ticker: 'BTC', name: 'Bitcoin', emoji: '₿', basePrice: 67500, volatility: 0.45, marketCap: 1.34e12, availableSupply: 19.8e6 },
  { id: 'eth', ticker: 'ETH', name: 'Ethereum', emoji: '⟠', basePrice: 3450, volatility: 0.5, marketCap: 415e9, availableSupply: 120.3e6 },
  { id: 'sol', ticker: 'SOL', name: 'Solana', emoji: '☀️', basePrice: 148, volatility: 0.6, marketCap: 69e9, availableSupply: 466e6 },
  { id: 'bnb', ticker: 'BNB', name: 'BNB', emoji: '🔶', basePrice: 595, volatility: 0.4, marketCap: 88e9, availableSupply: 148e6 },
  { id: 'ada', ticker: 'ADA', name: 'Cardano', emoji: '🔷', basePrice: 0.62, volatility: 0.55, marketCap: 22e9, availableSupply: 35.5e9 },
  { id: 'xrp', ticker: 'XRP', name: 'Ripple', emoji: '💧', basePrice: 0.52, volatility: 0.5, marketCap: 29e9, availableSupply: 56e9 },
  { id: 'doge', ticker: 'DOGE', name: 'Dogecoin', emoji: '🐕', basePrice: 0.16, volatility: 0.65, marketCap: 23e9, availableSupply: 145e9 },
  { id: 'dot', ticker: 'DOT', name: 'Polkadot', emoji: '⚪', basePrice: 7.5, volatility: 0.5, marketCap: 10.8e9, availableSupply: 1.44e9 },
];

// Price history generation with realistic random walk
export function generatePriceHistory(basePrice: number, volatility: number, points: number = 30): number[] {
  const prices: number[] = [basePrice];
  let price = basePrice;
  for (let i = 1; i < points; i++) {
    const change = (Math.random() - 0.48) * volatility * price * 0.08; // slight upward bias
    price = Math.max(price * 0.5, price + change);
    prices.push(parseFloat(price.toFixed(price < 1 ? 4 : 2)));
  }
  return prices;
}

// Simulate next price tick
export function nextPriceTick(currentPrice: number, volatility: number): number {
  const change = (Math.random() - 0.48) * volatility * currentPrice * 0.04;
  const newPrice = Math.max(currentPrice * 0.5, currentPrice + change);
  return parseFloat(newPrice.toFixed(newPrice < 1 ? 4 : 2));
}
