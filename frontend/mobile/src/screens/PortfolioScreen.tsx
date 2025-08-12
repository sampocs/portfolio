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

  const handleCategoryToggle = (category: 'stocks' | 'crypto') => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleDataPointSelected = (dataPoint: PerformanceData | null) => {
    setSelectedDataPoint(dataPoint);
  };

  // Data fetching functions
  const fetchData = async (granularity: string = selectedGranularity) => {
    try {
      const [positionsData, performanceDataResponse] = await Promise.all([
        apiService.getPositions(),
        apiService.getPerformance(granularity)
      ]);
      
      setPositions(positionsData);
      setPerformanceData(performanceDataResponse);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Handle error - could show toast or error state
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
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

  // Calculate portfolio summary from API data
  const portfolioSummary = calculatePortfolioSummary(positions);

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