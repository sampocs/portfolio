import React, { useMemo } from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { Asset } from '../data/types';

interface AssetAllocationLegendProps {
  assets: Asset[];
  selectedAsset?: Asset | null;
  onAssetSelect?: (asset: Asset | null) => void;
}

interface LegendRowProps {
  asset: Asset;
  isFirst?: boolean;
  isLast?: boolean;
  selectedAsset?: Asset | null;
  onAssetSelect?: (asset: Asset | null) => void;
}

const LOGO_SIZE = 40;

function LegendRow({ 
  asset, 
  isFirst = false, 
  isLast = false,
  selectedAsset,
  onAssetSelect 
}: LegendRowProps) {
  const currentAllocation = parseFloat(asset.current_allocation);
  const targetAllocation = parseFloat(asset.target_allocation);
  const currentValue = parseFloat(asset.value);
  const targetValue = (targetAllocation / 100) * (currentValue / (currentAllocation / 100));

  // Calculate deltas
  const dollarDelta = currentValue - targetValue;
  const percentageDelta = currentAllocation - targetAllocation;
  
  // Determine delta colors
  const isOverAllocated = percentageDelta > 0;
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Check if this asset is selected
  const isSelected = selectedAsset?.asset === asset.asset;

  // Handle touch events
  const handlePress = () => {
    if (onAssetSelect) {
      onAssetSelect(isSelected ? null : asset);
    }
  };

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
    styles.legendRow,
    isFirst && styles.firstRow,
    isLast && styles.lastRow,
    !isLast && styles.separatorRow,
    isSelected && styles.selectedRow,
  ];

  return (
    <TouchableOpacity 
      style={containerStyle}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logo} />
          ) : (
            <View style={[styles.logo, styles.logoPlaceholder]}>
              <Text style={styles.logoPlaceholderText}>{asset.asset.slice(0, 2)}</Text>
            </View>
          )}
        </View>
        
        {/* Asset info */}
        <View style={styles.assetInfo}>
          <Text style={styles.description}>{asset.description}</Text>
          <Text style={styles.valueText}>
            ${Math.round(currentValue).toLocaleString()} → ${Math.round(targetValue).toLocaleString()}
          </Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        {/* Percentages */}
        <Text style={styles.allocationText}>
          {currentAllocation.toFixed(1)}% → {targetAllocation.toFixed(1)}%
        </Text>
        
        {/* Delta */}
        <View style={styles.deltaSection}>
          <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {dollarDelta >= 0 ? '+' : '-'}${Math.round(Math.abs(dollarDelta)).toLocaleString()} ({percentageDelta >= 0 ? '+' : '-'}{Math.round(Math.abs(percentageDelta))}%)
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AssetAllocationLegend({ 
  assets, 
  selectedAsset, 
  onAssetSelect 
}: AssetAllocationLegendProps) {
  // Sort assets by current allocation (largest first) to match chart order
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
      {sortedAssets.map((asset, index) => (
        <LegendRow 
          key={`${asset.asset}-${index}`} 
          asset={asset}
          isFirst={index === 0}
          isLast={index === sortedAssets.length - 1}
          selectedAsset={selectedAsset}
          onAssetSelect={onAssetSelect}
        />
      ))}
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: 0,
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
  selectedRow: {
    backgroundColor: theme.colors.accent,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.md,
  },
  logoContainer: {
    marginRight: theme.spacing.md,
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
  assetInfo: {
    flex: 1,
  },
  description: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'semibold'),
    marginBottom: 4,
  },
  valueText: {
    color: theme.colors.foreground,
    ...getTextStyle('md'),
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  allocationText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    marginBottom: 6,
  },
  deltaSection: {
    alignItems: 'flex-end',
  },
  deltaContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  deltaText: {
    ...getTextStyle('md', 'semibold'),
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