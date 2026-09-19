import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { UI } from '../constants';
import { Asset } from '../data/types';
import AssetRow from './AssetRow';
import SortDropdown, { SortOption } from './SortDropdown';

interface AssetListProps {
  assets: Asset[];
  selectedCategories: {
    stocks: boolean;
    crypto: boolean;
    alternatives: boolean;
  };
  onAssetPress?: (asset: Asset) => void;
}

// Sort a group of assets by the currently selected sort option
const sortAssets = (assets: Asset[], selectedSort: SortOption): Asset[] => {
  const assetsCopy = [...assets];

  switch (selectedSort) {
    case 'alphabetical':
      return assetsCopy.sort((a, b) => a.asset.localeCompare(b.asset));

    case 'highest-value':
      return assetsCopy.sort((a, b) => parseFloat(b.value) - parseFloat(a.value));

    case 'lowest-value':
      return assetsCopy.sort((a, b) => parseFloat(a.value) - parseFloat(b.value));

    case 'highest-gains':
      return assetsCopy.sort((a, b) => parseFloat(b.total_return) - parseFloat(a.total_return));

    case 'lowest-gains':
      return assetsCopy.sort((a, b) => parseFloat(a.total_return) - parseFloat(b.total_return));

    case 'highest-returns':
      return assetsCopy.sort((a, b) => parseFloat(b.returns) - parseFloat(a.returns));

    case 'lowest-returns':
      return assetsCopy.sort((a, b) => parseFloat(a.returns) - parseFloat(b.returns));

    default:
      return assetsCopy;
  }
};

export default function AssetList({ assets, selectedCategories, onAssetPress }: AssetListProps) {
  const [selectedSort, setSelectedSort] = useState<SortOption>('highest-value');
  const [showClosedPositions, setShowClosedPositions] = useState(false);

  // Filter assets based on selected categories
  const filteredAssets = useMemo(() => {
    return assets.filter(asset => {
      const isStocksMarket = asset.market === 'Stocks';
      const isCryptoMarket = asset.market === 'Crypto';
      const isAlternativesMarket = asset.market === 'Alternatives';

      const showStocks = selectedCategories.stocks && isStocksMarket;
      const showCrypto = selectedCategories.crypto && isCryptoMarket;
      const showAlternatives = selectedCategories.alternatives && isAlternativesMarket;

      return showStocks || showCrypto || showAlternatives;
    });
  }, [assets, selectedCategories]);

  // Split into currently held (open) positions and fully sold (closed) positions -
  // closed positions render collapsed under their own section at the bottom
  const openAssets = useMemo(
    () => filteredAssets.filter(asset => parseFloat(asset.quantity) > 0),
    [filteredAssets]
  );
  const closedAssets = useMemo(
    () => filteredAssets.filter(asset => parseFloat(asset.quantity) === 0),
    [filteredAssets]
  );

  const sortedOpenAssets = useMemo(
    () => sortAssets(openAssets, selectedSort),
    [openAssets, selectedSort]
  );
  const sortedClosedAssets = useMemo(
    () => sortAssets(closedAssets, selectedSort),
    [closedAssets, selectedSort]
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SortDropdown
          selectedSort={selectedSort}
          onSortChange={setSelectedSort}
        />
      </View>

      <View style={styles.assetsList}>
        {sortedOpenAssets.map((asset, index) => (
          <AssetRow
            key={asset.asset}
            asset={asset}
            isFirst={index === 0}
            isLast={index === sortedOpenAssets.length - 1}
            onPress={onAssetPress}
          />
        ))}
      </View>

      {sortedClosedAssets.length > 0 && (
        <View style={styles.closedSection}>
          <TouchableOpacity
            style={styles.closedHeader}
            activeOpacity={UI.TOUCHABLE_OPACITY_ACTIVE}
            onPress={() => setShowClosedPositions(!showClosedPositions)}
          >
            <Text style={styles.closedHeaderText}>
              Closed positions ({sortedClosedAssets.length})
            </Text>
            {showClosedPositions ? (
              <ChevronUp size={16} color={theme.colors.muted} />
            ) : (
              <ChevronDown size={16} color={theme.colors.muted} />
            )}
          </TouchableOpacity>

          {showClosedPositions && (
            <View style={styles.assetsList}>
              {sortedClosedAssets.map((asset, index) => (
                <AssetRow
                  key={asset.asset}
                  asset={asset}
                  isFirst={index === 0}
                  isLast={index === sortedClosedAssets.length - 1}
                  onPress={onAssetPress}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.xs,
  },
  assetsList: {
    // Assets list styling
  },
  closedSection: {
    marginTop: theme.spacing.md,
  },
  closedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  closedHeaderText: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
  },
});
