import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { Svg, Rect, Line, Defs, Mask } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { Asset } from '../data/types';

interface AssetAllocationChartProps {
  assets: Asset[];
}

interface ChartRowProps {
  asset: Asset;
  chartWidth: number;
  maxAllocation: number;
  isFirst?: boolean;
  isLast?: boolean;
}

const CHART_HEIGHT = 8;
const LABEL_WIDTH = 60;
const ROW_SPACING = 4;

function ChartRow({ asset, chartWidth, maxAllocation, isFirst = false, isLast = false }: ChartRowProps) {
  const currentAllocation = parseFloat(asset.current_allocation);
  const targetAllocation = parseFloat(asset.target_allocation);

  // Calculate bar dimensions based on dynamic max allocation = full width
  const currentBarWidth = (currentAllocation / maxAllocation) * chartWidth;
  const targetPosition = (targetAllocation / maxAllocation) * chartWidth;
  
  // Calculate segments for multi-color bar
  const isOverAllocated = currentAllocation > targetAllocation;
  const isUnderAllocated = currentAllocation < targetAllocation;
  
  // Base blue bar goes up to the minimum of current or target
  const blueBarWidth = Math.min(currentBarWidth, targetPosition);
  
  // Additional segment based on allocation status
  let additionalSegmentWidth = 0;
  let additionalSegmentColor = '';
  let additionalSegmentStart = 0;
  
  if (isOverAllocated) {
    // Green for excess beyond target
    additionalSegmentWidth = currentBarWidth - targetPosition;
    additionalSegmentColor = theme.colors.success;
    additionalSegmentStart = targetPosition;
  } else if (isUnderAllocated) {
    // Red for shortage up to target
    additionalSegmentWidth = targetPosition - currentBarWidth;
    additionalSegmentColor = theme.colors.destructive;
    additionalSegmentStart = currentBarWidth;
  }
  
  const blueColor = '#07BADA';

  const containerStyle = [
    styles.chartRow,
    isFirst && styles.firstRow,
    isLast && styles.lastRow,
    !isLast && styles.separatorRow,
  ];

  return (
    <View style={containerStyle}>
      {/* Asset label */}
      <View style={styles.labelContainer}>
        <Text style={styles.assetLabel}>{asset.asset}</Text>
      </View>
      
      {/* Chart area */}
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={CHART_HEIGHT + 4}>
          <Defs>
            {/* Mask for rounded corners only on outer edges */}
            <Mask id={`barMask-${asset.asset}`}>
              <Rect
                x={0}
                y={2}
                width={Math.max(currentBarWidth, targetPosition)}
                height={CHART_HEIGHT}
                fill="white"
                rx={CHART_HEIGHT / 2}
              />
            </Mask>
          </Defs>
          
          {/* Background track */}
          <Rect
            x={0}
            y={2}
            width={chartWidth}
            height={CHART_HEIGHT}
            fill={theme.colors.card}
            rx={CHART_HEIGHT / 2}
          />
          
          {/* Blue bar segment */}
          {blueBarWidth > 0 && (
            <Rect
              x={0}
              y={2}
              width={blueBarWidth}
              height={CHART_HEIGHT}
              fill={blueColor}
              mask={`url(#barMask-${asset.asset})`}
            />
          )}
          
          {/* Additional segment (green for excess, red for shortage) */}
          {additionalSegmentWidth > 0 && (
            <Rect
              x={additionalSegmentStart}
              y={2}
              width={additionalSegmentWidth}
              height={CHART_HEIGHT}
              fill={additionalSegmentColor}
              mask={`url(#barMask-${asset.asset})`}
            />
          )}
          
          {/* Target allocation tick mark */}
          {targetPosition > 0 && targetPosition <= chartWidth && (
            <Line
              x1={targetPosition}
              y1={0}
              x2={targetPosition}
              y2={CHART_HEIGHT + 4}
              stroke={theme.colors.foreground}
              strokeWidth={2}
              opacity={0.8}
            />
          )}
        </Svg>
      </View>
    </View>
  );
}

export default function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate chart width (screen - padding - label width - spacing)
  const chartWidth = screenWidth - (theme.spacing.xl * 2) - LABEL_WIDTH - theme.spacing.md;

  // Calculate the maximum allocation across all assets (current or target)
  const maxAllocation = useMemo(() => {
    if (assets.length === 0) return 50; // fallback
    
    const maxCurrentAllocation = Math.max(...assets.map(asset => parseFloat(asset.current_allocation)));
    const maxTargetAllocation = Math.max(...assets.map(asset => parseFloat(asset.target_allocation)));
    
    return Math.max(maxCurrentAllocation, maxTargetAllocation);
  }, [assets]);

  // Sort assets by current allocation (largest first) for better visual hierarchy
  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => 
      parseFloat(b.current_allocation) - parseFloat(a.current_allocation)
    );
  }, [assets]);

  if (assets.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No assets to display</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.chartList}>
        {sortedAssets.map((asset, index) => (
          <ChartRow
            key={`${asset.asset}-${index}`}
            asset={asset}
            chartWidth={chartWidth}
            maxAllocation={maxAllocation}
            isFirst={index === 0}
            isLast={index === sortedAssets.length - 1}
          />
        ))}
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.lg,
  },
  chartList: {
    // No gap - components connect directly
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 0,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    marginBottom: 0,
  },
  firstRow: {
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  lastRow: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  separatorRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  labelContainer: {
    width: LABEL_WIDTH,
    marginRight: theme.spacing.md,
  },
  assetLabel: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'semibold'),
  },
  chartContainer: {
    flex: 1,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
  },
});