import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import GroupingSection, { GroupingType } from '../components/GroupingSection';
import CategoryDonutChart from '../components/CategoryDonutChart';
import CategoryLegend from '../components/CategoryLegend';
import AssetAllocationList from '../components/AssetAllocationList';
import { Asset, CategoryAllocation } from '../data/types';
import { apiService } from '../services/api';
import { aggregateAssetsByCategory } from '../data/utils';

export default function AllocationsScreen() {
  const [selectedGrouping, setSelectedGrouping] = useState<GroupingType>('categories');
  const [positions, setPositions] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Calculate category data from positions
  const categoryData = useMemo(() => {
    if (positions.length === 0) return [];
    return aggregateAssetsByCategory(positions);
  }, [positions]);

  // Data fetching function
  const fetchData = async () => {
    try {
      const positionsData = await apiService.getPositions();
      setPositions(positionsData);
    } catch (error) {
      console.error('Error fetching positions data:', error);
      // Handle error - could show toast or error state
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

  // Handle pull-to-refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['top']}>
        <ActivityIndicator size="large" color={theme.colors.foreground} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Allocations</Text>
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
        <GroupingSection
          selectedGrouping={selectedGrouping}
          onGroupingChange={setSelectedGrouping}
        />

        {selectedGrouping === 'categories' ? (
          <>
            <CategoryDonutChart categories={categoryData} />
            <CategoryLegend categories={categoryData} />
          </>
        ) : (
          <AssetAllocationList assets={positions} />
        )}
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