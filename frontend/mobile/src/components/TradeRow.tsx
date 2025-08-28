import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { AssetTrade } from '../data/assetTypes';

interface TradeRowProps {
  trade: AssetTrade;
  isFirst?: boolean;
  isLast?: boolean;
}

export default function TradeRow({ trade, isFirst = false, isLast = false }: TradeRowProps) {
  const { action, date, quantity, price } = trade;
  const quantityNum = parseFloat(quantity);
  const priceNum = parseFloat(price);
  const totalValue = quantityNum * priceNum;
  
  const isBuy = action === 'BUY';
  const actionColor = isBuy ? theme.colors.success : theme.colors.destructive;

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatQuantity = (value: number): string => {
    return value.toFixed(4).replace(/\.?0+$/, '');
  };

  const formatPrice = (value: number): string => {
    if (value >= 1000) {
      return value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value.toFixed(2);
  };

  // Dynamic container style based on position
  const containerStyle = [
    styles.container,
    isFirst && styles.firstContainer,
    isLast && styles.lastContainer,
    !isLast && styles.separatorContainer,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.leftSection}>
        <View style={[styles.actionBadge, { backgroundColor: actionColor + '20' }]}>
          <Text style={[styles.actionText, { color: actionColor }]}>
            {action}
          </Text>
        </View>
        
        <View style={styles.tradeInfo}>
          <Text style={styles.date}>{formatDate(date)}</Text>
          <Text style={styles.details}>
            {formatQuantity(quantityNum)} @ ${formatPrice(priceNum)}
          </Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <Text style={styles.totalValue}>
          {formatCurrency(totalValue)}
        </Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  firstContainer: {
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  lastContainer: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  separatorContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
    minWidth: 50,
    alignItems: 'center',
  },
  actionText: {
    ...getTextStyle('xs', 'bold'),
    fontSize: 11,
  },
  tradeInfo: {
    flex: 1,
  },
  date: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: theme.typography.weights.semibold,
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
});