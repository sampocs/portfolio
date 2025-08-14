import React, { useMemo } from 'react';
import { View, Text, Image, Dimensions } from 'react-native';
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

const BAR_HEIGHT = 6;
const BAR_SPACING = 2; // Space between current and target bars
const CHART_HEIGHT = (BAR_HEIGHT * 2) + BAR_SPACING; // Total height for both bars
const LOGO_SIZE = 32;
const LOGO_WIDTH = LOGO_SIZE + 8;
const ROW_SPACING = 4;

function ChartRow({ asset, chartWidth, maxAllocation, isFirst = false, isLast = false }: ChartRowProps) {
  const currentAllocation = parseFloat(asset.current_allocation);
  const targetAllocation = parseFloat(asset.target_allocation);

  // Calculate bar dimensions based on dynamic max allocation = full width
  const currentBarWidth = (currentAllocation / maxAllocation) * chartWidth;
  const targetBarWidth = (targetAllocation / maxAllocation) * chartWidth;
  
  const currentColor = '#07BADA';
  const targetColor = '#8B5CF6';

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
    <View style={containerStyle}>
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
      
      {/* Chart area */}
      <View style={styles.chartContainer}>
        <Svg width={chartWidth} height={CHART_HEIGHT + 4}>
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
        </Svg>
      </View>
    </View>
  );
}

export default function AssetAllocationChart({ assets }: AssetAllocationChartProps) {
  const { width: screenWidth } = Dimensions.get('window');
  
  // Calculate chart width (screen - padding - logo width - spacing)
  const chartWidth = screenWidth - (theme.spacing.xl * 2) - LOGO_WIDTH - theme.spacing.md;

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
    width: LOGO_WIDTH,
    marginRight: theme.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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