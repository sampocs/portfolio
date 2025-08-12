import React, { useState, useMemo } from 'react';
import { View } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';
import { Asset } from '../data/types';
import AssetRow from './AssetRow';
import SortDropdown, { SortOption } from './SortDropdown';

interface AssetListProps {
  assets: Asset[];
  selectedCategories: {
    stocks: boolean;
    crypto: boolean;
  };
}

export default function AssetList({ assets, selectedCategories }: AssetListProps) {
  const [selectedSort, setSelectedSort] = useState<SortOption>('highest-value');

  // Filter assets based on selected categories
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
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
  }, [assets, selectedCategories]);

  // Sort assets based on selected sort option
  const sortedAssets = useMemo(() => {
    const assetsCopy = [...filteredAssets];
    
    switch (selectedSort) {
      case 'alphabetical':
        return assetsCopy.sort((a, b) => a.asset.localeCompare(b.asset));
      
      case 'highest-value':
        return assetsCopy.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));
      
      case 'lowest-value':
        return assetsCopy.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));
      
      case 'highest-gains':
        return assetsCopy.sort((a, b) => {
          const aGains = parseFloat(a.value) - parseFloat(a.cost);
          const bGains = parseFloat(b.value) - parseFloat(b.cost);
          return bGains - aGains;
        });
      
      case 'lowest-gains':
        return assetsCopy.sort((a, b) => {
          const aGains = parseFloat(a.value) - parseFloat(a.cost);
          const bGains = parseFloat(b.value) - parseFloat(b.cost);
          return aGains - bGains;
        });
      
      case 'highest-returns':
        return assetsCopy.sort((a, b) => parseFloat(b.returns) - parseFloat(a.returns));
      
      case 'lowest-returns':
        return assetsCopy.sort((a, b) => parseFloat(a.returns) - parseFloat(b.returns));
      
      default:
        return assetsCopy;
    }
  }, [filteredAssets, selectedSort]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SortDropdown
          selectedSort={selectedSort}
          onSortChange={setSelectedSort}
        />
      </View>
      
      <View style={styles.assetsList}>
        {sortedAssets.map((asset, index) => (
          <AssetRow 
            key={asset.asset} 
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
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xs,
  },
  assetsList: {
    // Assets list styling
  },
});