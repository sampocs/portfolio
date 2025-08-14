export interface Asset {
  asset: string;
  category: string;
  description: string;
  current_price: string;
  average_price: string;
  quantity: string;
  cost: string;
  value: string;
  returns: string;
  current_allocation: string;
  target_allocation: string;
}

export interface PerformanceData {
  date: string;
  cost: string;
  value: string;
  returns: string;
}

export interface AssetConfig {
  asset: string;
  description: string;
  target_allocation: number;
  category: string;
  platform: string;
  price_type: string;
  logo: string;
}

export type GranularityType = '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalReturn: number;
  totalReturnPercent: number;
}

export interface CategoryAllocation {
  category: string;
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