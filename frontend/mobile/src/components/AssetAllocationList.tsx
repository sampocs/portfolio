import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';
import { Asset } from '../data/types';
import AssetAllocationChart from './AssetAllocationChart';
import AssetAllocationLegend from './AssetAllocationLegend';

interface AssetAllocationListProps {
  assets: Asset[];
}

export default function AssetAllocationList({ assets }: AssetAllocationListProps) {
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const handleAssetSelect = (asset: Asset | null) => {
    setSelectedAsset(asset);
  };

  if (assets.length === 0) {
    return (
      <View style={styles.emptyState}>
        {/* Empty state can be handled by individual components */}
      </View>
    );
  }

  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={() => setSelectedAsset(null)}
      activeOpacity={1}
    >
      {/* Chart Section - Visual bars for quick comparison */}
      <AssetAllocationChart assets={assets} />
      
      {/* Legend Section - Detailed data */}
      <AssetAllocationLegend 
        assets={assets}
        selectedAsset={selectedAsset}
        onAssetSelect={handleAssetSelect}
      />
    </TouchableOpacity>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
});