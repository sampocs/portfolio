import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, ActivityIndicator, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import GroupingSection, { GroupingType } from '../components/GroupingSection';
import DonutChart from '../components/DonutChart';
import AllocationLegend from '../components/AllocationLegend';
import AssetAllocationList from '../components/AssetAllocationList';
import { Asset, MarketAllocation, SegmentAllocation, GenericAllocation } from '../data/types';
import { apiService } from '../services/api';
import { aggregateAssetsByMarket, aggregateAssetsBySegment, marketToGeneric, segmentToGeneric, getMarketColor, getSegmentColor } from '../data/utils';

export default function AllocationsScreen() {
  const [selectedGrouping, setSelectedGrouping] = useState<GroupingType>('markets');
  const [positions, setPositions] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedGenericItem, setSelectedGenericItem] = useState<GenericAllocation | null>(null);

  // Calculate market data from positions
  const marketData = useMemo(() => {
    if (positions.length === 0) return [];
    return aggregateAssetsByMarket(positions);
  }, [positions]);

  // Calculate segment data from positions
  const segmentData = useMemo(() => {
    if (positions.length === 0) return [];
    return aggregateAssetsBySegment(positions);
  }, [positions]);

  // Convert to generic format for the unified components
  const genericMarketData = useMemo(() => 
    marketData.map(marketToGeneric), [marketData]);
  const genericSegmentData = useMemo(() => 
    segmentData.map(segmentToGeneric), [segmentData]);

  // Handle selection for unified component
  const handleGenericItemSelect = (item: GenericAllocation | null) => {
    setSelectedGenericItem(item);
  };

  // Get current data and color function based on grouping
  const currentData = selectedGrouping === 'markets' ? genericMarketData : genericSegmentData;
  const getColor = selectedGrouping === 'markets' ? getMarketColor : getSegmentColor;
  const title = selectedGrouping === 'markets' ? 'Markets' : 'Segments';

  // Clear selections when changing grouping
  const handleGroupingChange = (grouping: GroupingType) => {
    setSelectedGrouping(grouping);
    setSelectedGenericItem(null);
  };

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
        <TouchableOpacity 
          style={styles.contentTouchable}
          onPress={() => setSelectedGenericItem(null)}
          activeOpacity={1}
        >
          <GroupingSection
            selectedGrouping={selectedGrouping}
            onGroupingChange={handleGroupingChange}
          />

          {selectedGrouping === 'markets' || selectedGrouping === 'segments' ? (
            <>
              <DonutChart 
                data={currentData}
                selectedItem={selectedGenericItem}
                onItemSelect={handleGenericItemSelect}
                getColor={getColor}
                title={title}
              />
              <AllocationLegend 
                data={currentData}
                getColor={getColor}
              />
            </>
          ) : (
            <AssetAllocationList assets={positions} />
          )}
        </TouchableOpacity>
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
    paddingHorizontal: theme.spacing.xs,
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
  contentTouchable: {
    flex: 1,
  },
});