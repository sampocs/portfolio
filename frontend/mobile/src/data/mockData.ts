import { Asset, PerformanceData, WatchlistAsset } from "./types";
import { PortfolioDuration } from "./assetTypes";
import { calculateCurrentAllocations } from "./utils";
import { DATA, CHART } from "../constants";

/**
 * Mock Data Generator
 * 
 * Provides realistic mock data for demonstration purposes,
 * including asset positions and historical performance data.
 */

const rawMockPositions: Asset[] = [
  {
    asset: "VT",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "Total World",
    current_price: "202.01",
    average_price: "98.75",
    quantity: "245.80",
    cost: "24277.05",
    value: "49664.92",
    buys: "24277.05",
    sells: "0.00",
    total_return: "25387.87",
    returns: "104.58",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "30",
  },
  {
    asset: "VOO",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "Large Cap",
    current_price: "512.34",
    average_price: "478.92",
    quantity: "42.15",
    cost: "20193.58",
    value: "21595.13",
    buys: "20193.58",
    sells: "0.00",
    total_return: "1401.55",
    returns: "6.94",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "14",
  },
  {
    asset: "VO",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "Mid Cap",
    current_price: "278.91",
    average_price: "252.45",
    quantity: "22.35",
    cost: "5642.26",
    value: "6236.54",
    buys: "5642.26",
    sells: "0.00",
    total_return: "594.28",
    returns: "10.53",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "6",
  },
  {
    asset: "VB",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "Small Cap",
    current_price: "239.81",
    average_price: "208.53",
    quantity: "18.99",
    cost: "3941.53",
    value: "4532.60",
    buys: "3941.53",
    sells: "0.00",
    total_return: "591.07",
    returns: "15.00",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "4",
  },
  {
    asset: "VXUS",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "International",
    current_price: "64.89",
    average_price: "59.12",
    quantity: "31.45",
    cost: "1859.32",
    value: "2041.54",
    buys: "1859.32",
    sells: "0.00",
    total_return: "182.22",
    returns: "9.80",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "6",
  },
  {
    asset: "VWO",
    market: "Stocks",
    segment: "Stock ETFs",
    description: "Emerging",
    current_price: "45.67",
    average_price: "42.31",
    quantity: "43.21",
    cost: "1828.24",
    value: "1973.37",
    buys: "1828.24",
    sells: "0.00",
    total_return: "145.13",
    returns: "7.94",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "2",
  },
  {
    asset: "COIN",
    market: "Crypto",
    segment: "Crypto Stocks",
    description: "Coinbase",
    current_price: "189.45",
    average_price: "165.23",
    quantity: "29.87",
    cost: "4938.72",
    value: "5659.33",
    buys: "4938.72",
    sells: "0.00",
    total_return: "720.61",
    returns: "14.59",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "4",
  },
  {
    asset: "HOOD",
    market: "Crypto",
    segment: "Crypto Stocks",
    description: "Robinhood",
    current_price: "28.94",
    average_price: "24.67",
    quantity: "185.43",
    cost: "4578.16",
    value: "5367.34",
    buys: "4578.16",
    sells: "0.00",
    total_return: "789.18",
    returns: "17.24",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "3",
  },
  {
    asset: "AAAU",
    market: "Alternatives",
    segment: "Gold",
    description: "Gold",
    current_price: "19.87",
    average_price: "18.45",
    quantity: "267.89",
    cost: "4942.97",
    value: "5322.99",
    buys: "4942.97",
    sells: "0.00",
    total_return: "380.02",
    returns: "7.69",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "3",
  },
  {
    asset: "VNQ",
    market: "Alternatives",
    segment: "Real Estate",
    description: "Real Estate",
    current_price: "92.31",
    average_price: "87.12",
    quantity: "23.45",
    cost: "2042.96",
    value: "2165.07",
    buys: "2042.96",
    sells: "0.00",
    total_return: "122.11",
    returns: "5.98",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "2",
  },
  {
    asset: "BTC",
    market: "Crypto",
    segment: "Crypto Tokens",
    description: "Bitcoin",
    current_price: "33379.01",
    average_price: "45231.87",
    quantity: "0.85",
    cost: "38447.09",
    value: "28372.66",
    buys: "38447.09",
    sells: "0.00",
    total_return: "-10074.43",
    returns: "-26.20",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "18",
  },
  {
    asset: "ETH",
    market: "Crypto",
    segment: "Crypto Tokens",
    description: "Ethereum",
    current_price: "2687.45",
    average_price: "2289.12",
    quantity: "1.23",
    cost: "2815.62",
    value: "3305.56",
    buys: "2815.62",
    sells: "0.00",
    total_return: "489.94",
    returns: "17.40",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "3",
  },
  {
    asset: "SOL",
    market: "Crypto",
    segment: "Crypto Tokens",
    description: "Solana",
    current_price: "145.67",
    average_price: "118.93",
    quantity: "23.45",
    cost: "2789.12",
    value: "3415.47",
    buys: "2789.12",
    sells: "0.00",
    total_return: "626.35",
    returns: "22.46",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "5",
  },
  {
    // Fully sold position - exercises the collapsible "Closed positions" section
    asset: "GLXY",
    market: "Crypto",
    segment: "Crypto Stocks",
    description: "Galaxy Digital",
    current_price: "24.12",
    average_price: "0",
    quantity: "0",
    cost: "0",
    value: "0",
    buys: "5200.00",
    sells: "3800.00",
    total_return: "-1400.00",
    returns: "-26.92",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "0",
  },
];

