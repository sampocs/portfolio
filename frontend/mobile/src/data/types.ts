import { PortfolioDuration, ProcessedPriceData } from "./assetTypes";

export interface Asset {
  asset: string;
  market: string;
  segment: string;
  description: string;
  current_price: string;
  average_price: string;
  quantity: string;
  cost: string; // Remaining FIFO cost basis of open lots
  value: string;
  buys: string; // Cumulative cash spent on BUY trades
  sells: string; // Cumulative cash received from SELL trades
  total_return: string; // value + sells - buys
  returns: string; // Total return percent: total_return / buys * 100 (0 when buys is 0)
  current_allocation: string;
  target_allocation: string;
}

export interface WatchlistAsset {
  asset: string;
  description: string;
  market: string;
  current_price: string;
  changes: Record<PortfolioDuration, string>; // Percent move for each portfolio duration
  sparklines: Record<PortfolioDuration, string[]>; // Downsampled closes over each duration, ending at the live price
}

export interface AssetPerformancePoint {
  date: string;
  value: string; // Market value of the holding on this date
  buys: string; // Cumulative cash spent on BUY trades through this date
  sells: string; // Cumulative cash received from SELL trades through this date
}

/**
 * The cumulative state on a performance window's start date. Gains over the window are
 * measured against it, so only cash that moved inside the window counts.
 */
export interface AssetPerformanceBaseline {
  start_value: string; // Holding value on start_date (0 when the asset was not yet held)
  start_buys: string; // Cumulative buys through start_date, inclusive
  start_sells: string; // Cumulative sells through start_date, inclusive
}

export interface AssetPerformance extends AssetPerformanceBaseline {
  start_date: string;
  history: AssetPerformancePoint[];
}

/**
 * A point on the portfolio-mode value chart. `price` is the parsed holding value, so the
 * chart helpers built for price series work unchanged, while the raw value and cumulative
 * cash flows ride along so a scrubbed point can be re-gained against the window baseline.
 */
export interface ProcessedValueData
  extends ProcessedPriceData,
    AssetPerformancePoint {}

export interface PerformanceData {
  date: string;
  cost: string; // Remaining FIFO cost basis of open lots
  value: string;
  buys: string; // Cumulative cash spent on BUY trades through this date
  sells: string; // Cumulative cash received from SELL trades through this date
  returns: string; // Total return percent: (value + sells - buys) / buys * 100 (0 when buys is 0)
}

export interface AssetConfig {
  asset: string;
  description: string;
  target_allocation: number;
  market: string;
  segment: string;
  platform: string;
  price_type: string;
  logo: string;
}

export type GranularityType = "1W" | "1M" | "YTD" | "1Y" | "ALL";

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number; // Sum of remaining FIFO cost basis (not total cash invested)
  totalReturn: number; // Sum of total_return across positions
  totalReturnPercent: number; // totalReturn / sum(buys) * 100 (0 when buys sum is 0)
}

export interface MarketAllocation {
  market: string;
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;
  assets: Asset[];
  dollarDelta: number;
  percentageDelta: number;
}

export interface SegmentAllocation {
  segment: string;
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;
  assets: Asset[];
  dollarDelta: number;
  percentageDelta: number;
}

export interface AllocationDelta {
  dollarDelta: number;
  percentageDelta: number;
  isOverAllocated: boolean;
}

// Generic allocation interface for both markets and segments
export interface GenericAllocation {
  name: string; // market name or segment name
  currentValue: number;
  currentAllocation: number;
  targetAllocation: number;
  assets: Asset[];
  dollarDelta: number;
  percentageDelta: number;
}
