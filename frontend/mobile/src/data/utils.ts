import {
  Asset,
  PerformanceData,
  PortfolioSummary,
  MarketAllocation,
  SegmentAllocation,
  AllocationDelta,
} from "./types";

export const calculatePortfolioSummary = (
  positions: Asset[]
): PortfolioSummary => {
  const totalValue = positions.reduce(
    (sum, asset) => sum + parseFloat(asset.value),
    0
  );
  const totalCost = positions.reduce(
    (sum, asset) => sum + parseFloat(asset.cost),
    0
  );
  const totalReturn = totalValue - totalCost;
  const totalReturnPercent =
    totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalReturn,
    totalReturnPercent,
  };
};

export const calculateCurrentAllocations = (positions: Asset[]): Asset[] => {
  const totalValue = positions.reduce(
    (sum, asset) => sum + parseFloat(asset.value),
    0
  );

  const assetsWithAllocations = positions.map((asset) => {
    const allocation = ((parseFloat(asset.value) / totalValue) * 100).toFixed(
      2
    );
    return {
      ...asset,
      current_allocation: allocation,
    };
  });

  return assetsWithAllocations;
};

export const filterAssetsByMarket = (
  assets: Asset[],
  market: "Crypto" | "Stocks"
): Asset[] => {
  if (market === "Crypto") {
    return assets.filter((asset) => asset.market === "Crypto");
  } else {
    return assets.filter(
      (asset) => asset.market === "Stocks" || asset.market === "Alternatives"
    );
  }
};

export const getLatestPerformanceData = (
  performanceData: PerformanceData[]
): PerformanceData | null => {
  if (performanceData.length === 0) return null;
  return performanceData[performanceData.length - 1];
};

export const getPerformanceRange = (
  performanceData: PerformanceData[]
): { min: number; max: number } => {
  if (performanceData.length === 0) return { min: 0, max: 0 };

  const values = performanceData.map((data) => parseFloat(data.value));
  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
};

export const aggregateAssetsByMarket = (
  assets: Asset[]
): MarketAllocation[] => {
  const marketMap = new Map<string, MarketAllocation>();
  const totalPortfolioValue = assets.reduce(
    (sum, asset) => sum + parseFloat(asset.value),
    0
  );

  // Group assets by market
  assets.forEach((asset) => {
    const market = asset.market;
    const currentValue = parseFloat(asset.value);
    const currentAllocation = parseFloat(asset.current_allocation);
    const targetAllocation = parseFloat(asset.target_allocation);

    if (!marketMap.has(market)) {
      marketMap.set(market, {
        market,
        currentValue: 0,
        currentAllocation: 0,
        targetAllocation: 0,
        assets: [],
        dollarDelta: 0,
        percentageDelta: 0,
      });
    }

    const marketData = marketMap.get(market)!;
    marketData.currentValue += currentValue;
    marketData.currentAllocation += currentAllocation;
    marketData.targetAllocation += targetAllocation;
    marketData.assets.push(asset);
  });

  // Calculate deltas for each market
  const markets = Array.from(marketMap.values()).map((market) => {
    const targetValue = (market.targetAllocation / 100) * totalPortfolioValue;
    const dollarDelta = market.currentValue - targetValue;
    const percentageDelta = market.currentAllocation - market.targetAllocation;

    return {
      ...market,
      dollarDelta,
      percentageDelta,
    };
  });

  // Sort by target allocation (largest first)
  return markets.sort((a, b) => b.targetAllocation - a.targetAllocation);
};

export const calculateAllocationDelta = (
  current: number,
  target: number,
  totalValue: number
): AllocationDelta => {
  const targetValue = (target / 100) * totalValue;
  const currentValue = (current / 100) * totalValue;
  const dollarDelta = currentValue - targetValue;
  const percentageDelta = current - target;

  return {
    dollarDelta,
    percentageDelta,
    isOverAllocated: dollarDelta > 0,
  };
};

export const getMarketColor = (market: string): string => {
  const marketColors: { [key: string]: string } = {
    Stocks: "#34D86C", // Green
    Crypto: "#8B5CF6", // Purple
    Alternatives: "#AFD4FD", // Light blue
  };

  return marketColors[market] || "#999999"; // Default to muted color
};

export const getSegmentColor = (segment: string): string => {
  const segmentColors: { [key: string]: string } = {
    "Stock ETFs": "#34D86C", // Green
    "Crypto Stocks": "#8B5CF6", // Purple
    "Crypto Tokens": "#06A9C6", // Light blue
    Gold: "#FBBF24", // Light blue
    "Real Estate": "#AFD4FD", // Yellow
  };

  return segmentColors[segment] || "#999999"; // Default to muted color
};