// Export positions with dynamically calculated current allocations
export const mockPositions: Asset[] =
  calculateCurrentAllocations(rawMockPositions);

/**
 * Generate realistic performance data with market-like volatility
 * Creates a dataset that ends with the exact total value from positions
 */
const generatePerformanceData = (): PerformanceData[] => {
  const data: PerformanceData[] = [];
  const finalValue = DATA.FINAL_PORTFOLIO_VALUE;
  const finalCost = DATA.FINAL_PORTFOLIO_COST;
  const finalBuys = DATA.FINAL_PORTFOLIO_BUYS;
  const finalSells = DATA.FINAL_PORTFOLIO_SELLS;
  const startValue = DATA.STARTING_PORTFOLIO_VALUE;
  const startCost = DATA.STARTING_PORTFOLIO_VALUE;
  const startBuys = DATA.STARTING_PORTFOLIO_VALUE;
  const startSells = 0;
  const days = DATA.MOCK_DATA_DAYS;
  
  // Generate dates starting 120 days ago
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let dayIndex = 0; dayIndex <= days; dayIndex++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + dayIndex);
    
    const progressRatio = dayIndex / days;
    
    // Create realistic market progression with some volatility
    const baseValueGrowth = startValue + (finalValue - startValue) * progressRatio;
    const baseCostGrowth = startCost + (finalCost - startCost) * progressRatio;
    const baseBuysGrowth = startBuys + (finalBuys - startBuys) * progressRatio;
    const baseSellsGrowth = startSells + (finalSells - startSells) * progressRatio;
    
    // Add realistic market volatility using configurable parameters
    const { VOLATILITY } = CHART;
    const shortTermVolatility = 
      Math.sin(dayIndex * VOLATILITY.SHORT_TERM_MULTIPLIER) * VOLATILITY.SHORT_TERM_AMPLITUDE + 
      Math.sin(dayIndex * VOLATILITY.MEDIUM_TERM_MULTIPLIER) * VOLATILITY.MEDIUM_TERM_AMPLITUDE;
    const randomVolatility = (Math.random() - 0.5) * VOLATILITY.RANDOM_AMPLITUDE;
    const marketCorrectionVolatility = dayIndex > VOLATILITY.CORRECTION_START_DAY && dayIndex < VOLATILITY.CORRECTION_END_DAY 
      ? -VOLATILITY.CORRECTION_AMPLITUDE * Math.sin((dayIndex - VOLATILITY.CORRECTION_START_DAY) / 
        (VOLATILITY.CORRECTION_END_DAY - VOLATILITY.CORRECTION_START_DAY) * Math.PI) 
      : 0;
    
    const adjustedValue = Math.max(
      baseCostGrowth * (DATA.MIN_PORTFOLIO_VALUE_PERCENTAGE / 100),
      baseValueGrowth + shortTermVolatility + randomVolatility + marketCorrectionVolatility
    );
    
    // Ensure the final day matches exactly
    const dailyValue = dayIndex === days ? finalValue : adjustedValue;
    const dailyCost = dayIndex === days ? finalCost : baseCostGrowth;
    const dailyBuys = dayIndex === days ? finalBuys : baseBuysGrowth;
    const dailySells = dayIndex === days ? finalSells : baseSellsGrowth;

    // Total return percent is cash out over cash in: (value + sells - buys) / buys * 100
    const dailyTotalReturn = dailyValue + dailySells - dailyBuys;
    const dailyReturnsPercentage = dailyBuys > 0 ? (dailyTotalReturn / dailyBuys) * 100 : 0;

    data.push({
      date: currentDate.toISOString().split('T')[0],
      cost: dailyCost.toFixed(2),
      value: dailyValue.toFixed(2),
      buys: dailyBuys.toFixed(2),
      sells: dailySells.toFixed(2),
      returns: dailyReturnsPercentage.toFixed(2),
    });
  }
  
  return data;
};

