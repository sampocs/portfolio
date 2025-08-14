import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { MarketAllocation } from '../data/types';
import { getMarketColor } from '../data/utils';

interface MarketLegendProps {
  markets: MarketAllocation[];
}

interface LegendRowProps {
  market: MarketAllocation;
  isFirst?: boolean;
  isLast?: boolean;
}

function LegendRow({ market, isFirst = false, isLast = false }: LegendRowProps) {
  const color = getMarketColor(market.market);
  const isOverAllocated = market.percentageDelta > 0;
  // Over-allocated (positive delta) = green, Under-allocated (negative delta) = red
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Calculate target dollar value for display
  const targetValue = market.currentValue - market.dollarDelta;

  // Dynamic container style based on position
  const containerStyle = [
    styles.legendRow,
    isFirst && styles.firstRow,
    isLast && styles.lastRow,
    !isLast && styles.separatorRow,
  ];

  return (
    <View style={containerStyle}>
      <View style={styles.leftSection}>
        <View style={[styles.colorIndicator, { backgroundColor: color }]} />
        <Text style={styles.categoryName}>{market.market}</Text>
      </View>
      
      <View style={styles.rightSection}>
        <View style={styles.percentageSection}>
          <Text style={styles.allocationText}>
            {market.currentAllocation.toFixed(1)}% → {market.targetAllocation.toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.valueSection}>
          <Text style={styles.valueText}>
            {formatCurrency(market.currentValue)} → {formatCurrency(targetValue)}
          </Text>
        </View>
        
        <View style={styles.deltaSection}>
          <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {market.dollarDelta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(market.dollarDelta))} ({market.percentageDelta >= 0 ? '+' : '-'}{Math.abs(market.percentageDelta).toFixed(1)}%)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function MarketLegend({ markets }: MarketLegendProps) {
  return (
    <View style={styles.container}>
      {markets.map((market, index) => (
        <LegendRow 
          key={`${market.market}-${index}`} 
          market={market}
          isFirst={index === 0}
          isLast={index === markets.length - 1}
        />
      ))}
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'semibold'),
    marginBottom: theme.spacing.md,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.colors.card,
    borderRadius: 0,
    marginBottom: 0,
  },
  firstRow: {
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  lastRow: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  separatorRow: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.md,
  },
  categoryName: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'semibold'),
    flex: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    flex: 1.5,
  },
  percentageSection: {
    marginBottom: 3,
  },
  allocationText: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
  },
  valueSection: {
    marginBottom: 3,
  },
  valueText: {
    color: theme.colors.foreground,
    ...getTextStyle('xs'),
  },
  deltaSection: {
    alignItems: 'flex-end',
  },
  deltaContainer: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 3,
    borderRadius: theme.borderRadius.sm,
  },
  deltaText: {
    ...getTextStyle('xs', 'semibold'),
  },
});