import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated } from 'react-native';
import { RefreshCcw } from 'lucide-react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency, formatPercentage } from '../styles/utils';

interface PortfolioSummaryProps {
  totalValue: number;
  totalReturn: number;
  totalReturnPercent: number;
  selectedDate?: string;
  onSyncPress?: () => void;
  isSyncing?: boolean;
}

/**
 * PortfolioSummary - Displays portfolio's total worth and performance metrics
 * 
 * Shows the total portfolio value, absolute and percentage returns,
 * with optional selected date for point-in-time data display.
 */
export default function PortfolioSummary({ totalValue, totalReturn, totalReturnPercent, selectedDate, onSyncPress, isSyncing = false }: PortfolioSummaryProps) {
  const isPositiveReturn = totalReturn >= 0;
  const spinValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSyncing) {
      const spinAnimation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
      return () => spinAnimation.stop();
    } else {
      spinValue.setValue(0);
    }
  }, [isSyncing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });
  
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Total Worth</Text>
      
      <View style={styles.valueContainer}>
        <View style={styles.valueAndCurrency}>
          <Text style={styles.totalValue}>{formatCurrency(totalValue).replace('$', '')}</Text>
          <Text style={styles.currency}>USD</Text>
        </View>
        {onSyncPress && (
          <TouchableOpacity
            style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
            onPress={isSyncing ? undefined : onSyncPress}
            activeOpacity={isSyncing ? 1 : 0.7}
            disabled={isSyncing}
          >
            <Animated.View style={isSyncing ? { transform: [{ rotate: spin }] } : undefined}>
              <RefreshCcw 
                size={28} 
                color={theme.colors.muted}
              />
            </Animated.View>
          </TouchableOpacity>
        )}
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
    marginBottom: theme.spacing.md,
  },
  label: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    marginBottom: theme.spacing.xs,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
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
  valueAndCurrency: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  syncButton: {
    padding: theme.spacing.xs,
    borderRadius: 8,
    alignSelf: 'center',
    marginBottom: theme.spacing.xs, // Offset to align with center of large value text
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
});