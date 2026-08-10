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
}

export interface CryptoAsset {
  id: string;
  ticker: string;
  name: string;
  emoji: string;
  basePrice: number;
  volatility: number;
}

export const stockAssets: StockAsset[] = [
  { id: 'aapl', ticker: 'AAPL', name: 'Apple Inc.', emoji: '🍎', sector: 'Технологии', basePrice: 178, volatility: 0.25, dividendYield: 0.005 },
  { id: 'googl', ticker: 'GOOGL', name: 'Alphabet Inc.', emoji: '🔍', sector: 'Технологии', basePrice: 141, volatility: 0.3, dividendYield: 0 },
  { id: 'tsla', ticker: 'TSLA', name: 'Tesla Inc.', emoji: '🚗', sector: 'Авто', basePrice: 245, volatility: 0.55, dividendYield: 0 },
  { id: 'amzn', ticker: 'AMZN', name: 'Amazon.com', emoji: '📦', sector: 'Ритейл', basePrice: 185, volatility: 0.3, dividendYield: 0 },
  { id: 'msft', ticker: 'MSFT', name: 'Microsoft', emoji: '💻', sector: 'Технологии', basePrice: 415, volatility: 0.2, dividendYield: 0.007 },
  { id: 'nvda', ticker: 'NVDA', name: 'NVIDIA', emoji: '🎮', sector: 'Чипы', basePrice: 875, volatility: 0.5, dividendYield: 0.001 },
  { id: 'jpm', ticker: 'JPM', name: 'JPMorgan Chase', emoji: '🏦', sector: 'Финансы', basePrice: 198, volatility: 0.2, dividendYield: 0.025 },
  { id: 'ko', ticker: 'KO', name: 'Coca-Cola', emoji: '🥤', sector: 'Напитки', basePrice: 60, volatility: 0.1, dividendYield: 0.03 },
  { id: 'dis', ticker: 'DIS', name: 'Walt Disney', emoji: '🏰', sector: 'Развлечения', basePrice: 112, volatility: 0.3, dividendYield: 0 },
  { id: 'ba', ticker: 'BA', name: 'Boeing', emoji: '✈️', sector: 'Авиа', basePrice: 210, volatility: 0.4, dividendYield: 0 },
  { id: 'xom', ticker: 'XOM', name: 'ExxonMobil', emoji: '⛽', sector: 'Энергетика', basePrice: 104, volatility: 0.25, dividendYield: 0.035 },
  { id: 'pfe', ticker: 'PFE', name: 'Pfizer', emoji: '💊', sector: 'Фарма', basePrice: 28, volatility: 0.3, dividendYield: 0.06 },
];

export const cryptoAssets: CryptoAsset[] = [
  { id: 'btc', ticker: 'BTC', name: 'Bitcoin', emoji: '₿', basePrice: 67500, volatility: 0.45 },
  { id: 'eth', ticker: 'ETH', name: 'Ethereum', emoji: '⟠', basePrice: 3450, volatility: 0.5 },
  { id: 'sol', ticker: 'SOL', name: 'Solana', emoji: '☀️', basePrice: 148, volatility: 0.6 },
  { id: 'bnb', ticker: 'BNB', name: 'BNB', emoji: '🔶', basePrice: 595, volatility: 0.4 },
  { id: 'ada', ticker: 'ADA', name: 'Cardano', emoji: '🔷', basePrice: 0.62, volatility: 0.55 },
  { id: 'xrp', ticker: 'XRP', name: 'Ripple', emoji: '💧', basePrice: 0.52, volatility: 0.5 },
  { id: 'doge', ticker: 'DOGE', name: 'Dogecoin', emoji: '🐕', basePrice: 0.16, volatility: 0.65 },
  { id: 'dot', ticker: 'DOT', name: 'Polkadot', emoji: '⚪', basePrice: 7.5, volatility: 0.5 },
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
