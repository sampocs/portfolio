import { 
  AssetPriceData, 
  AssetTradeData, 
  AssetDuration, 
  ProcessedPriceData, 
  AssetHoldings, 
  AssetPriceChange 
} from '../data/assetTypes';
import { getAssetDetailData } from '../data/mockAssetData';

export class AssetService {
  /**
   * Get processed price data for a specific duration
   */
  static processPriceDataForDuration(
    priceData: AssetPriceData,
    duration: AssetDuration
  ): ProcessedPriceData[] {
    const { live_price, price_history } = priceData;
    const currentDate = new Date();
    const currentPrice = parseFloat(live_price);

    let filteredHistory: ProcessedPriceData[] = [];

    switch (duration) {
      case '1D':
        // For 1D, just show yesterday's close and today's live price
        if (price_history.length > 0) {
          const lastHistoricalPrice = price_history[price_history.length - 1];
          filteredHistory = [{
            date: lastHistoricalPrice.date,
            price: parseFloat(lastHistoricalPrice.price)
          }];
        }
        break;

      case '1W':
        filteredHistory = this.getHistoryForDays(price_history, 7);
        break;

      case '1M':
        filteredHistory = this.getHistoryForDays(price_history, 30);
        break;

      case 'YTD':
        filteredHistory = this.getHistoryFromYearStart(price_history, currentDate);
        break;

      case '1Y':
        filteredHistory = this.getHistoryForDays(price_history, 365);
        break;

      default:
        filteredHistory = price_history.map(item => ({
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
   * Calculate holdings summary from trade data
   */
  static calculateHoldings(
    tradeData: AssetTradeData,
    currentPrice: number
  ): AssetHoldings {
    let totalInvested = 0;
    let totalQuantity = 0;
    let totalCost = 0;

    tradeData.trades.forEach(trade => {
      const quantity = parseFloat(trade.quantity);
      const price = parseFloat(trade.price);
      const tradeValue = quantity * price;

      if (trade.action === 'BUY') {
        totalInvested += tradeValue;
        totalQuantity += quantity;
        totalCost += tradeValue;
      } else if (trade.action === 'SELL') {
        // For sells, reduce quantity but don't reduce total invested
        // This represents realized gains/losses
        totalQuantity -= quantity;
        const averageCostPerShare = totalCost / (totalQuantity + quantity);
        totalCost -= averageCostPerShare * quantity;
      }
    });

    const currentValue = totalQuantity * currentPrice;
    const totalReturn = currentValue - totalCost;
    const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;
    const averagePrice = totalQuantity > 0 ? totalCost / totalQuantity : 0;

    return {
      totalInvested,
      currentValue,
      totalReturn,
      totalReturnPercent,
      totalQuantity,
      averagePrice
    };
  }

  /**
   * Get asset detail data with all calculations
   */
  static async getAssetDetails(symbol: string, duration: AssetDuration = '1Y') {
    const data = await getAssetDetailData(symbol);
    const currentPrice = parseFloat(data.priceData.live_price);
    
    return {
      ...data,
      processedPriceData: this.processPriceDataForDuration(data.priceData, duration),
      priceChange: this.calculatePriceChange(data.priceData, duration),
      holdings: this.calculateHoldings(data.tradeData, currentPrice)
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