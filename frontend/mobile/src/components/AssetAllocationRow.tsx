import React, { useMemo } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
import { Svg, Rect, Line } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { Asset } from '../data/types';
import { calculateAllocationDelta } from '../data/utils';

interface AssetAllocationRowProps {
  asset: Asset;
}

const LOGO_SIZE = 40;
const CHART_HEIGHT = 6;
const MAX_DISPLAY_ALLOCATION = 50; // 50% = full width

export default function AssetAllocationRow({ asset }: AssetAllocationRowProps) {
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate available width for the chart (screen - padding - logo section - data section)
  const chartContainerWidth = screenWidth - (theme.spacing.xl * 2) - 100 - 120; // Approximate widths
  
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
  
  // Determine bar color based on allocation accuracy
  const allocationDifference = Math.abs(percentageDelta);
  const barColor = useMemo(() => {
    if (allocationDifference <= 0.5) return theme.colors.success;
    if (allocationDifference <= 1.0) return '#F59E0B'; // Orange for moderate difference
    return theme.colors.destructive;
  }, [allocationDifference]);

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

  return (
    <View style={styles.container}>
      {/* Left section - Logo and description */}
      <View style={styles.leftSection}>
        <View style={styles.logoContainer}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>{asset.asset.slice(0, 2)}</Text>
            </View>
          )}
        </View>
        <Text style={styles.description}>{asset.description}</Text>
      </View>

      {/* Chart section */}
      <View style={styles.chartSection}>
        <View style={styles.chartContainer}>
          <Svg width={chartContainerWidth} height={CHART_HEIGHT + 8}>
            {/* Background track */}
            <Rect
              x={0}
              y={4}
              width={chartContainerWidth}
              height={CHART_HEIGHT}
              fill={theme.colors.card}
              rx={CHART_HEIGHT / 2}
            />
            
            {/* Current allocation bar */}
            {currentBarWidth > 0 && (
              <Rect
                x={0}
                y={4}
                width={currentBarWidth}
                height={CHART_HEIGHT}
                fill={barColor}
                rx={CHART_HEIGHT / 2}
              />
            )}
            
            {/* Target allocation tick mark */}
            {targetPosition > 0 && targetPosition <= chartContainerWidth && (
              <Line
                x1={targetPosition}
                y1={2}
                x2={targetPosition}
                y2={CHART_HEIGHT + 6}
                stroke={theme.colors.foreground}
                strokeWidth={2}
                opacity={0.8}
              />
            )}
          </Svg>
        </View>
      </View>

      {/* Right section - Data display */}
      <View style={styles.rightSection}>
        <Text style={styles.percentageText}>
          {currentAllocation.toFixed(1)}% → {targetAllocation.toFixed(1)}%
        </Text>
        <Text style={styles.valueText}>
          Current: {formatCurrency(currentValue)}
        </Text>
        <Text style={styles.valueText}>
          Target: {formatCurrency(targetValue)}
        </Text>
        <View style={styles.deltaContainer}>
          <Text style={[
            styles.deltaText,
            { color: dollarDelta >= 0 ? theme.colors.destructive : theme.colors.success }
          ]}>
            Delta: {dollarDelta >= 0 ? '+' : ''}{formatCurrency(dollarDelta)} ({percentageDelta >= 0 ? '+' : ''}{percentageDelta.toFixed(1)}%)
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  leftSection: {
    width: 80,
    alignItems: 'center',
    marginRight: theme.spacing.md,
  },
  logoContainer: {
    marginBottom: theme.spacing.xs,
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
  description: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
    textAlign: 'center',
  },
  chartSection: {
    flex: 1,
    marginRight: theme.spacing.md,
  },
  chartContainer: {
    justifyContent: 'center',
  },
  rightSection: {
    width: 110,
    alignItems: 'flex-end',
  },
  percentageText: {
    color: theme.colors.foreground,
    ...getTextStyle('xs', 'semibold'),
    marginBottom: 2,
  },
  valueText: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
    marginBottom: 1,
  },
  deltaContainer: {
    marginTop: 2,
  },
  deltaText: {
    ...getTextStyle('xs', 'medium'),
  },
});