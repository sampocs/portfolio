export interface AssetPriceHistory {
  date: string;
  price: string;
}

export interface AssetPriceData {
  live_price: string;
  price_history: AssetPriceHistory[];
}

export interface AssetTrade {
  date: string;
  action: 'BUY' | 'SELL';
  quantity: string;
  price: string;
}

export interface AssetTradeData {
  trades: AssetTrade[];
}

export interface AssetDetailData {
  symbol: string;
  priceData: AssetPriceData;
  tradeData: AssetTradeData;
}

export interface ProcessedPriceData {
  date: string;
  price: number;
}

export interface AssetHoldings {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  totalQuantity: number;
  averagePrice: number;
}

export type AssetDuration = '1D' | '1W' | '1M' | 'YTD' | '1Y';

export interface AssetPriceChange {
  currentPrice: number;
  previousPrice: number;
  changeAmount: number;
  changePercent: number;
  isPositive: boolean;
}