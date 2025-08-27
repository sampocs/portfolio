import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { AssetPriceChange } from '../data/assetTypes';

interface AssetPriceHeaderProps {
  priceChange: AssetPriceChange;
  isLoading?: boolean;
}

export default function AssetPriceHeader({ priceChange, isLoading = false }: AssetPriceHeaderProps) {
  const { currentPrice, changeAmount, changePercent, isPositive } = priceChange;

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return price.toFixed(2);
  };

  const formatPriceChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}$${Math.abs(change).toFixed(2)}`;
  };

  const formatPercentChange = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>---.--</Text>
        </View>
        
        <View style={styles.changeContainer}>
          <Text style={[styles.changeAmount, { color: theme.colors.muted }]}>
            +$--.--
          </Text>
          
          <View style={[styles.changePercentContainer, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.changePercent, { color: theme.colors.muted }]}>
              +--.--% 
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.priceContainer}>
        <Text style={styles.currentPrice}>
          ${formatPrice(currentPrice)}
        </Text>
      </View>
      
      <View style={styles.changeContainer}>
        <Text style={[
          styles.changeAmount,
          { color: isPositive ? theme.colors.success : theme.colors.destructive }
        ]}>
          {formatPriceChange(changeAmount)}
        </Text>
        
        <View style={[
          styles.changePercentContainer,
          { backgroundColor: isPositive ? theme.colors.successBackground : theme.colors.destructiveBackground }
        ]}>
          <Text style={[
            styles.changePercent,
            { color: isPositive ? theme.colors.success : theme.colors.destructive }
          ]}>
            {formatPercentChange(changePercent)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.lg,
  },
  priceContainer: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  currentPrice: {
    color: theme.colors.foreground,
    fontSize: 36,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 40,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeAmount: {
    fontSize: 17,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginRight: theme.spacing.sm,
  },
  changePercentContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  changePercent: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
});