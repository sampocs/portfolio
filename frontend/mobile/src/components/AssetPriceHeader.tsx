import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { AssetPriceChange } from '../data/assetTypes';

interface AssetPriceHeaderProps {
  priceChange: AssetPriceChange;
  isLoading?: boolean;
  isDeltaLoading?: boolean;
  selectedDate?: string;
  updatedAt?: string;
}

export default function AssetPriceHeader({ priceChange, isLoading = false, isDeltaLoading = false, selectedDate, updatedAt }: AssetPriceHeaderProps) {
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
    const sign = change >= 0 ? '+' : '-';
    return `${sign}${Math.abs(change).toFixed(2)}`;
  };

  const formatPercentChange = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const formatSelectedDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const formatUpdatedAt = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    return `${month} ${day}, ${time}`;
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
        {isDeltaLoading ? (
          <>
            <Text style={[styles.changeAmount, { color: theme.colors.muted }]}>
              +$--.--
            </Text>
            
            <View style={[styles.changePercentContainer, { backgroundColor: theme.colors.card }]}>
              <Text style={[styles.changePercent, { color: theme.colors.muted }]}>
                +--.--% 
              </Text>
            </View>
          </>
        ) : (
          <>
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
          </>
        )}
      </View>
      
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          {selectedDate ? formatSelectedDate(selectedDate) : 
           updatedAt ? formatUpdatedAt(updatedAt) : ' '}
        </Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.md,
  },
  priceContainer: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
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
  dateContainer: {
    marginTop: theme.spacing.xs,
    minHeight: 16,
  },
  dateText: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
  },
});