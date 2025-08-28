import { DURATIONS } from '../constants';

export interface AssetPriceHistory {
  date: string;
  price: string;
}

export interface AssetPriceData {
  live_price: string;
  updated_at: string;
  historical_prices: AssetPriceHistory[];
}

export interface AssetTrade {
  platform: string;
  date: string;
  id: string;
  price: number;
  fees: number;
  value: number;
  asset: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  cost: number;
  excluded: boolean;
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

export type AssetDuration = typeof DURATIONS.ASSET[number];
export type PortfolioDuration = typeof DURATIONS.PORTFOLIO[number];

export interface AssetPriceChange {
  currentPrice: number;
  previousPrice: number;
  changeAmount: number;
  changePercent: number;
  isPositive: boolean;
}