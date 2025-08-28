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
  netInvested: number;          // Total money in - total money out (can be negative)
  currentValue: number;         // Current market value of holdings
  totalReturn: number;          // Total gains/losses (realized + unrealized)
  totalReturnPercent: number;   // Total return as percentage
  realizedGains: number;        // Gains/losses from completed sells
  unrealizedGains: number;      // Gains/losses from current holdings
  totalQuantity: number;        // Current quantity held
  averagePrice: number;         // Average cost per share of current holdings
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