import React from 'react';
import { View } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';
import { Asset } from '../data/types';
import AssetRow from './AssetRow';

interface AssetListProps {
  assets: Asset[];
  selectedCategories: {
    stocks: boolean;
    crypto: boolean;
  };
}

export default function AssetList({ assets, selectedCategories }: AssetListProps) {
  // Filter assets based on selected categories
  const filteredAssets = assets.filter(asset => {
    const isStockCategory = asset.category.includes('Stock') || 
                           asset.category.includes('Gold') || 
                           asset.category.includes('Real Estate');
    const isCryptoCategory = asset.category.includes('Crypto');
    
    if (selectedCategories.stocks && selectedCategories.crypto) {
      return true; // Show all
    } else if (selectedCategories.stocks && !selectedCategories.crypto) {
      return isStockCategory;
    } else if (!selectedCategories.stocks && selectedCategories.crypto) {
      return isCryptoCategory;
    }
    return false; // Neither selected, show nothing
  });

  return (
    <View style={styles.container}>
      {filteredAssets.map((asset) => (
        <AssetRow key={asset.asset} asset={asset} />
      ))}
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.lg,
  },
});