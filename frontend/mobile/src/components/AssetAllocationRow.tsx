import React, { useMemo } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import { Svg, Rect, Line, Defs, Mask } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { Asset } from '../data/types';
import { calculateAllocationDelta } from '../data/utils';

interface AssetAllocationRowProps {
  asset: Asset;
  isFirst?: boolean;
  isLast?: boolean;
}

const LOGO_SIZE = 40;
const CHART_HEIGHT = 8; // Increased from 6 to 8 for thicker bar
const MAX_DISPLAY_ALLOCATION = 50; // 50% = full width

export default function AssetAllocationRow({ asset, isFirst = false, isLast = false }: AssetAllocationRowProps) {
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate available width for the full-width chart (screen - padding - logo width - spacing)
  const chartContainerWidth = screenWidth - (theme.spacing.xl * 2) - LOGO_SIZE - theme.spacing.md - 8; // 8px buffer
  
  const currentAllocation = parseFloat(asset.current_allocation);
  const targetAllocation = parseFloat(asset.target_allocation);
  const currentValue = parseFloat(asset.value);
  const targetValue = (targetAllocation / 100) * (currentValue / (currentAllocation / 100)); // Calculate target dollar value

  // Calculate deltas
  const dollarDelta = currentValue - targetValue;
  const percentageDelta = currentAllocation - targetAllocation;
  
  // Calculate bar dimensions based on 50% = full width scaling rule
  const currentBarWidth = Math.min(currentAllocation / MAX_DISPLAY_ALLOCATION, 1) * chartContainerWidth;
  const targetPosition = Math.min(targetAllocation / MAX_DISPLAY_ALLOCATION, 1) * chartContainerWidth;
  
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
    additionalSegmentColor = theme.colors.success; // Green
    additionalSegmentStart = targetPosition;
  } else if (isUnderAllocated) {
    // Red for shortage up to target
    additionalSegmentWidth = targetPosition - currentBarWidth;
    additionalSegmentColor = theme.colors.destructive; // Red
    additionalSegmentStart = currentBarWidth;
  }
  
  const blueColor = '#06A9C6';

  // Get asset logo path
  const getAssetLogo = (assetSymbol: string) => {
    try {
      // Map asset symbols to logo files
      const logoMap: { [key: string]: any } = {
        'VT': require('../../assets/images/VT.png'),
        'VOO': require('../../assets/images/VOO.png'),
        'VO': require('../../assets/images/VO.png'),
        'VB': require('../../assets/images/VB.png'),
        'VXUS': require('../../assets/images/VXUS.png'),
        'VWO': require('../../assets/images/VWO.png'),
        'COIN': require('../../assets/images/COIN.png'),
        'HOOD': require('../../assets/images/HOOD.png'),
        'AAAU': require('../../assets/images/AAAU.png'),
        'VNQ': require('../../assets/images/VNQ.png'),
        'BTC': require('../../assets/images/BTC.png'),
        'ETH': require('../../assets/images/ETH.png'),
        'SOL': require('../../assets/images/SOL.png'),
      };
      return logoMap[assetSymbol] || null;
    } catch {
      return null;
    }
  };

  const logoSource = getAssetLogo(asset.asset);

  // Determine delta colors (reuse the isOverAllocated from chart logic)
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Dynamic container style based on position
  const containerStyle = [
    styles.container,
    isFirst && styles.firstContainer,
    isLast && styles.lastContainer,
    !isLast && styles.separatorContainer,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.mainContent}>
        {/* Logo - centered vertically */}
        <View style={styles.logoContainer}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>{asset.asset.slice(0, 2)}</Text>
            </View>
          )}
        </View>
        
        {/* Right content area */}
        <View style={styles.rightContent}>
          {/* Top row - Asset description and current/target dollar values */}
          <View style={styles.topRow}>
            <View style={styles.descriptionContainer}>
              <Text style={styles.description}>{asset.description}</Text>
            </View>
            
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>
                ${Math.round(currentValue).toLocaleString()} → ${Math.round(targetValue).toLocaleString()}
              </Text>
            </View>
          </View>

          {/* Chart section - full width */}
          <View style={styles.chartSection}>
            <Svg width={chartContainerWidth} height={CHART_HEIGHT + 12}>
              <Defs>
                {/* Mask for rounded corners only on outer edges */}
                <Mask id="barMask">
                  <Rect
                    x={0}
                    y={6}
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
                y={6}
                width={chartContainerWidth}
                height={CHART_HEIGHT}
                fill={theme.colors.card}
                rx={CHART_HEIGHT / 2}
              />
              
              {/* Blue bar segment (up to target or current, whichever is smaller) */}
              {blueBarWidth > 0 && (
                <Rect
                  x={0}
                  y={6}
                  width={blueBarWidth}
                  height={CHART_HEIGHT}
                  fill={blueColor}
                  mask="url(#barMask)"
                />
              )}
              
              {/* Additional segment (green for excess, red for shortage) */}
              {additionalSegmentWidth > 0 && (
                <Rect
                  x={additionalSegmentStart}
                  y={6}
                  width={additionalSegmentWidth}
                  height={CHART_HEIGHT}
                  fill={additionalSegmentColor}
                  mask="url(#barMask)"
                />
              )}
              
              {/* Target allocation tick mark - longer */}
              {targetPosition > 0 && targetPosition <= chartContainerWidth && (
                <Line
                  x1={targetPosition}
                  y1={0}
                  x2={targetPosition}
                  y2={CHART_HEIGHT + 12}
                  stroke={theme.colors.foreground}
                  strokeWidth={2}
                  opacity={0.8}
                />
              )}
            </Svg>
          </View>

          {/* Bottom row - Percentages and delta */}
          <View style={styles.bottomRow}>
            <View style={styles.leftBottomSection}>
              <Text style={styles.allocationText}>
                {currentAllocation.toFixed(1)}% → {targetAllocation.toFixed(1)}%
              </Text>
            </View>
            
            <View style={styles.rightBottomSection}>
              <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
                <Text style={[styles.deltaText, { color: deltaColor }]}>
                  {dollarDelta >= 0 ? '+' : '-'}${Math.round(Math.abs(dollarDelta)).toLocaleString()} ({percentageDelta >= 0 ? '+' : '-'}{Math.round(Math.abs(percentageDelta))}%)
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: 0,
    padding: theme.spacing.md,
    marginBottom: 0,
  },
  firstContainer: {
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  lastContainer: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  separatorContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoContainer: {
    marginRight: theme.spacing.md,
    alignSelf: 'center',
  },
  rightContent: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: theme.borderRadius.md,
  },
  logoPlaceholder: {
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPlaceholderText: {
    color: theme.colors.foreground,
    ...getTextStyle('xs', 'bold'),
  },
  descriptionContainer: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  description: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'semibold'), // Same as AllocationLegend itemName
  },
  valueContainer: {
    alignItems: 'flex-end',
  },
  allocationText: {
    color: theme.colors.muted,
    ...getTextStyle('md'), // Same as AllocationLegend
  },
  chartSection: {
    marginBottom: theme.spacing.sm,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  leftBottomSection: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  valueText: {
    color: theme.colors.foreground,
    ...getTextStyle('md'), // Same as AllocationLegend
  },
  rightBottomSection: {
    alignItems: 'flex-end',
  },
  deltaContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  deltaText: {
    ...getTextStyle('md', 'semibold'), // Same as AllocationLegend
  },
});