import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { TIMING, UI } from '../constants';
import AssetCategorySelector from '../components/AssetCategorySelector';
import PortfolioSummary from '../components/PortfolioSummary';
import TotalWorthChart, { ChartDurationSelector } from '../components/TotalWorthChart';
import AssetList from '../components/AssetList';
import SkeletonLoadingScreen from '../components/SkeletonLoadingScreen';
import DataModeModal from '../components/DataModeModal';
import WelcomeScreen from './WelcomeScreen';
import { useData } from '../contexts/DataContext';
import { performanceCacheManager } from '../services/performanceCache';
import { calculatePortfolioSummary } from '../data/utils';
import { Asset, PerformanceData } from '../data/types';
import { mockPerformanceData } from '../data/mockData';

/**
 * Format date from YYYY-MM-DD to readable format
 */
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

/**
 * PortfolioScreen - Main portfolio view showing assets, performance, and controls
 * 
 * Displays user's portfolio summary, performance chart, and asset list.
 * Includes hidden long-press functionality to switch between live and demo data modes.
 */
export default function PortfolioScreen() {
  const [selectedCategories, setSelectedCategories] = useState({
    stocks: true,
    crypto: true,
    alternatives: true,
  });

  // State for chart interaction
  const [selectedDataPoint, setSelectedDataPoint] = useState<PerformanceData | null>(null);
  
  // State for modal
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);
  const [showWelcomeScreen, setShowWelcomeScreen] = useState(false);

  // Use shared positions data from context
  const { positions, isLoading: positionsLoading, isRefreshing: positionsRefreshing, refreshData, dataMode, switchToDemo, switchToLive, setAuthenticated, isAuthenticated } = useData();

  // Local state for performance data and chart-specific loading
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [selectedGranularity, setSelectedGranularity] = useState('ALL');
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [isDataCached, setIsDataCached] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const handleCategoryToggle = async (category: 'stocks' | 'crypto' | 'alternatives') => {
    const newCategories = {
      ...selectedCategories,
      [category]: !selectedCategories[category],
    };
    
    setSelectedCategories(newCategories);
    
    // Clear selected data point when categories change
    setSelectedDataPoint(null);
    
    // Refetch performance data with new category filter
    // We need to manually calculate the filtered assets for the new selection
    const filtered = positions.filter(asset => {
      const isStocksMarket = asset.market === 'Stocks';
      const isCryptoMarket = asset.market === 'Crypto';
      const isAlternativesMarket = asset.market === 'Alternatives';
      
      const showStocks = newCategories.stocks && isStocksMarket;
      const showCrypto = newCategories.crypto && isCryptoMarket;
      const showAlternatives = newCategories.alternatives && isAlternativesMarket;
      
      return showStocks || showCrypto || showAlternatives;
    });
    
    const assetSymbols = newCategories.stocks && newCategories.crypto && newCategories.alternatives 
      ? undefined 
      : filtered.map(asset => asset.asset);
    
    // Check if data is cached
    const isCached = performanceCacheManager.isCacheAvailable(selectedGranularity, assetSymbols);
    setIsDataCached(isCached);
    
    // Only show loading state if data is not cached
    if (!isCached) {
      setIsChartLoading(true);
    }
    
    try {
      const startTime = Date.now();
      await fetchPerformanceData(selectedGranularity, true);
      const fetchTime = Date.now() - startTime;
      
      // Add minimal delay for smooth transition if cached
      if (isCached && fetchTime < 50) {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } catch (error) {
      console.error('Error fetching filtered performance data:', error);
    } finally {
      setIsChartLoading(false);
    }
  };

  const handleDataPointSelected = (dataPoint: PerformanceData | null) => {
    setSelectedDataPoint(dataPoint);
  };

  /**
   * Handle long press gesture start - triggers data mode modal after delay
   */
  const handleHeaderPressIn = () => {
    const timer = setTimeout(() => {
      setIsModalVisible(true);
    }, TIMING.LONG_PRESS_DURATION);
    setLongPressTimer(timer);
  };

  /**
   * Handle long press gesture end - cancels timer if released early
   */
  const handleHeaderPressOut = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  // Modal handlers
  const handleModalConfirm = async () => {
    setIsModalVisible(false);
    
    // Bidirectional switching
    if (dataMode === 'live') {
      switchToDemo();
    } else {
      // Try to switch to live mode
      const result = await switchToLive();
      if (!result.success && result.needsAuth) {
        // User needs to authenticate - show welcome screen
        setShowWelcomeScreen(true);
      }
    }
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
  };

  // Welcome screen handlers (for re-authentication)
  const handleAuthenticationSuccess = async () => {
    setShowWelcomeScreen(false);
    await setAuthenticated(true);
  };

  const handleWelcomeDemoMode = () => {
    setShowWelcomeScreen(false);
    // Already in demo mode, so just stay there
  };

  const handleSyncPress = () => {
    // TODO: Implement sync functionality
    console.log('Sync button pressed');
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
      }
    };
  }, [longPressTimer]);

  // Get filtered asset symbols based on selected categories
  const getFilteredAssetSymbols = (positions: Asset[]): string[] | undefined => {
    // If all categories are selected, don't filter (get all assets)
    if (selectedCategories.stocks && selectedCategories.crypto && selectedCategories.alternatives) {
      return undefined;
    }
    
    const filtered = positions.filter(asset => {
      const isStocksMarket = asset.market === 'Stocks';
      const isCryptoMarket = asset.market === 'Crypto';
      const isAlternativesMarket = asset.market === 'Alternatives';
      
      const showStocks = selectedCategories.stocks && isStocksMarket;
      const showCrypto = selectedCategories.crypto && isCryptoMarket;
      const showAlternatives = selectedCategories.alternatives && isAlternativesMarket;
      
      return showStocks || showCrypto || showAlternatives;
    });
    
    return filtered.map(asset => asset.asset);
  };

  // Performance data fetching function (positions now come from context)
  const fetchPerformanceData = async (granularity: string = selectedGranularity, isUserInitiated: boolean = true) => {
    try {
      if (dataMode === 'demo') {
        // Use mock data instantly when in demo mode
        setPerformanceData(mockPerformanceData);
        return;
      }
      
      // Get filtered asset symbols for performance query (live mode)
      const assetSymbols = getFilteredAssetSymbols(positions);
      
      // Use cache manager with priority based on whether it's user-initiated
      const priority = isUserInitiated ? 'high' : 'low';
      const performanceDataResponse = await performanceCacheManager.getPerformanceData(granularity, assetSymbols, priority);
      setPerformanceData(performanceDataResponse);
    } catch (error) {
      console.error('Error fetching performance data:', error);
      // Handle error - could show toast or error state
    }
  };

  const handleRefresh = async () => {
    try {
      // Only refresh in live mode and when authenticated
      if (dataMode === 'live' && isAuthenticated) {
        await Promise.all([
          refreshData(), // This refreshes positions
          fetchPerformanceData(selectedGranularity, true) // This refreshes performance data
        ]);
      } else {
        // In demo mode, just refresh the performance data (which uses mock data)
        await fetchPerformanceData(selectedGranularity, true);
      }
    } catch (error) {
      console.error('Error refreshing data:', error);
    }
  };

  const handleGranularityChange = async (granularity: string) => {
    setSelectedGranularity(granularity);
    
    // Check if data is immediately available from cache
    const assetSymbols = getFilteredAssetSymbols(positions);
    const isCached = performanceCacheManager.isCacheAvailable(granularity, assetSymbols);
    setIsDataCached(isCached);
    
    // Only show loading state if data is not cached
    if (!isCached) {
      setIsChartLoading(true);
    }
    
    try {
      const startTime = Date.now();
      await fetchPerformanceData(granularity);
      const fetchTime = Date.now() - startTime;
      
      // If fetch was very fast (cached), add minimal delay for smooth visual transition
      if (isCached && fetchTime < 50) {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    } finally {
      setIsChartLoading(false);
    }
  };

  // Initial performance data load when positions are available
  useEffect(() => {
    const loadPerformanceData = async () => {
      if (positions.length > 0 && isInitialLoad) {
        try {
          // Start background preloading after positions are loaded (only in live mode AND authenticated)
          if (dataMode === 'live' && isAuthenticated) {
            performanceCacheManager.preloadPerformanceData(positions);
          }
          
          // Fetch initial performance data
          await fetchPerformanceData();
        } catch (error) {
          console.error('Error loading initial performance data:', error);
        } finally {
          setIsInitialLoad(false);
        }
      }
    };

    loadPerformanceData();
  }, [positions, isInitialLoad, dataMode, isAuthenticated]);

  // React to data mode changes - instantly switch performance data
  useEffect(() => {
    if (positions.length > 0) {
      fetchPerformanceData(selectedGranularity, true);
    }
  }, [dataMode]);


  // Filter assets based on selected categories (same logic as AssetList)
  const filteredPositions = positions.filter(asset => {
    const isStocksMarket = asset.market === 'Stocks';
    const isCryptoMarket = asset.market === 'Crypto';
    const isAlternativesMarket = asset.market === 'Alternatives';
    
    const showStocks = selectedCategories.stocks && isStocksMarket;
    const showCrypto = selectedCategories.crypto && isCryptoMarket;
    const showAlternatives = selectedCategories.alternatives && isAlternativesMarket;
    
    return showStocks || showCrypto || showAlternatives;
  });

  // Calculate portfolio summary from filtered API data
  const portfolioSummary = calculatePortfolioSummary(filteredPositions);

  // Get summary data - use selected data point if available, otherwise use current totals
  const summaryData = selectedDataPoint ? {
    totalValue: parseFloat(selectedDataPoint.value),
    totalReturn: parseFloat(selectedDataPoint.value) - parseFloat(selectedDataPoint.cost),
    totalReturnPercent: parseFloat(selectedDataPoint.returns),
    selectedDate: formatDate(selectedDataPoint.date),
  } : {
    totalValue: portfolioSummary.totalValue,
    totalReturn: portfolioSummary.totalReturn,
    totalReturnPercent: portfolioSummary.totalReturnPercent,
    selectedDate: undefined,
  };

  if (positionsLoading) {
    return <SkeletonLoadingScreen title="Portfolio" />;
  }

  // Show welcome screen for re-authentication if needed
  if (showWelcomeScreen) {
    return (
      <WelcomeScreen
        onAuthenticationSuccess={handleAuthenticationSuccess}
        onDemoMode={handleWelcomeDemoMode}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TouchableOpacity
        style={styles.header}
        activeOpacity={UI.TOUCHABLE_OPACITY_ACTIVE}
        onPressIn={handleHeaderPressIn}
        onPressOut={handleHeaderPressOut}
      >
        <Text style={styles.headerText}>Portfolio</Text>
      </TouchableOpacity>
      <ScrollView 
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={positionsRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.foreground]}
            tintColor={theme.colors.foreground}
            progressBackgroundColor={theme.colors.card}
          />
        }
      >
        <AssetCategorySelector
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
          onSyncPress={handleSyncPress}
        />
        <PortfolioSummary
          totalValue={summaryData.totalValue}
          totalReturn={summaryData.totalReturn}
          totalReturnPercent={summaryData.totalReturnPercent}
          selectedDate={summaryData.selectedDate}
        />
        <TotalWorthChart
          data={performanceData}
          onDataPointSelected={handleDataPointSelected}
          isLoading={isChartLoading}
          isCached={isDataCached}
        />
        {/* Duration Selector - In ScrollView but with isolation wrapper */}
        <View style={{ zIndex: 999, elevation: 999 }}>
          <ChartDurationSelector
            onGranularityChange={handleGranularityChange}
          />
        </View>
        <AssetList
          assets={positions}
          selectedCategories={selectedCategories}
        />
      </ScrollView>
      
      <DataModeModal
        visible={isModalVisible}
        currentMode={dataMode}
        onConfirm={handleModalConfirm}
        onCancel={handleModalCancel}
      />
    </SafeAreaView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  headerText: {
    color: theme.colors.foreground,
    ...getTextStyle('xxl', 'bold'),
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: 20,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    marginTop: theme.spacing.md,
  },
});