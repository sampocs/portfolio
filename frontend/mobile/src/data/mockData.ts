import { Asset, PerformanceData } from "./types";
import { calculateCurrentAllocations } from "./utils";

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
    returns: "104.62",
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
    returns: "22.46",
    current_allocation: "0", // Will be calculated dynamically
    target_allocation: "5",
  },
];

// Export positions with dynamically calculated current allocations
export const mockPositions: Asset[] =
  calculateCurrentAllocations(rawMockPositions);

// Generate 120 days of performance data ending at the correct total value (139,652.52)
const generatePerformanceData = (): PerformanceData[] => {
  const data: PerformanceData[] = [];
  const finalValue = 139652.52;
  const finalCost = 118296.62;
  const startValue = 95000; // Starting portfolio value
  const startCost = 95000; // Starting cost basis
  const days = 120;
  
  // Generate dates starting 120 days ago
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  for (let i = 0; i <= days; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const progress = i / days;
    
    // Create realistic market progression with some volatility
    const baseValueGrowth = startValue + (finalValue - startValue) * progress;
    const baseCostGrowth = startCost + (finalCost - startCost) * progress;
    
    // Add some realistic market volatility (sinusoidal waves + random)
    const shortTermVolatility = Math.sin(i * 0.2) * 2000 + Math.sin(i * 0.05) * 5000;
    const randomVolatility = (Math.random() - 0.5) * 3000;
    const marketCorrection = i > 60 && i < 80 ? -8000 * Math.sin((i - 60) / 20 * Math.PI) : 0;
    
    const adjustedValue = Math.max(
      baseCostGrowth * 0.85, // Never go below 85% of cost basis
      baseValueGrowth + shortTermVolatility + randomVolatility + marketCorrection
    );
    
    // Ensure the final day matches exactly
    const value = i === days ? finalValue : adjustedValue;
    const cost = i === days ? finalCost : baseCostGrowth;
    
    const returns = ((value - cost) / cost * 100);
    
    data.push({
      date: currentDate.toISOString().split('T')[0],
      cost: cost.toFixed(2),
      value: value.toFixed(2),
      returns: returns.toFixed(2),
    });
  }
  
  return data;
};

export const mockPerformanceData: PerformanceData[] = generatePerformanceData();
