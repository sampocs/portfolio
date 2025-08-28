import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency, formatPercentage } from '../styles/utils';
import { AssetHoldings } from '../data/assetTypes';

interface AssetHoldingsSummaryProps {
  holdings: AssetHoldings;
  isLoading?: boolean;
}

export default function AssetHoldingsSummary({ holdings, isLoading = false }: AssetHoldingsSummaryProps) {
  const { totalInvested, currentValue, totalReturn, totalReturnPercent } = holdings;
  const isPositiveReturn = totalReturn >= 0;

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Holdings</Text>
        
        <View style={styles.summaryGrid}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Cost Basis</Text>
              <Text style={styles.summaryValue}>---.--</Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Market Value</Text>
              <Text style={styles.summaryValue}>---.--</Text>
            </View>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Gain/Loss</Text>
              <Text style={[styles.summaryValue, { color: theme.colors.muted }]}>
                +$--.--
              </Text>
            </View>
            
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Return %</Text>
              <View style={[styles.returnPercentContainer, { backgroundColor: theme.colors.card }]}>
                <Text style={[styles.returnPercent, { color: theme.colors.muted }]}>
                  +--.--% 
                </Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Holdings</Text>
      
      <View style={styles.summaryGrid}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Cost Basis</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(totalInvested)}
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Market Value</Text>
            <Text style={styles.summaryValue}>
              {formatCurrency(currentValue)}
            </Text>
          </View>
        </View>
        
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Gain/Loss</Text>
            <Text style={[
              styles.summaryValue,
              { color: isPositiveReturn ? theme.colors.success : theme.colors.destructive }
            ]}>
              {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
            </Text>
          </View>
          
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Return %</Text>
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
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'bold'),
    marginBottom: theme.spacing.md,
  },
  summaryGrid: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'semibold'),
  },
  returnPercentContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  returnPercent: {
    ...getTextStyle('md', 'bold'),
  },
});