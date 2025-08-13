import {
  Asset,
  PerformanceData,
  PortfolioSummary,
  CategoryAllocation,
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

export const filterAssetsByCategory = (
  assets: Asset[],
  category: "Crypto" | "Stocks"
): Asset[] => {
  if (category === "Crypto") {
    return assets.filter(
      (asset) =>
        asset.category === "Crypto Tokens" || asset.category === "Crypto Stocks"
    );
  } else {
    return assets.filter(
      (asset) =>
        asset.category !== "Crypto Tokens" && asset.category !== "Crypto Stocks"
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

export const aggregateAssetsByCategory = (
  assets: Asset[]
): CategoryAllocation[] => {
  const categoryMap = new Map<string, CategoryAllocation>();
  const totalPortfolioValue = assets.reduce(
    (sum, asset) => sum + parseFloat(asset.value),
    0
  );

  // Group assets by category
  assets.forEach((asset) => {
    const category = asset.category;
    const currentValue = parseFloat(asset.value);
    const currentAllocation = parseFloat(asset.current_allocation);
    const targetAllocation = parseFloat(asset.target_allocation);

    if (!categoryMap.has(category)) {
      categoryMap.set(category, {
        category,
        currentValue: 0,
        currentAllocation: 0,
        targetAllocation: 0,
        assets: [],
        dollarDelta: 0,
        percentageDelta: 0,
      });
    }

    const categoryData = categoryMap.get(category)!;
    categoryData.currentValue += currentValue;
    categoryData.currentAllocation += currentAllocation;
    categoryData.targetAllocation += targetAllocation;
    categoryData.assets.push(asset);
  });

  // Calculate deltas for each category
  const categories = Array.from(categoryMap.values()).map((category) => {
    const targetValue = (category.targetAllocation / 100) * totalPortfolioValue;
    const dollarDelta = category.currentValue - targetValue;
    const percentageDelta =
      category.currentAllocation - category.targetAllocation;

    return {
      ...category,
      dollarDelta,
      percentageDelta,
    };
  });

  // Sort by target allocation (largest first)
  return categories.sort((a, b) => b.targetAllocation - a.targetAllocation);
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

export const getCategoryColor = (category: string): string => {
  const categoryColors: { [key: string]: string } = {
    "Stock ETFs": "#34D86C", // Green
    "Crypto Stocks": "#8B5CF6", // Purple
    "Crypto Tokens": "#06A9C6", // Very light blue
    Alternatives: "#AFD4FD", // Red
  };

  return categoryColors[category] || "#999999"; // Default to muted color
};
