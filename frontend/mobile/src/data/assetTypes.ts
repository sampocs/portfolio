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
  owned: number;                // Current quantity held
  averagePrice: number;         // Average cost per share of current holdings
  costBasis: number;            // FIFO cost basis of the lots still held
  marketValue: number;          // Current market value of holdings (owned * currentPrice)
  unrealized: number;           // Gains/losses from current holdings (marketValue - costBasis)
  invested: number;             // Total real cash spent on buys (sum of trade.cost)
  sold: number;                 // Total real cash received from sells (sum of trade.cost)
  netInvested: number;          // Cash still at risk: invested - sold
  realized: number;             // Gains/losses from completed sells
  totalReturn: number;          // Total gains/losses: marketValue + sold - invested
  totalReturnPercent: number;   // Total return as a percentage of invested
  tradeCount: number;           // Number of trades replayed
  lastSellDate: string | null;  // ISO date of the latest SELL trade, or null if none
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