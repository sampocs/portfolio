import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { getTextStyle, formatCurrency, formatPercentage } from '../styles/utils';
import { Ionicons } from '@expo/vector-icons';

interface ExpandableGainsProps {
  totalReturn: number;
  totalReturnPercent: number;
  realizedGains: number;
  unrealizedGains: number;
  netInvested: number;
  onExpandChange?: (isExpanded: boolean) => void;
}

export default function ExpandableGains({
  totalReturn,
  totalReturnPercent,
  onExpandChange
}: ExpandableGainsProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isPositiveReturn = totalReturn >= 0;

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onExpandChange?.(newExpanded);
  };

  return (
    <TouchableOpacity onPress={handleToggle} activeOpacity={0.7}>
      <Text style={styles.summaryLabel}>{isPositiveReturn ? 'Total Gains' : 'Total Losses'}</Text>
      <View style={styles.combinedGainsContainer}>
        <Text style={[
          styles.summaryValue,
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
        <Ionicons 
          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
          size={14} 
          color={theme.colors.muted}
          style={styles.chevron}
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = {
  // Original Total Gains styles - copied exactly from AssetHoldingsSummary
  summaryLabel: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'semibold'),
  },
  combinedGainsContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing.sm,
  },
  returnPercentContainer: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start' as const,
  },
  returnPercent: {
    ...getTextStyle('sm', 'bold'),
  },
  chevron: {
    marginLeft: 4,
  },
};