import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency, formatPercentage } from '../styles/utils';

interface SummaryProps {
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  selectedDate?: string;
}

export default function Summary({ totalValue, totalReturn, totalReturnPercent, selectedDate }: SummaryProps) {
  const isPositiveReturn = totalReturn >= 0;
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Worth</Text>
      
      <View style={styles.valueContainer}>
        <Text style={styles.totalValue}>{formatCurrency(totalValue).replace('$', '')}</Text>
        <Text style={styles.currency}>USD</Text>
      </View>
      
      <View style={styles.returnsContainer}>
        <Text style={[
          styles.returnDollar,
          { color: isPositiveReturn ? theme.colors.success : theme.colors.destructive }
        ]}>
          {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
        </Text>
        
        <View style={[
          styles.returnPercentContainer,
          { backgroundColor: isPositiveReturn ? theme.colors.successBackground : theme.colors.destructiveBackground }
        ]}>
          <Text style={[
            styles.returnPercent,
            { color: isPositiveReturn ? theme.colors.success : theme.colors.destructive }
          ]}>
            {formatPercentage(totalReturnPercent)}
          </Text>
        </View>
      </View>
      
      <View style={styles.dateContainer}>
        <Text style={styles.selectedDate}>
          {selectedDate || ' '}
        </Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.xl,
  },
  label: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    marginBottom: theme.spacing.xs,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  totalValue: {
    color: theme.colors.foreground,
    fontSize: 40,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 44,
  },
  currency: {
    color: theme.colors.muted,
    fontSize: 14,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginLeft: theme.spacing.xs,
    marginBottom: theme.spacing.xs,
  },
  returnsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  returnDollar: {
    fontSize: 17,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginRight: theme.spacing.sm,
  },
  returnPercentContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  returnPercent: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  dateContainer: {
    marginTop: theme.spacing.xs,
    minHeight: 16, // Reserve space for the date text (based on small text line height)
  },
  selectedDate: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
  },
});