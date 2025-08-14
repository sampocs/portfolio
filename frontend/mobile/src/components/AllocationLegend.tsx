import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { GenericAllocation } from '../data/types';

interface AllocationLegendProps<T extends GenericAllocation> {
  data: T[];
  getColor: (name: string) => string;
}

interface LegendRowProps<T extends GenericAllocation> {
  item: T;
  getColor: (name: string) => string;
  isFirst?: boolean;
  isLast?: boolean;
}

function LegendRow<T extends GenericAllocation>({ 
  item, 
  getColor, 
  isFirst = false, 
  isLast = false 
}: LegendRowProps<T>) {
  const color = getColor(item.name);
  const isOverAllocated = item.percentageDelta > 0;
  // Over-allocated (positive delta) = green, Under-allocated (negative delta) = red
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Calculate target dollar value for display
  const targetValue = item.currentValue - item.dollarDelta;

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
        <Text style={styles.itemName}>{item.name}</Text>
      </View>
      
      <View style={styles.rightSection}>
        <View style={styles.percentageSection}>
          <Text style={styles.allocationText}>
            {item.currentAllocation.toFixed(1)}% → {item.targetAllocation.toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.valueSection}>
          <Text style={styles.valueText}>
            {formatCurrency(item.currentValue)} → {formatCurrency(targetValue)}
          </Text>
        </View>
        
        <View style={styles.deltaSection}>
          <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {item.dollarDelta >= 0 ? '+' : '-'}{formatCurrency(Math.abs(item.dollarDelta))} ({item.percentageDelta >= 0 ? '+' : '-'}{Math.abs(item.percentageDelta).toFixed(1)}%)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function AllocationLegend<T extends GenericAllocation>({ 
  data, 
  getColor 
}: AllocationLegendProps<T>) {
  return (
    <View style={styles.container}>
      {data.map((item, index) => (
        <LegendRow 
          key={`${item.name}-${index}`} 
          item={item}
          getColor={getColor}
          isFirst={index === 0}
          isLast={index === data.length - 1}
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
  itemName: {
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