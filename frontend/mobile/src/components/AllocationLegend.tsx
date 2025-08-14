import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { GenericAllocation } from '../data/types';

interface AllocationLegendProps<T extends GenericAllocation> {
  data: T[];
  getColor: (name: string) => string;
  groupingType?: 'markets' | 'segments';
  selectedItem?: T | null;
  onItemSelect?: (item: T | null) => void;
}

interface LegendRowProps<T extends GenericAllocation> {
  item: T;
  getColor: (name: string) => string;
  isFirst?: boolean;
  isLast?: boolean;
  groupingType?: 'markets' | 'segments';
  selectedItem?: T | null;
  onItemSelect?: (item: T | null) => void;
}

function LegendRow<T extends GenericAllocation>({ 
  item, 
  getColor, 
  isFirst = false, 
  isLast = false,
  groupingType = 'markets',
  selectedItem,
  onItemSelect
}: LegendRowProps<T>) {
  const color = getColor(item.name);
  const isOverAllocated = item.percentageDelta > 0;
  // Over-allocated (positive delta) = green, Under-allocated (negative delta) = red
  const deltaColor = isOverAllocated ? theme.colors.success : theme.colors.destructive;
  const deltaBackgroundColor = isOverAllocated ? theme.colors.successBackground : theme.colors.destructiveBackground;

  // Calculate target dollar value for display
  const targetValue = item.currentValue - item.dollarDelta;

  // Check if this item is selected
  const isSelected = selectedItem?.name === item.name;

  // Handle touch events
  const handlePress = () => {
    if (onItemSelect) {
      // Toggle selection: if already selected, deselect; otherwise select this item
      onItemSelect(isSelected ? null : item);
    }
  };

  // Dynamic container style based on position, grouping type, and selection
  const containerStyle = [
    styles.legendRow,
    groupingType === 'segments' && styles.segmentsRow,
    isFirst && styles.firstRow,
    isLast && styles.lastRow,
    !isLast && styles.separatorRow,
    isSelected && styles.selectedRow,
  ];

  return (
    <TouchableOpacity 
      style={containerStyle}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.leftSection}>
        <View style={[styles.colorIndicator, { backgroundColor: color }]} />
        <View style={styles.nameAndPercentageContainer}>
          <Text style={[
            styles.itemName,
            groupingType === 'markets' && styles.marketItemName
          ]}>{item.name}</Text>
          <Text style={styles.allocationText}>
            {item.currentAllocation.toFixed(1)}% → {item.targetAllocation.toFixed(1)}%
          </Text>
        </View>
      </View>
      
      <View style={styles.rightSection}>
        <View style={styles.valueSection}>
          <Text style={styles.valueText}>
            ${Math.round(item.currentValue).toLocaleString()} → ${Math.round(targetValue).toLocaleString()}
          </Text>
        </View>
        
        <View style={styles.deltaSection}>
          <View style={[styles.deltaContainer, { backgroundColor: deltaBackgroundColor }]}>
            <Text style={[styles.deltaText, { color: deltaColor }]}>
              {item.dollarDelta >= 0 ? '+' : '-'}${Math.round(Math.abs(item.dollarDelta)).toLocaleString()} ({item.percentageDelta >= 0 ? '+' : '-'}{Math.round(Math.abs(item.percentageDelta))}%)
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function AllocationLegend<T extends GenericAllocation>({ 
  data, 
  getColor,
  groupingType = 'markets',
  selectedItem,
  onItemSelect
}: AllocationLegendProps<T>) {
  return (
    <View style={[
      styles.container,
      groupingType === 'segments' && styles.segmentsContainer
    ]}>
      {data.map((item, index) => (
        <LegendRow 
          key={`${item.name}-${index}`} 
          item={item}
          getColor={getColor}
          isFirst={index === 0}
          isLast={index === data.length - 1}
          groupingType={groupingType}
          selectedItem={selectedItem}
          onItemSelect={onItemSelect}
        />
      ))}
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.md - 4, // Reduced by 4px to offset chart size increase
  },
  segmentsContainer: {
    marginTop: theme.spacing.xs - 4, // Reduced by 4px to offset chart size increase
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
    paddingVertical: theme.spacing.xl,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.card,
    borderRadius: 0,
    marginBottom: 0,
  },
  segmentsRow: {
    paddingVertical: theme.spacing.sm + 1, // 9px for segments
    paddingHorizontal: theme.spacing.md,
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
  selectedRow: {
    backgroundColor: theme.colors.accent,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: theme.spacing.lg,
  },
  nameAndPercentageContainer: {
    flex: 1,
  },
  itemName: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'semibold'),
    marginBottom: 4,
  },
  allocationText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
  },
  rightSection: {
    alignItems: 'flex-end',
    flex: 1.2, // Slightly reduced since we moved percentages to left
  },
  valueSection: {
    marginBottom: 6,
  },
  valueText: {
    color: theme.colors.foreground,
    ...getTextStyle('md'),
  },
  deltaSection: {
    alignItems: 'flex-end',
  },
  deltaContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  deltaText: {
    ...getTextStyle('md', 'semibold'),
  },
  // Markets-specific minimal font improvements
  marketItemName: {
    ...getTextStyle('lg', 'bold'), // Larger size for market names
  },
});