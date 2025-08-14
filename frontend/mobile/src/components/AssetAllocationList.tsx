import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { Asset } from '../data/types';
import AssetAllocationRow from './AssetAllocationRow';

interface AssetAllocationListProps {
  assets: Asset[];
}

export default function AssetAllocationList({ assets }: AssetAllocationListProps) {
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
      <View style={styles.assetList}>
        {sortedAssets.map((asset, index) => (
          <AssetAllocationRow
            key={`${asset.asset}-${index}`}
            asset={asset}
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
  assetList: {
    // No gap - components connect directly with separators
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