import { AssetPriceData, AssetTradeData, AssetTrade, AssetPriceHistory, AssetDuration } from './assetTypes';
import { AssetPerformance, AssetPerformancePoint } from './types';
import { mockPositions } from './mockData';

// Helper function to generate realistic price history
const generatePriceHistory = (
  basePrice: number,
  days: number,
  volatility: number = 0.02
): AssetPriceHistory[] => {
  const history: AssetPriceHistory[] = [];
  let currentPrice = basePrice;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    // Generate realistic price movement
    const change = (Math.random() - 0.5) * 2 * volatility;
    currentPrice = currentPrice * (1 + change);
    
    history.push({
      date: date.toISOString().split('T')[0],
      price: currentPrice.toFixed(2)
    });
  }
  
  return history;
};

// Crypto assets settle on Coinbase; everything else trades through IBKR.
const CRYPTO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL']);

// Rough fee rate applied to the gross trade value, used to derive a realistic
// net cash `cost` (real cash that moved) from the gross `value` (quantity * price).
const FEE_RATE = 0.001;

// Helper function to generate realistic trades
const generateTrades = (symbol: string, quantity: number): AssetTrade[] => {
  const trades: AssetTrade[] = [];
  const basePrice = getBasePriceForAsset(symbol);
  const platform = CRYPTO_SYMBOLS.has(symbol) ? 'COINBASE' : 'IBKR';
  let remainingQuantity = quantity;

  // Generate 3-8 trades over the past year
  const numTrades = Math.floor(Math.random() * 6) + 3;
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  for (let i = 0; i < numTrades && remainingQuantity > 0; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + (i * 365) / numTrades);

    // Mostly buys with occasional sells
    const action: 'BUY' | 'SELL' = Math.random() < 0.85 ? 'BUY' : 'SELL';

    let tradeQuantity: number;
    if (action === 'BUY') {
      tradeQuantity = Math.min(remainingQuantity * (0.2 + Math.random() * 0.3), remainingQuantity);
      remainingQuantity -= tradeQuantity;
    } else {
      // Sell a smaller portion
      tradeQuantity = Math.min(quantity * (0.1 + Math.random() * 0.2), quantity - remainingQuantity);
      remainingQuantity += tradeQuantity;
    }

    // Price variation around base price
    const priceVariation = 0.8 + Math.random() * 0.4;
    const tradePrice = basePrice * priceVariation;

    // Gross trade value, fees, and the real net cash cost: a buy costs more
    // than its gross value (fees add to cash out), a sell nets less than its
    // gross value (fees are subtracted from cash in).
    const tradeValue = tradeQuantity * tradePrice;
    const fees = tradeValue * FEE_RATE;
    const cost = action === 'BUY' ? tradeValue + fees : tradeValue - fees;

    trades.push({
      platform,
      date: date.toISOString().split('T')[0],
      id: `${symbol}-${i}`,
      price: tradePrice,
      fees,
      value: tradeValue,
      asset: symbol,
      action,
      quantity: tradeQuantity,
      cost,
      excluded: false
    });
  }

  return trades.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

// Base prices for different assets
const getBasePriceForAsset = (symbol: string): number => {
  const basePrices: { [key: string]: number } = {
    'VT': 245,
    'VOO': 512,
    'VO': 299,
    'VB': 240,
    'VXUS': 69,
    'VWO': 52,
    'COIN': 285,
    'HOOD': 24,
    'AAAU': 28,
    'VNQ': 105,
    'BTC': 43500,
    'ETH': 3200,
    'SOL': 210
  };
  
  return basePrices[symbol] || 100;
};

// Generate current/live prices (slightly different from base)
const getLivePriceForAsset = (symbol: string): string => {
  const basePrice = getBasePriceForAsset(symbol);
  const variation = 0.95 + Math.random() * 0.1; // ±5% variation
  return (basePrice * variation).toFixed(2);
};

