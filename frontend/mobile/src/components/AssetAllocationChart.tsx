import React, { useMemo, useState } from 'react';
import { View, Text, Image, Dimensions, TouchableOpacity } from 'react-native';
import { Svg, Rect, Text as SvgText } from 'react-native-svg';
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
  isExpanded: boolean;
  onToggle: () => void;
}

const BAR_HEIGHT = 16; // Increased from 12 to 16
const BAR_SPACING = 3; // Space between current and target bars
const CHART_HEIGHT = (BAR_HEIGHT * 2) + BAR_SPACING; // Total height for both bars
const LOGO_SIZE = 48;

function ChartRow({ asset, chartWidth, maxAllocation, isFirst = false, isLast = false, isExpanded, onToggle }: ChartRowProps) {
  const currentAllocation = parseFloat(asset.current_allocation);
  const targetAllocation = parseFloat(asset.target_allocation);

  // Calculate bar dimensions based on dynamic max allocation = full width
  const currentBarWidth = (currentAllocation / maxAllocation) * chartWidth;
  const targetBarWidth = (targetAllocation / maxAllocation) * chartWidth;
  
  const currentColor = '#07BADA';
  const targetColor = '#8B5CF6';

  // Calculate allocation details for expanded view
  const currentValue = parseFloat(asset.value);
  const targetValue = (targetAllocation / 100) * (currentValue / (currentAllocation / 100));
  const dollarDelta = currentValue - targetValue;
  const percentageDelta = currentAllocation - targetAllocation;
  const isOverAllocated = percentageDelta > 0;
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Get asset logo
  const getAssetLogo = (assetSymbol: string) => {
    try {
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

  const containerStyle = [
    styles.chartRow,
    isFirst && styles.firstRow,
    isLast && styles.lastRow,
    !isLast && styles.separatorRow,
  ];

  return (
    <TouchableOpacity
      style={containerStyle}
      onPress={onToggle}
      activeOpacity={0.7}
    >
      {/* Asset logo */}
      <View style={styles.logoContainer}>
        {logoSource ? (
          <Image source={logoSource} style={styles.logo} />
        ) : (
          <View style={[styles.logo, styles.logoPlaceholder]}>
            <Text style={styles.logoPlaceholderText}>{asset.asset.slice(0, 2)}</Text>
          </View>
        )}
      </View>
      
      {/* Right section with description and chart */}
      <View style={styles.rightSection}>
        {/* Asset description */}
        <Text style={styles.description}>{asset.description}</Text>
        
        {/* Chart area */}
        <View style={styles.chartContainer}>
        <Svg width={chartWidth + 40} height={CHART_HEIGHT + 4}>
          {/* Background tracks */}
          <Rect
            x={0}
            y={2}
            width={chartWidth}
            height={BAR_HEIGHT}
            fill={theme.colors.card}
            rx={BAR_HEIGHT / 2}
          />
          <Rect
            x={0}
            y={2 + BAR_HEIGHT + BAR_SPACING}
            width={chartWidth}
            height={BAR_HEIGHT}
            fill={theme.colors.card}
            rx={BAR_HEIGHT / 2}
          />
          
          {/* Current allocation bar (top) */}
          {currentBarWidth > 0 && (
            <Rect
              x={0}
              y={2}
              width={currentBarWidth}
              height={BAR_HEIGHT}
              fill={currentColor}
              rx={BAR_HEIGHT / 2}
            />
          )}
          
          {/* Target allocation bar (bottom) */}
          {targetBarWidth > 0 && (
            <Rect
              x={0}
              y={2 + BAR_HEIGHT + BAR_SPACING}
              width={targetBarWidth}
              height={BAR_HEIGHT}
              fill={targetColor}
              rx={BAR_HEIGHT / 2}
            />
          )}
          
          {/* Current percentage text */}
          {currentBarWidth > 0 && (
            <SvgText
              x={currentBarWidth + 6}
              y={2 + BAR_HEIGHT / 2 + 1}
              fontSize="12"
              fill={currentColor}
              textAnchor="start"
              alignmentBaseline="middle"
              fontWeight="500"
            >
              {currentAllocation % 1 === 0 ? currentAllocation.toFixed(0) : currentAllocation.toFixed(1)}%
            </SvgText>
          )}
          
          {/* Target percentage text */}
          {targetBarWidth > 0 && (
            <SvgText
              x={targetBarWidth + 6}
              y={2 + BAR_HEIGHT + BAR_SPACING + BAR_HEIGHT / 2 + 1}
              fontSize="12"
              fill={targetColor}
              textAnchor="start"
              alignmentBaseline="middle"
              fontWeight="500"
            >
              {targetAllocation % 1 === 0 ? targetAllocation.toFixed(0) : targetAllocation.toFixed(1)}%
            </SvgText>
          )}
        </Svg>
        </View>
        
        {/* Expanded details */}
        {isExpanded && (
          <View style={styles.expandedDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>
                ${Math.round(currentValue).toLocaleString()} → ${Math.round(targetValue).toLocaleString()}
              </Text>
              <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
                <Text style={[styles.deltaText, { color: deltaColor }]}>
                  {dollarDelta >= 0 ? '+' : '-'}${Math.round(Math.abs(dollarDelta)).toLocaleString()} ({percentageDelta >= 0 ? '+' : '-'}{Math.abs(percentageDelta).toFixed(1)}%)
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const { width: screenWidth } = Dimensions.get('window');
  const [expandedAssets, setExpandedAssets] = useState<Set<string>>(new Set());

  const handleToggleExpand = (assetSymbol: string) => {
    setExpandedAssets(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assetSymbol)) {
        newSet.delete(assetSymbol);
      } else {
        newSet.add(assetSymbol);
      }
      return newSet;
    });
  };
  
  // Calculate chart width (screen - padding - logo width - spacing - label space)
  const chartWidth = screenWidth - (theme.spacing.xl * 2) - LOGO_SIZE - theme.spacing.md - 40; // LOGO_SIZE + 40px for labels

  // Calculate the maximum allocation across all assets (current or target)
  const maxAllocation = useMemo(() => {
    if (assets.length === 0) return 50; // fallback
    
    const maxCurrentAllocation = Math.max(...assets.map(asset => parseFloat(asset.current_allocation)));
    const maxTargetAllocation = Math.max(...assets.map(asset => parseFloat(asset.target_allocation)));
    
    return Math.max(maxCurrentAllocation, maxTargetAllocation);
  }, [assets]);

  // Sort assets by target allocation (largest first) for better visual hierarchy
  const sortedAssets = useMemo(() => {
    return [...assets].sort((a, b) => 
      parseFloat(b.target_allocation) - parseFloat(a.target_allocation)
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
            isExpanded={expandedAssets.has(asset.asset)}
            onToggle={() => handleToggleExpand(asset.asset)}
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
  logoContainer: {
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: theme.borderRadius.sm,
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
    color: theme.colors.foreground,
    ...getTextStyle('xs', 'normal'),
    marginBottom: theme.spacing.xs,
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
  expandedDetails: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    color: theme.colors.foreground,
    ...getTextStyle('sm'),
  },
  deltaContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  deltaText: {
    ...getTextStyle('sm', 'semibold'),
  },
});