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
          // Sort to ensure we get the most recent historical price first
          const sortedPrices = [...historical_prices].sort((a, b) => 
            new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const mostRecentHistoricalPrice = sortedPrices[0];
          filteredHistory = [{
            date: mostRecentHistoricalPrice.date,
            price: parseFloat(mostRecentHistoricalPrice.price)
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
   * Calculate holdings summary from trade data using FIFO accounting method
   */
  static calculateHoldings(
    tradeData: AssetTradeData,
    currentPrice: number
  ): AssetHoldings {
    let totalBuys = 0;           // Total real cash spent on buys (trade.cost, net of fees)
    let totalSellProceeds = 0;   // Total real cash received from sells (trade.cost, net of fees)
    let realizedGains = 0;       // Gains/losses from completed sells
    let lastSellDate: string | null = null; // Date of the latest SELL trade, or null if none

    // FIFO method - maintain a queue of buy lots. Cost basis comes from the
    // trade's real cash cost (not quantity * price), so a lot's per-unit
    // price is cost / quantity - this lets a partial sell consume basis
    // proportionally to the quantity sold.
    interface BuyLot {
      quantity: number;
      price: number;
      costBasis: number;
    }

    let buyLots: BuyLot[] = [];

    // FIFO only works chronologically; never trust the API's row order. Same-day
    // buys go before sells (so a rebuy can't fund the sale that paid for it) and
    // remaining ties break on id, matching the backend lot matcher.
    const sortedTrades = [...tradeData.trades].sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
      || (a.action === 'BUY' ? 0 : 1) - (b.action === 'BUY' ? 0 : 1)
      || a.id.localeCompare(b.id)
    );

    sortedTrades.forEach(trade => {
      const quantity = trade.quantity;
      const cost = trade.cost;

      if (trade.action === 'BUY') {
        totalBuys += cost;
        buyLots.push({ quantity, price: cost / quantity, costBasis: cost });
      } else if (trade.action === 'SELL') {
        totalSellProceeds += cost;
        lastSellDate = trade.date; // sortedTrades is chronological, so the last SELL seen is the latest

        let remainingToSell = quantity;
        let sellProceeds = cost;
        let totalSoldCostBasis = 0;

        // Sell from oldest lots first (FIFO)
        while (remainingToSell > 0 && buyLots.length > 0) {
          const lot = buyLots[0];
          const sellFromLot = Math.min(remainingToSell, lot.quantity);
          const costBasisFromLot = sellFromLot * lot.price;

          totalSoldCostBasis += costBasisFromLot;
          remainingToSell -= sellFromLot;
          lot.quantity -= sellFromLot;
          lot.costBasis -= costBasisFromLot;

          // Remove empty lot
          if (lot.quantity <= 0) {
            buyLots.shift();
          }
        }

        // Calculate realized gain for this sell transaction
        const tradeRealizedGain = sellProceeds - totalSoldCostBasis;
        realizedGains += tradeRealizedGain;
      }
    });

    // Calculate remaining holdings from remaining lots
    let totalQuantity = 0;
    let totalCostBasisRemaining = 0;

    buyLots.forEach(lot => {
      totalQuantity += lot.quantity;
      totalCostBasisRemaining += lot.costBasis;
    });

    // Current market value
    const currentValue = totalQuantity * currentPrice;

    // Unrealized gains = current value - remaining cost basis
    const unrealizedGains = currentValue - totalCostBasisRemaining;

    // Total return = "if I liquidated everything right now, what did I make
    // across all my trades" = cash out (current value + sell proceeds) over
    // cash in (buys). Realized and unrealized gains, computed above from the
    // FIFO cost basis, sum exactly to this.
    const totalReturn = currentValue + totalSellProceeds - totalBuys;

    // Percentage is total return over total cash invested (0 when nothing was invested).
    const totalReturnPercent = totalBuys > 0 ? (totalReturn / totalBuys) * 100 : 0;

    // Average price of current holdings (weighted by quantity)
    const averagePrice = totalQuantity > 0 ? totalCostBasisRemaining / totalQuantity : 0;

    // Cash still at risk: what's been put in minus what's been taken out.
    const netInvested = totalBuys - totalSellProceeds;

    return {
      owned: totalQuantity,
      averagePrice,
      costBasis: totalCostBasisRemaining,
      marketValue: currentValue,
      unrealized: unrealizedGains,
      invested: totalBuys,
      sold: totalSellProceeds,
      netInvested,
      realized: realizedGains,
      totalReturn,
      totalReturnPercent,
      tradeCount: sortedTrades.length,
      lastSellDate
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