import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { CategoryAllocation } from '../data/types';
import { getCategoryColor } from '../data/utils';

interface CategoryLegendProps {
  categories: CategoryAllocation[];
}

interface LegendRowProps {
  category: CategoryAllocation;
  isFirst?: boolean;
  isLast?: boolean;
}

function LegendRow({ category, isFirst = false, isLast = false }: LegendRowProps) {
  const color = getCategoryColor(category.category);
  const isOverAllocated = category.percentageDelta > 0;
  // Green for overallocated, red for underallocated
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Calculate target dollar value for display
  const targetValue = category.currentValue - category.dollarDelta;

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
        <Text style={styles.categoryName}>{category.category}</Text>
      </View>
      
      <View style={styles.rightSection}>
        <View style={styles.percentageSection}>
          <Text style={styles.allocationText}>
            {category.currentAllocation.toFixed(1)}% → {category.targetAllocation.toFixed(1)}%
          </Text>
        </View>
        
        <View style={styles.valueSection}>
          <Text style={styles.valueText}>
            {formatCurrency(category.currentValue)} → {formatCurrency(targetValue)}
          </Text>
        </View>
        
        <View style={styles.deltaSection}>
          <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {isOverAllocated ? '+' : ''}{formatCurrency(category.dollarDelta)} ({isOverAllocated ? '+' : ''}{category.percentageDelta.toFixed(1)}%)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function CategoryLegend({ categories }: CategoryLegendProps) {
  return (
    <View style={styles.container}>
      {categories.map((category, index) => (
        <LegendRow 
          key={`${category.category}-${index}`} 
          category={category}
          isFirst={index === 0}
          isLast={index === categories.length - 1}
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