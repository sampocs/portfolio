import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import CategorySelector from '../components/CategorySelector';
import Summary from '../components/Summary';
import TotalWorthChart, { ChartDurationSelector } from '../components/TotalWorthChart';
import AssetList from '../components/AssetList';
import LoadingScreen from '../components/LoadingScreen';
import { apiService } from '../services/api';
import { calculatePortfolioSummary } from '../data/utils';
import { Asset, PerformanceData } from '../data/types';

// Format date from YYYY-MM-DD to "Aug 7, 2025"
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric', 
    year: 'numeric' 
  });
};

export default function PortfolioScreen() {
  const [selectedCategories, setSelectedCategories] = useState({
    stocks: true,
    crypto: true,
    alternatives: true,
  });

  // State for chart interaction
  const [selectedDataPoint, setSelectedDataPoint] = useState<PerformanceData | null>(null);

  // API data state
  const [positions, setPositions] = useState<Asset[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGranularity, setSelectedGranularity] = useState('ALL');
  const [isChartLoading, setIsChartLoading] = useState(false);

  const handleCategoryToggle = async (category: 'stocks' | 'crypto' | 'alternatives') => {
    const newCategories = {
      ...selectedCategories,
      [category]: !selectedCategories[category],
    };
    
    setSelectedCategories(newCategories);
    setIsChartLoading(true);
    
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
    
    try {
      const performanceDataResponse = await apiService.getPerformance(selectedGranularity, assetSymbols);
      setPerformanceData(performanceDataResponse);
    } catch (error) {
      console.error('Error fetching filtered performance data:', error);
    } finally {
      setIsChartLoading(false);
    }
  };

  const handleDataPointSelected = (dataPoint: PerformanceData | null) => {
    setSelectedDataPoint(dataPoint);
  };

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

  // Data fetching functions
  const fetchData = async (granularity: string = selectedGranularity, forceRefreshPositions: boolean = false) => {
    try {
      let positionsData = positions;
      
      // Only fetch positions if we don't have them or if forced
      if (positions.length === 0 || forceRefreshPositions) {
        positionsData = await apiService.getPositions();
        setPositions(positionsData);
      }
      
      // Get filtered asset symbols for performance query
      const assetSymbols = getFilteredAssetSymbols(positionsData);
      
      const performanceDataResponse = await apiService.getPerformance(granularity, assetSymbols);
      setPerformanceData(performanceDataResponse);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Handle error - could show toast or error state
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData(selectedGranularity, true); // Force refresh positions
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleGranularityChange = async (granularity: string) => {
    setSelectedGranularity(granularity);
    setIsChartLoading(true);
    try {
      await fetchData(granularity);
    } finally {
      setIsChartLoading(false);
    }
  };

  // Initial data load
  useEffect(() => {
    const loadInitialData = async () => {
      setIsLoading(true);
      try {
        await fetchData();
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialData();
  }, []);


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

  if (isLoading) {
    return <LoadingScreen title="Portfolio" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Portfolio</Text>
      </View>
      <ScrollView 
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.foreground]}
            tintColor={theme.colors.foreground}
            progressBackgroundColor={theme.colors.card}
          />
        }
      >
        <CategorySelector
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
        />
        <Summary
          totalValue={summaryData.totalValue}
          totalReturn={summaryData.totalReturn}
          totalReturnPercent={summaryData.totalReturnPercent}
          selectedDate={summaryData.selectedDate}
        />
        <TotalWorthChart
          data={performanceData}
          onDataPointSelected={handleDataPointSelected}
          isLoading={isChartLoading}
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