// Mock data for each asset
export const mockAssetPriceData: { [symbol: string]: AssetPriceData } = {
  'VT': {
    live_price: getLivePriceForAsset('VT'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(245, 365, 0.015)
  },
  'VOO': {
    live_price: getLivePriceForAsset('VOO'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(512, 365, 0.012)
  },
  'VO': {
    live_price: getLivePriceForAsset('VO'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(299, 365, 0.014)
  },
  'VB': {
    live_price: getLivePriceForAsset('VB'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(240, 365, 0.018)
  },
  'VXUS': {
    live_price: getLivePriceForAsset('VXUS'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(69, 365, 0.016)
  },
  'VWO': {
    live_price: getLivePriceForAsset('VWO'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(52, 365, 0.020)
  },
  'COIN': {
    live_price: getLivePriceForAsset('COIN'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(285, 365, 0.035)
  },
  'HOOD': {
    live_price: getLivePriceForAsset('HOOD'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(24, 365, 0.040)
  },
  'AAAU': {
    live_price: getLivePriceForAsset('AAAU'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(28, 365, 0.008)
  },
  'VNQ': {
    live_price: getLivePriceForAsset('VNQ'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(105, 365, 0.020)
  },
  'BTC': {
    live_price: getLivePriceForAsset('BTC'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(43500, 365, 0.045)
  },
  'ETH': {
    live_price: getLivePriceForAsset('ETH'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(3200, 365, 0.050)
  },
  'SOL': {
    live_price: getLivePriceForAsset('SOL'),
    updated_at: new Date().toISOString(),
    historical_prices: generatePriceHistory(210, 365, 0.060)
  }
};

export const mockAssetTradeData: { [symbol: string]: AssetTradeData } = {
  'VT': {
    trades: generateTrades('VT', 18.99)
  },
  'VOO': {
    trades: generateTrades('VOO', 42.15)
  },
  'VO': {
    trades: generateTrades('VO', 21.25)
  },
  'VB': {
    trades: generateTrades('VB', 26.44)
  },
  'VXUS': {
    trades: generateTrades('VXUS', 15.82)
  },
  'VWO': {
    trades: generateTrades('VWO', 31.75)
  },
  'COIN': {
    trades: generateTrades('COIN', 8.92)
  },
  'HOOD': {
    trades: generateTrades('HOOD', 125.50)
  },
  'AAAU': {
    trades: generateTrades('AAAU', 185.33)
  },
  'VNQ': {
    trades: generateTrades('VNQ', 45.88)
  },
  'BTC': {
    trades: generateTrades('BTC', 0.85)
  },
  'ETH': {
    trades: generateTrades('ETH', 5.22)
  },
  'SOL': {
    trades: generateTrades('SOL', 95.75)
  }
};

// Service functions
export const getAssetPriceData = async (symbol: string): Promise<AssetPriceData> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const data = mockAssetPriceData[symbol];
  if (!data) {
    throw new Error(`Price data not found for asset: ${symbol}`);
  }
  
  return data;
};

export const getAssetTradeData = async (symbol: string): Promise<AssetTradeData> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const data = mockAssetTradeData[symbol];
  if (!data) {
    throw new Error(`Trade data not found for asset: ${symbol}`);
  }
  
  return data;
};

/**
 * Number of trailing days each duration covers, mirroring
 * AssetService.processPriceDataForDuration so demo and live windows line up.
 * 'YTD' is excluded because it starts from Jan 1 rather than a fixed day count.
 */
const DURATION_TRAILING_DAYS: Record<Exclude<AssetDuration, 'YTD'>, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 30,
  '1Y': 365,
  '5Y': 1825,
};

/**
 * The historical prices inside a duration's window, ascending by date. '1D' keeps only
 * the most recent close, matching how the price chart pairs it with the live point.
 */
const getPriceHistoryForDuration = (
  historicalPrices: AssetPriceHistory[],
  duration: AssetDuration
): AssetPriceHistory[] => {
  const ascendingPrices = [...historicalPrices].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  if (duration === '1D') {
    return ascendingPrices.slice(-1);
  }

  const today = new Date();
  const cutoffDate = new Date(today);
  if (duration === 'YTD') {
    cutoffDate.setTime(new Date(today.getFullYear(), 0, 1).getTime());
  } else {
    cutoffDate.setDate(today.getDate() - DURATION_TRAILING_DAYS[duration]);
  }

  return ascendingPrices.filter(item => new Date(item.date) >= cutoffDate);
};

/**
 * Build a demo asset performance response: the mock price series scaled by the mock
 * position's quantity. Cash flows are pinned to the position's all-time totals across
 * the whole window, so every in-window flow is zero and the demo gain is simply the
 * change in value.
 */
export const getAssetPerformanceData = async (
  symbol: string,
  duration: AssetDuration
): Promise<AssetPerformance> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 100));

  const priceData = mockAssetPriceData[symbol];
  if (!priceData) {
    throw new Error(`Price data not found for asset: ${symbol}`);
  }

  const position = mockPositions.find(item => item.asset === symbol);
  if (!position) {
    throw new Error(`Position not found for asset: ${symbol}`);
  }

  const quantity = parseFloat(position.quantity);
  const windowPrices = getPriceHistoryForDuration(priceData.historical_prices, duration);

  const history: AssetPerformancePoint[] = windowPrices.map(item => ({
    date: item.date,
    value: (parseFloat(item.price) * quantity).toFixed(2),
    buys: position.buys,
    sells: position.sells,
  }));

  // An empty window (no mock history that far back) falls back to today's position, which
  // leaves the baseline equal to the live point and reports a flat gain rather than crashing
  const firstPoint = history[0];
  const todayString = new Date().toISOString().split('T')[0];

  return {
    start_date: firstPoint ? firstPoint.date : todayString,
    start_value: firstPoint ? firstPoint.value : position.value,
    start_buys: position.buys,
    start_sells: position.sells,
    history,
  };
};

export const getAssetDetailData = async (symbol: string) => {
  const [priceData, tradeData] = await Promise.all([
    getAssetPriceData(symbol),
    getAssetTradeData(symbol)
  ]);
  
  return {
    symbol,
    priceData,
    tradeData
  };
};