import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import CategorySelector from '../components/CategorySelector';
import Summary from '../components/Summary';
import TotalWorthChart from '../components/TotalWorthChart';
import AssetList from '../components/AssetList';
import { mockPositions, mockPerformanceData } from '../data/mockData';
import { calculatePortfolioSummary } from '../data/utils';
import { PerformanceData } from '../data/types';

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

  const handleCategoryToggle = (category: 'stocks' | 'crypto') => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const handleDataPointSelected = (dataPoint: PerformanceData | null) => {
    setSelectedDataPoint(dataPoint);
  };

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

  // Calculate portfolio summary from mock data
  const portfolioSummary = calculatePortfolioSummary(mockPositions);

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Portfolio</Text>
      </View>
      <ScrollView style={styles.scrollContent}>
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
          data={mockPerformanceData}
          onDataPointSelected={handleDataPointSelected}
        />
        <AssetList
          assets={mockPositions}
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
  },
});