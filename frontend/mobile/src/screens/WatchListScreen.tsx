import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { DURATIONS } from '../constants';
import { PortfolioDurationSelector } from '../components/DurationSelector';
import SortDropdown from '../components/SortDropdown';
import WatchListRow from '../components/WatchListRow';
import SkeletonLoadingScreen from '../components/SkeletonLoadingScreen';
import { useData } from '../contexts/DataContext';
import { apiService } from '../services/api';
import { mockWatchlist } from '../data/mockData';
import { WatchlistAsset } from '../data/types';
import { PortfolioDuration } from '../data/assetTypes';

export type WatchlistSortOption = 'default' | 'alphabetical' | 'highest-change' | 'lowest-change';

const WATCHLIST_SORT_OPTIONS: { value: WatchlistSortOption; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'highest-change', label: 'Highest Change' },
  { value: 'lowest-change', label: 'Lowest Change' },
];

// Sort watch list assets by the currently selected sort option - change sorts use the
// selected duration's percent since that's the only value that changes with duration.
// 'default' keeps the order the API returns, which is the assets.yaml order
const sortWatchlist = (
  assets: WatchlistAsset[],
  selectedSort: WatchlistSortOption,
  duration: PortfolioDuration
): WatchlistAsset[] => {
  const assetsCopy = [...assets];

  switch (selectedSort) {
    case 'highest-change':
      return assetsCopy.sort((a, b) => parseFloat(b.changes[duration]) - parseFloat(a.changes[duration]));

    case 'lowest-change':
      return assetsCopy.sort((a, b) => parseFloat(a.changes[duration]) - parseFloat(b.changes[duration]));

    case 'alphabetical':
      return assetsCopy.sort((a, b) => a.asset.localeCompare(b.asset));

    case 'default':
    default:
      return assetsCopy;
  }
};

interface WatchListScreenProps {
  navigation: {
    navigate: (screen: string, params?: any) => void;
  };
}

/**
 * WatchListScreen - Lists every configured asset with a non-zero target allocation,
 * showing current price and percent change over a selectable duration.
 *
 * In live mode, fetches /watchlist on mount and on pull-to-refresh into local state.
 * In demo mode, uses the static mockWatchlist. Duration switching is purely local
 * since the API response carries the percent change for every duration up front.
 */
export default function WatchListScreen({ navigation }: WatchListScreenProps) {
  const { dataMode } = useData();

  const [watchlist, setWatchlist] = useState<WatchlistAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDuration, setSelectedDuration] = useState<PortfolioDuration>(DURATIONS.INITIAL_PORTFOLIO);
  const [selectedSort, setSelectedSort] = useState<WatchlistSortOption>('default');

  const fetchWatchlist = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      const data = await apiService.getWatchlist();
      setWatchlist(data);
    } catch (error) {
      console.error('Error fetching watch list:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Load the watch list whenever the data mode changes - demo mode uses the static
  // mock list instantly, live mode fetches from the API
  useEffect(() => {
    if (dataMode === 'demo') {
      setWatchlist(mockWatchlist);
      setIsLoading(false);
      return;
    }
    fetchWatchlist();
  }, [dataMode]);

  const handleRefresh = async () => {
    if (dataMode === 'demo') {
      setWatchlist(mockWatchlist);
      return;
    }
    await fetchWatchlist(true);
  };

  const handleAssetPress = (asset: WatchlistAsset) => {
    navigation.navigate('AssetDetail', {
      symbol: asset.asset,
      assetName: asset.description,
      mode: 'price',
    });
  };

  const sortedWatchlist = sortWatchlist(watchlist, selectedSort, selectedDuration);

  if (isLoading) {
    return <SkeletonLoadingScreen title="Watch List" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Watch List</Text>
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
        <PortfolioDurationSelector
          selectedDuration={selectedDuration}
          onDurationChange={setSelectedDuration}
        />

        <View style={styles.sortRow}>
          <SortDropdown
            selectedSort={selectedSort}
            onSortChange={setSelectedSort}
            options={WATCHLIST_SORT_OPTIONS}
          />
        </View>

        {!isLoading && dataMode === 'live' && watchlist.length === 0 ? (
          <Text style={styles.emptyText}>Failed to load watch list</Text>
        ) : (
          <View style={styles.assetsList}>
            {sortedWatchlist.map((asset, index) => (
              <WatchListRow
                key={asset.asset}
                asset={asset}
                duration={selectedDuration}
                isFirst={index === 0}
                isLast={index === sortedWatchlist.length - 1}
                onPress={handleAssetPress}
              />
            ))}
          </View>
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
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  assetsList: {
    // Assets list styling
  },
  emptyText: {
    color: theme.colors.muted,
    textAlign: 'center',
    marginTop: theme.spacing.xl,
    ...getTextStyle('md'),
  },
});
