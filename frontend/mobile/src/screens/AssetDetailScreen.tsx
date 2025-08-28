import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming,
  Easing
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { AssetService } from '../services/assetService';
import { AssetDuration, ProcessedPriceData } from '../data/assetTypes';
import AssetPriceHeader from '../components/AssetPriceHeader';
import { AssetDurationSelector } from '../components/DurationSelector';
import FinancialChart, { ChartDataPoint } from '../components/FinancialChart';
import AssetHoldingsSummary from '../components/AssetHoldingsSummary';
import TradesList from '../components/TradesList';
import { useData } from '../contexts/DataContext';
import { DURATIONS } from '../constants';

interface AssetDetailScreenProps {
  route: {
    params: {
      symbol: string;
      assetName?: string;
    };
  };
  navigation: {
    goBack: () => void;
  };
}

// Skeleton component with pulsing animation
function SkeletonBox({ width, height, style }: { width: number | string, height: number, style?: any }) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          backgroundColor: theme.colors.muted,
          borderRadius: 8,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export default function AssetDetailScreen({ route, navigation }: AssetDetailScreenProps) {
  const { symbol, assetName } = route.params;
  const { dataMode } = useData();
  const [selectedDuration, setSelectedDuration] = useState<AssetDuration>(DURATIONS.INITIAL_ASSET);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [assetData, setAssetData] = useState<any>(null);
  const [selectedDataPoint, setSelectedDataPoint] = useState<any>(null);

  useEffect(() => {
    const loadAssetData = async () => {
      try {
        setIsLoading(true);
        const data = await AssetService.getAssetDetails(symbol, DURATIONS.INITIAL_ASSET, dataMode);
        setAssetData(data);
      } catch (error) {
        console.error('Error loading asset data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAssetData();
  }, [symbol, dataMode]); // Removed selectedDuration from dependencies

  const handleDurationChange = async (duration: AssetDuration) => {
    setSelectedDuration(duration);
    setIsChartLoading(true);
    
    try {
      const data = await AssetService.getAssetDetails(symbol, duration, dataMode);
      setAssetData(data);
    } catch (error) {
      console.error('Error loading asset data for duration:', error);
    } finally {
      setIsChartLoading(false);
    }
  };

  const handleDataPointSelected = (dataPoint: any) => {
    setSelectedDataPoint(dataPoint);
  };

  // Get price change data for display - use selected data point if available
  const getCurrentPriceChange = () => {
    if (selectedDataPoint && assetData) {
      const selectedPrice = selectedDataPoint.price || selectedDataPoint.value;
      // Calculate change relative to the first price in the current timeframe
      const firstPrice = assetData.processedPriceData[0]?.price || selectedPrice;
      const changeAmount = selectedPrice - firstPrice;
      const changePercent = firstPrice > 0 ? (changeAmount / firstPrice) * 100 : 0;
      
      return {
        currentPrice: selectedPrice,
        previousPrice: firstPrice,
        changeAmount,
        changePercent,
        isPositive: changeAmount >= 0
      };
    }
    return assetData.priceChange;
  };

  // Clear selected data point when duration changes
  const handleDurationChangeWithReset = async (duration: AssetDuration) => {
    setSelectedDataPoint(null); // Clear immediately for UI responsiveness
    await handleDurationChange(duration);
  };

  // Transform price data for chart
  const transformPriceDataForChart = (priceData: ProcessedPriceData[]): ChartDataPoint[] => {
    return priceData.map((item, index) => ({
      x: index,
      y: item.price,
      date: item.date,
      value: item.price,
      originalData: item
    }));
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={navigation.goBack}
          >
            <ArrowLeft size={24} color={theme.colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerText}>{symbol}</Text>
          <View style={styles.headerSpacer} />
        </View>
        
        <ScrollView style={styles.scrollContent}>
          {/* Price Header Skeleton */}
          <View style={{ marginBottom: theme.spacing.md }}>
            <SkeletonBox width={200} height={40} style={{ marginBottom: theme.spacing.xs }} />
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <SkeletonBox width={100} height={20} style={{ marginRight: theme.spacing.sm }} />
              <SkeletonBox width={80} height={28} />
            </View>
            <SkeletonBox width={150} height={14} style={{ marginTop: theme.spacing.xs }} />
          </View>
          
          {/* Duration Selector Skeleton */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.xl }}>
            {Array.from({ length: 6 }).map((_, index) => (
              <SkeletonBox key={index} width={45} height={32} />
            ))}
          </View>
          
          {/* Chart Skeleton */}
          <SkeletonBox width="100%" height={200} style={{ marginBottom: theme.spacing.lg }} />
          
          {/* Holdings Summary Skeleton */}
          <View style={{ marginBottom: theme.spacing.lg }}>
            <SkeletonBox width={120} height={24} style={{ marginBottom: theme.spacing.md }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: theme.spacing.sm }}>
              <SkeletonBox width="48%" height={60} />
              <SkeletonBox width="48%" height={60} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <SkeletonBox width="48%" height={60} />
              <SkeletonBox width="48%" height={60} />
            </View>
          </View>
          
          {/* Trades List Skeleton */}
          <View>
            <SkeletonBox width={100} height={24} style={{ marginBottom: theme.spacing.md }} />
            {Array.from({ length: 4 }).map((_, index) => (
              <View key={index} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm }}>
                <SkeletonBox width={60} height={16} style={{ marginRight: theme.spacing.sm }} />
                <SkeletonBox width={80} height={16} style={{ marginRight: theme.spacing.sm }} />
                <SkeletonBox width={100} height={16} />
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (!assetData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={navigation.goBack}
          >
            <ArrowLeft size={24} color={theme.colors.foreground} />
          </TouchableOpacity>
          <Text style={styles.headerText}>{symbol}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Failed to load asset data</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={navigation.goBack}
        >
          <ArrowLeft size={24} color={theme.colors.foreground} />
        </TouchableOpacity>
        <Text style={styles.headerText}>{symbol}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      <ScrollView style={styles.scrollContent}>
        <AssetPriceHeader
          priceChange={getCurrentPriceChange()}
          isLoading={false}
          isDeltaLoading={isChartLoading}
          selectedDate={selectedDataPoint?.date}
          updatedAt={assetData?.updatedAt}
        />
        
        <View style={styles.durationSelectorContainer}>
          <AssetDurationSelector
            selectedDuration={selectedDuration}
            onDurationChange={handleDurationChangeWithReset}
          />
        </View>
        
        <FinancialChart
          data={transformPriceDataForChart(assetData.processedPriceData)}
          onDataPointSelected={handleDataPointSelected}
          isLoading={isChartLoading}
          isPositive={assetData.priceChange.isPositive}
          showGradient={true}
        />
        
        <AssetHoldingsSummary
          holdings={assetData.holdings}
          isLoading={false}
        />
        
        <TradesList
          trades={assetData.tradeData.trades}
          isLoading={false}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    marginLeft: -theme.spacing.sm,
  },
  headerText: {
    color: theme.colors.foreground,
    ...getTextStyle('xxl', 'bold'),
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 48, // Same width as back button + margins
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    marginTop: theme.spacing.lg,
  },
  errorText: {
    color: theme.colors.destructive,
    ...getTextStyle('md'),
  },
  durationSelectorContainer: {
    zIndex: 999,
    elevation: 999,
    marginBottom: theme.spacing.xl,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    marginVertical: theme.spacing.lg,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: theme.spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: theme.colors.accent,
  },
  durationText: {
    color: theme.colors.muted,
    ...getTextStyle('sm', 'medium'),
  },
  durationTextSelected: {
    color: theme.colors.foreground,
  },
});