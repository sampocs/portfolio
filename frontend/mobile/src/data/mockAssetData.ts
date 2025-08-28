import { AssetPriceData, AssetTradeData, AssetTrade, AssetPriceHistory } from './assetTypes';

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

// Helper function to generate realistic trades
const generateTrades = (symbol: string, quantity: number): AssetTrade[] => {
  const trades: AssetTrade[] = [];
  const basePrice = getBasePriceForAsset(symbol);
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
    
    trades.push({
      date: date.toISOString().split('T')[0],
      action,
      quantity: tradeQuantity.toFixed(4),
      price: tradePrice.toFixed(2)
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
    price_history: generatePriceHistory(245, 365, 0.015)
  },
  'VOO': {
    live_price: getLivePriceForAsset('VOO'),
    price_history: generatePriceHistory(512, 365, 0.012)
  },
  'VO': {
    live_price: getLivePriceForAsset('VO'),
    price_history: generatePriceHistory(299, 365, 0.014)
  },
  'VB': {
    live_price: getLivePriceForAsset('VB'),
    price_history: generatePriceHistory(240, 365, 0.018)
  },
  'VXUS': {
    live_price: getLivePriceForAsset('VXUS'),
    price_history: generatePriceHistory(69, 365, 0.016)
  },
  'VWO': {
    live_price: getLivePriceForAsset('VWO'),
    price_history: generatePriceHistory(52, 365, 0.020)
  },
  'COIN': {
    live_price: getLivePriceForAsset('COIN'),
    price_history: generatePriceHistory(285, 365, 0.035)
  },
  'HOOD': {
    live_price: getLivePriceForAsset('HOOD'),
    price_history: generatePriceHistory(24, 365, 0.040)
  },
  'AAAU': {
    live_price: getLivePriceForAsset('AAAU'),
    price_history: generatePriceHistory(28, 365, 0.008)
  },
  'VNQ': {
    live_price: getLivePriceForAsset('VNQ'),
    price_history: generatePriceHistory(105, 365, 0.020)
  },
  'BTC': {
    live_price: getLivePriceForAsset('BTC'),
    price_history: generatePriceHistory(43500, 365, 0.045)
  },
  'ETH': {
    live_price: getLivePriceForAsset('ETH'),
    price_history: generatePriceHistory(3200, 365, 0.050)
  },
  'SOL': {
    live_price: getLivePriceForAsset('SOL'),
    price_history: generatePriceHistory(210, 365, 0.060)
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