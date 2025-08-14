import { PerformanceData, Asset } from "../data/types";
import { apiService } from "./api";

// Cache configuration
const CACHE_DURATION_MINUTES = 2; // Cache for 2 minutes

// Types for cache management
interface CacheKey {
  granularity: string;
  assetSymbols: string | null; // null for "all assets", stringified array for specific assets
}

interface CacheEntry {
  data: PerformanceData[];
  timestamp: number;
  key: string;
}

interface QueuedRequest {
  cacheKey: CacheKey;
  resolve: (data: PerformanceData[]) => void;
  reject: (error: Error) => void;
  priority: 'high' | 'low'; // high for user-initiated, low for background
  timestamp: number;
}

class PerformanceCacheManager {
  private cache = new Map<string, CacheEntry>();
  private requestQueue: QueuedRequest[] = [];
  private activeRequests = new Set<string>();
  private preloadInProgress = false;

  // Generate cache key from granularity and asset symbols
  private generateCacheKey(granularity: string, assetSymbols?: string[]): string {
    const assetsKey = assetSymbols ? JSON.stringify(assetSymbols.sort()) : 'all';
    return `${granularity}:${assetsKey}`;
  }

  // Check if cache entry is still valid
  private isCacheValid(entry: CacheEntry): boolean {
    const now = Date.now();
    const ageMinutes = (now - entry.timestamp) / (1000 * 60);
    return ageMinutes < CACHE_DURATION_MINUTES;
  }

  // Get cached data if available and valid
  private getCachedData(cacheKey: string): PerformanceData[] | null {
    const entry = this.cache.get(cacheKey);
    if (entry && this.isCacheValid(entry)) {
      console.log(`Cache hit for ${cacheKey}`);
      return entry.data;
    }
    return null;
  }

