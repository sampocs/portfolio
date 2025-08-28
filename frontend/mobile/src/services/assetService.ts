import { 
  AssetPriceData, 
  AssetTradeData, 
  AssetDuration, 
  ProcessedPriceData, 
  AssetHoldings, 
  AssetPriceChange 
} from '../data/assetTypes';
import { getAssetDetailData } from '../data/mockAssetData';
import { DataMode } from '../contexts/DataContext';
import { apiService } from './api';

export class AssetService {
  /**
   * Fetch real asset price data from API
   */
  private static async fetchAssetPriceData(symbol: string): Promise<AssetPriceData> {
    return await apiService.getAssetPrices(symbol);
  }

  /**
   * Fetch real asset trade data from API
   */
  private static async fetchAssetTradeData(symbol: string): Promise<AssetTradeData> {
    const trades = await apiService.getAssetTrades(symbol);
    return { trades };
  }
  /**
   * Get processed price data for a specific duration
   */
  static processPriceDataForDuration(
    priceData: AssetPriceData,
    duration: AssetDuration
  ): ProcessedPriceData[] {
    const { live_price, historical_prices } = priceData;
    const currentDate = new Date();
    const currentPrice = parseFloat(live_price);

    let filteredHistory: ProcessedPriceData[] = [];

    switch (duration) {
      case '1D':
        // For 1D, just show yesterday's close and today's live price
        if (historical_prices.length > 0) {
          const lastHistoricalPrice = historical_prices[historical_prices.length - 1];
          filteredHistory = [{
            date: lastHistoricalPrice.date,
            price: parseFloat(lastHistoricalPrice.price)
          }];
        }
        break;

      case '1W':
        filteredHistory = this.getHistoryForDays(historical_prices, 7);
        break;

      case '1M':
        filteredHistory = this.getHistoryForDays(historical_prices, 30);
        break;

      case 'YTD':
        filteredHistory = this.getHistoryFromYearStart(historical_prices, currentDate);
        break;

      case '1Y':
        filteredHistory = this.getHistoryForDays(historical_prices, 365);
        break;

      case '5Y':
        filteredHistory = this.getHistoryForDays(historical_prices, 1825); // 5 years = 5 * 365 = 1825 days
        break;

      default:
        filteredHistory = historical_prices.map(item => ({
          date: item.date,
          price: parseFloat(item.price)
        }));
    }

    // Append current live price as the latest data point
    const todayString = currentDate.toISOString().split('T')[0];
    filteredHistory.push({
      date: todayString,
      price: currentPrice
    });

    return filteredHistory;
  }

  /**
   * Calculate price change for a specific duration
   */
  static calculatePriceChange(
    priceData: AssetPriceData,
    duration: AssetDuration
  ): AssetPriceChange {
    const processedData = this.processPriceDataForDuration(priceData, duration);
    const currentPrice = parseFloat(priceData.live_price);

    if (processedData.length < 2) {
      return {
        currentPrice,
        previousPrice: currentPrice,
        changeAmount: 0,
        changePercent: 0,
        isPositive: true
      };
    }

    const previousPrice = processedData[0].price;
    const changeAmount = currentPrice - previousPrice;
    const changePercent = previousPrice > 0 ? (changeAmount / previousPrice) * 100 : 0;

    return {
      currentPrice,
      previousPrice,
      changeAmount,
      changePercent,
      isPositive: changeAmount >= 0
    };
  }

  /**
   * Calculate holdings summary from trade data with net invested approach
   */
  static calculateHoldings(
    tradeData: AssetTradeData,
    currentPrice: number
  ): AssetHoldings {
    let totalBuys = 0;           // Total money spent on buys
    let totalSellProceeds = 0;   // Total money received from sells
    let totalQuantity = 0;       // Current quantity held
    let costBasisRemaining = 0;  // Cost basis of current holdings
    let realizedGains = 0;       // Gains/losses from completed sells

    tradeData.trades.forEach(trade => {
      const quantity = trade.quantity;
      const price = trade.price;
      const tradeValue = quantity * price;

      if (trade.action === 'BUY') {
        totalBuys += tradeValue;
        totalQuantity += quantity;
        costBasisRemaining += tradeValue;
      } else if (trade.action === 'SELL') {
        totalSellProceeds += tradeValue;
        
        // Calculate realized gains from this sell
        const averageCostPerShare = totalQuantity > 0 ? costBasisRemaining / totalQuantity : 0;
        const soldCostBasis = averageCostPerShare * quantity;
        realizedGains += (tradeValue - soldCostBasis);
        
        // Update remaining holdings
        totalQuantity -= quantity;
        costBasisRemaining -= soldCostBasis;
      }
    });

    // Net invested = money in - money out (can be negative)
    const netInvested = totalBuys - totalSellProceeds;
    
    // Current market value
    const currentValue = totalQuantity * currentPrice;
    
    // Unrealized gains = current value - remaining cost basis
    const unrealizedGains = currentValue - costBasisRemaining;
    
    // Total return = realized + unrealized gains
    const totalReturn = realizedGains + unrealizedGains;
    
    // Calculate percentage based on absolute net invested (avoid division by zero/negative)
    const absNetInvested = Math.abs(netInvested);
    const totalReturnPercent = absNetInvested > 0 ? (totalReturn / absNetInvested) * 100 : 0;
    
    // Average price of current holdings
    const averagePrice = totalQuantity > 0 ? costBasisRemaining / totalQuantity : 0;

    return {
      netInvested,
      currentValue,
      totalReturn,
      totalReturnPercent,
      realizedGains,
      unrealizedGains,
      totalQuantity,
      averagePrice
    };
  }

  /**
   * Get asset detail data with all calculations
   */
  static async getAssetDetails(symbol: string, duration: AssetDuration = '1Y', dataMode: DataMode = 'demo') {
    let data;
    let updatedAt;
    
    if (dataMode === 'demo') {
      // Use mock data for demo mode
      data = await getAssetDetailData(symbol);
      updatedAt = new Date().toISOString();
    } else {
      // Use real API data for live mode
      const [priceData, tradeData] = await Promise.all([
        this.fetchAssetPriceData(symbol),
        this.fetchAssetTradeData(symbol)
      ]);
      
      data = {
        symbol,
        priceData,
        tradeData
      };
      updatedAt = priceData.updated_at || new Date().toISOString();
    }
    
    const currentPrice = parseFloat(data.priceData.live_price);
    
    return {
      ...data,
      processedPriceData: this.processPriceDataForDuration(data.priceData, duration),
      priceChange: this.calculatePriceChange(data.priceData, duration),
      holdings: this.calculateHoldings(data.tradeData, currentPrice),
      updatedAt
    };
  }

  // Helper methods
  private static getHistoryForDays(history: any[], days: number): ProcessedPriceData[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return history
      .filter(item => new Date(item.date) >= cutoffDate)
      .map(item => ({
        date: item.date,
        price: parseFloat(item.price)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private static getHistoryFromYearStart(history: any[], currentDate: Date): ProcessedPriceData[] {
    const yearStart = new Date(currentDate.getFullYear(), 0, 1);
    
    return history
      .filter(item => new Date(item.date) >= yearStart)
      .map(item => ({
        date: item.date,
        price: parseFloat(item.price)
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
}