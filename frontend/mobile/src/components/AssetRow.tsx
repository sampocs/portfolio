import React from 'react';
import { View, Text, Image } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { Asset } from '../data/types';

interface AssetRowProps {
  asset: Asset;
}

// Asset image mapping
const assetImages: { [key: string]: any } = {
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

export default function AssetRow({ asset }: AssetRowProps) {
  // Get image source from mapping
  const imageSource = assetImages[asset.asset];
  
  // Calculate values
  const totalValue = parseFloat(asset.value);
  const totalReturn = totalValue - parseFloat(asset.cost);
  const returnsPercent = parseFloat(asset.returns);
  const isPositive = totalReturn >= 0;

  // Format numbers
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatReturn = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${formatCurrency(Math.abs(value))}`;
  };

  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  return (
    <View style={styles.container}>
      <View style={styles.leftSection}>
        {imageSource ? (
          <Image 
            source={imageSource} 
            style={styles.logoImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>{asset.asset}</Text>
          </View>
        )}
        <View style={styles.assetInfo}>
          <Text style={styles.ticker}>{asset.asset}</Text>
          <Text style={styles.details}>
            {parseFloat(asset.quantity).toFixed(2)} | ${parseFloat(asset.current_price).toFixed(2)}
          </Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <Text style={styles.totalValue}>
          ${formatCurrency(totalValue)}
        </Text>
        <View style={styles.returnsContainer}>
          <Text style={[styles.returnValue, { color: isPositive ? theme.colors.success : theme.colors.destructive }]}>
            {formatReturn(totalReturn)}
          </Text>
          <View style={[
            styles.percentContainer, 
            { backgroundColor: isPositive ? theme.colors.successBackground : theme.colors.destructiveBackground }
          ]}>
            <Text style={[styles.percentText, { color: isPositive ? theme.colors.success : theme.colors.destructive }]}>
              {formatPercent(returnsPercent)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: theme.spacing.md,
  },
  logoText: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'bold'),
    fontSize: 12,
  },
  assetInfo: {
    flex: 1,
  },
  ticker: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  details: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  rightSection: {
    alignItems: 'flex-end',
  },
  totalValue: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  returnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  returnValue: {
    fontSize: 12,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginRight: theme.spacing.xs,
  },
  percentContainer: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  percentText: {
    fontSize: 12,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
});