  // Store data in cache
  private setCachedData(cacheKey: string, data: PerformanceData[]): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      key: cacheKey
    });
    console.log(`Cached data for ${cacheKey}`);
  }

  // Process the request queue with priority handling
  private async processQueue(): Promise<void> {

    // Sort queue by priority (high first) and timestamp (older first)
    this.requestQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority === 'high' ? -1 : 1;
      }
      return a.timestamp - b.timestamp;
    });

    const request = this.requestQueue.shift();
    if (!request) {
      return;
    }

    const cacheKey = this.generateCacheKey(
      request.cacheKey.granularity, 
      request.cacheKey.assetSymbols ? JSON.parse(request.cacheKey.assetSymbols) : undefined
    );

    // Check if we're already fetching this data
    if (this.activeRequests.has(cacheKey)) {
      // Re-queue the request
      this.requestQueue.unshift(request);
      return;
    }

    // Check cache again (might have been populated while in queue)
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      request.resolve(cachedData);
      // Continue processing queue
      setTimeout(() => this.processQueue(), 0);
      return;
    }

    this.activeRequests.add(cacheKey);

    try {
      const assetSymbols = request.cacheKey.assetSymbols ? JSON.parse(request.cacheKey.assetSymbols) : undefined;
      const data = await apiService.getPerformance(request.cacheKey.granularity, assetSymbols);
      
      this.setCachedData(cacheKey, data);
      request.resolve(data);
    } catch (error) {
      console.error(`Failed to fetch performance data for ${cacheKey}:`, error);
      request.reject(error as Error);
    } finally {
      this.activeRequests.delete(cacheKey);
      // Continue processing queue
      setTimeout(() => this.processQueue(), 0);
    }
  }

  // Public method to get performance data with caching
  async getPerformanceData(
    granularity: string, 
    assetSymbols?: string[], 
    priority: 'high' | 'low' = 'high'
  ): Promise<PerformanceData[]> {
    const cacheKey = this.generateCacheKey(granularity, assetSymbols);
    
    // Check cache first
    const cachedData = this.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }

    // If high priority and we have a low priority request for the same data in queue, upgrade it
    if (priority === 'high') {
      const existingRequest = this.requestQueue.find(req => 
        this.generateCacheKey(req.cacheKey.granularity, 
          req.cacheKey.assetSymbols ? JSON.parse(req.cacheKey.assetSymbols) : undefined
        ) === cacheKey
      );
      if (existingRequest) {
        existingRequest.priority = 'high';
      }
    }

    return new Promise<PerformanceData[]>((resolve, reject) => {
      const request: QueuedRequest = {
        cacheKey: {
          granularity,
          assetSymbols: assetSymbols ? JSON.stringify(assetSymbols.sort()) : null
        },
        resolve,
        reject,
        priority,
        timestamp: Date.now()
      };

      this.requestQueue.push(request);
      this.processQueue();
    });
  }

  // Get asset symbols for different market categories
  private getAssetSymbolsByMarket(positions: Asset[]): {
    stocks: string[];
    crypto: string[];
    alternatives: string[];
  } {
    const stocks: string[] = [];
    const crypto: string[] = [];
    const alternatives: string[] = [];

    positions.forEach(asset => {
      switch (asset.market) {
        case 'Stocks':
          stocks.push(asset.asset);
          break;
        case 'Crypto':
          crypto.push(asset.asset);
          break;
        case 'Alternatives':
          alternatives.push(asset.asset);
          break;
      }
    });

    return { stocks, crypto, alternatives };
  }

  // Preload performance data in background
  async preloadPerformanceData(positions: Asset[]): Promise<void> {
    if (this.preloadInProgress) {
      console.log('Preload already in progress, skipping');
      return;
    }

    this.preloadInProgress = true;
    console.log('Starting background preload of performance data');

    const durations = ['1W', '1M', 'YTD', '1Y']; // Skip 'ALL' as it's loaded initially
    const { stocks, crypto, alternatives } = this.getAssetSymbolsByMarket(positions);

    const preloadTasks: Array<{ granularity: string; assets?: string[] }> = [];

    // Add remaining durations for all assets
    durations.forEach(duration => {
      preloadTasks.push({ granularity: duration });
    });

    // Add all durations for each market category
    durations.forEach(duration => {
      if (stocks.length > 0) {
        preloadTasks.push({ granularity: duration, assets: stocks });
      }
      if (crypto.length > 0) {
        preloadTasks.push({ granularity: duration, assets: crypto });
      }
      if (alternatives.length > 0) {
        preloadTasks.push({ granularity: duration, assets: alternatives });
      }
    });

    // Add current duration for all categories (ALL for each market)
    if (stocks.length > 0) {
      preloadTasks.push({ granularity: 'ALL', assets: stocks });
    }
    if (crypto.length > 0) {
      preloadTasks.push({ granularity: 'ALL', assets: crypto });
    }
    if (alternatives.length > 0) {
      preloadTasks.push({ granularity: 'ALL', assets: alternatives });
    }

    // Queue all preload tasks with low priority
    const preloadPromises = preloadTasks.map(task => 
      this.getPerformanceData(task.granularity, task.assets, 'low')
        .catch(error => {
          console.log(`Background preload failed for ${task.granularity}:`, error);
          // Don't throw - we don't want to fail the entire preload
        })
    );

    try {
      await Promise.allSettled(preloadPromises);
      console.log('Background preload completed');
    } catch (error) {
      console.error('Error during background preload:', error);
    } finally {
      this.preloadInProgress = false;
    }
  }

  // Clear cache (useful for debugging or forced refresh)
  clearCache(): void {
    this.cache.clear();
    console.log('Performance cache cleared');
  }

  // Get cache stats for debugging
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    activeRequests: number;
    queuedRequests: number;
  } {
    const totalEntries = this.cache.size;
    const validEntries = Array.from(this.cache.values()).filter(entry => this.isCacheValid(entry)).length;

    return {
      totalEntries,
      validEntries,
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length
    };
  }
}

// Export singleton instance
export const performanceCacheManager = new PerformanceCacheManager();