export const mockPerformanceData: PerformanceData[] = generatePerformanceData();

// Fixed, hand-written percent changes per asset and duration for the watch list demo view.
// These are illustrative only and don't need to reconcile with mockPositions' returns.
const mockWatchlistChanges: Record<string, Record<PortfolioDuration, string>> = {
  VT: { '1W': '0.85', '1M': '2.34', YTD: '9.12', '1Y': '15.30', '5Y': '68.40', ALL: '104.58' },
  VOO: { '1W': '1.05', '1M': '2.98', YTD: '11.40', '1Y': '18.20', '5Y': '84.60', ALL: '121.35' },
  VO: { '1W': '0.62', '1M': '1.85', YTD: '7.30', '1Y': '10.53', '5Y': '52.10', ALL: '70.25' },
  VB: { '1W': '0.91', '1M': '2.40', YTD: '8.95', '1Y': '15.00', '5Y': '58.30', ALL: '76.40' },
  VXUS: { '1W': '0.45', '1M': '1.20', YTD: '5.80', '1Y': '9.80', '5Y': '32.10', ALL: '41.75' },
  VWO: { '1W': '0.38', '1M': '0.95', YTD: '4.60', '1Y': '7.94', '5Y': '22.40', ALL: '29.85' },
  COIN: { '1W': '-2.10', '1M': '5.60', YTD: '18.30', '1Y': '14.59', '5Y': '145.20', ALL: '210.50' },
  HOOD: { '1W': '-1.45', '1M': '6.80', YTD: '22.10', '1Y': '17.24', '5Y': '168.90', ALL: '195.40' },
  AAAU: { '1W': '0.28', '1M': '1.10', YTD: '6.40', '1Y': '7.69', '5Y': '45.20', ALL: '58.60' },
  VNQ: { '1W': '0.15', '1M': '0.85', YTD: '3.90', '1Y': '5.98', '5Y': '18.30', ALL: '24.50' },
  BTC: { '1W': '-4.20', '1M': '-8.60', YTD: '-15.40', '1Y': '-26.20', '5Y': '180.40', ALL: '310.60' },
  ETH: { '1W': '-2.85', '1M': '3.40', YTD: '12.60', '1Y': '17.40', '5Y': '95.30', ALL: '142.80' },
  SOL: { '1W': '3.15', '1M': '9.40', YTD: '28.60', '1Y': '22.46', '5Y': '220.10', ALL: '350.90' },
};

// Watch list is every mock position with a non-zero target allocation, mirroring the
// backend's /watchlist filter (assets.yaml entries with target_allocation > 0)
export const mockWatchlist: WatchlistAsset[] = mockPositions
  .filter(position => parseFloat(position.target_allocation) > 0)
  .map(position => ({
    asset: position.asset,
    description: position.description,
    market: position.market,
    current_price: position.current_price,
    changes: mockWatchlistChanges[position.asset],
  }));
