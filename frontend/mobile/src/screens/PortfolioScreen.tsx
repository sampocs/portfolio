import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import CategorySelector from '../components/CategorySelector';
import Summary from '../components/Summary';
import TotalWorthChart from '../components/TotalWorthChart';
import AssetList from '../components/AssetList';
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
  });

  // State for chart interaction
  const [selectedDataPoint, setSelectedDataPoint] = useState<PerformanceData | null>(null);

  // API data state
  const [positions, setPositions] = useState<Asset[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGranularity, setSelectedGranularity] = useState('ALL');

  const handleCategoryToggle = async (category: 'stocks' | 'crypto') => {
    const newCategories = {
      ...selectedCategories,
      [category]: !selectedCategories[category],
    };
    
    setSelectedCategories(newCategories);
    
    // Refetch performance data with new category filter
    // We need to manually calculate the filtered assets for the new selection
    const filtered = positions.filter(asset => {
      const isStockCategory = asset.category.includes('Stock') || 
                             asset.category.includes('Gold') || 
                             asset.category.includes('Real Estate');
      const isCryptoCategory = asset.category.includes('Crypto');
      
      if (newCategories.stocks && newCategories.crypto) {
        return true; // All assets
      } else if (newCategories.stocks && !newCategories.crypto) {
        return isStockCategory;
      } else if (!newCategories.stocks && newCategories.crypto) {
        return isCryptoCategory;
      }
      return false; // Neither selected
    });
    
    const assetSymbols = newCategories.stocks && newCategories.crypto 
      ? undefined 
      : filtered.map(asset => asset.asset);
    
    try {
      const performanceDataResponse = await apiService.getPerformance(selectedGranularity, assetSymbols);
      setPerformanceData(performanceDataResponse);
    } catch (error) {
      console.error('Error fetching filtered performance data:', error);
    }
  };

  const handleDataPointSelected = (dataPoint: PerformanceData | null) => {
    setSelectedDataPoint(dataPoint);
  };

  // Get filtered asset symbols based on selected categories
  const getFilteredAssetSymbols = (positions: Asset[]): string[] | undefined => {
    // If both categories are selected, don't filter (get all assets)
    if (selectedCategories.stocks && selectedCategories.crypto) {
      return undefined;
    }
    
    const filtered = positions.filter(asset => {
      const isStockCategory = asset.category.includes('Stock') || 
                             asset.category.includes('Gold') || 
                             asset.category.includes('Real Estate');
      const isCryptoCategory = asset.category.includes('Crypto');
      
      if (selectedCategories.stocks && !selectedCategories.crypto) {
        return isStockCategory;
      } else if (!selectedCategories.stocks && selectedCategories.crypto) {
        return isCryptoCategory;
      }
      return false; // Neither selected
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
    await fetchData(granularity);
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

  const getDisplayText = () => {
    if (selectedCategories.stocks && selectedCategories.crypto) {
      return 'Showing All Categories';
    } else if (selectedCategories.stocks) {
      return 'Showing Stocks';
    } else if (selectedCategories.crypto) {
      return 'Showing Crypto';
    } else {
      return 'No Categories Selected';
    }
  };

  // Filter assets based on selected categories (same logic as AssetList)
  const filteredPositions = positions.filter(asset => {
    const isStockCategory = asset.category.includes('Stock') || 
                           asset.category.includes('Gold') || 
                           asset.category.includes('Real Estate');
    const isCryptoCategory = asset.category.includes('Crypto');
    
    if (selectedCategories.stocks && selectedCategories.crypto) {
      return true; // Show all
    } else if (selectedCategories.stocks && !selectedCategories.crypto) {
      return isStockCategory;
    } else if (!selectedCategories.stocks && selectedCategories.crypto) {
      return isCryptoCategory;
    }
    return false; // Neither selected, show nothing
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
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.foreground} />
        <Text style={styles.loadingText}>Loading Portfolio...</Text>
      </SafeAreaView>
    );
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
          onGranularityChange={handleGranularityChange}
        />
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