import React from 'react';
import { View } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';
import { Asset } from '../data/types';
import AssetAllocationChart from './AssetAllocationChart';

interface AssetAllocationListProps {
  assets: Asset[];
}

export default function AssetAllocationList({ assets }: AssetAllocationListProps) {

  if (assets.length === 0) {
    return (
      <View style={styles.emptyState}>
        {/* Empty state can be handled by individual components */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Expandable Chart with integrated details */}
      <AssetAllocationChart assets={assets} />
    </View>
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