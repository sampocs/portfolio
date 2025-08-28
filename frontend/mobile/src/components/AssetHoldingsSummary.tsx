import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency, formatPercentage } from '../styles/utils';
import { AssetHoldings } from '../data/assetTypes';
import ExpandableGains from './ExpandableGains';

interface AssetHoldingsSummaryProps {
  holdings: AssetHoldings;
  isLoading?: boolean;
}

export default function AssetHoldingsSummary({ holdings, isLoading = false }: AssetHoldingsSummaryProps) {
  const { netInvested, currentValue, totalReturn, totalReturnPercent, totalQuantity, realizedGains, unrealizedGains } = holdings;
  const isPositiveReturn = totalReturn >= 0;
  const [isGainsExpanded, setIsGainsExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Holdings</Text>
        
        <View style={styles.summaryGrid}>
          <View style={styles.columnsContainer}>
            <View style={styles.leftColumn}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Net Invested</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
              <View style={[styles.summaryItem, styles.lastItem]}>
                <Text style={styles.summaryLabel}>Owned</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
            </View>
            
            <View style={styles.rightColumn}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Market Value</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
              <View style={[styles.summaryItem, styles.lastItem]}>
                <Text style={styles.summaryLabel}>Total Gains</Text>
                <View style={styles.combinedGainsContainer}>
                  <Text style={[styles.summaryValue, { color: theme.colors.muted }]}>
                    +$--.--
                  </Text>
                  <View style={[styles.returnPercentContainer, { backgroundColor: theme.colors.card }]}>
                    <Text style={[styles.returnPercent, { color: theme.colors.muted }]}>
                      +--.--% 
                    </Text>
                  </View>
                </View>
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
        <View style={styles.columnsContainer}>
          <View style={styles.leftColumn}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Net Invested</Text>
              <Text style={[
                styles.summaryValue,
                netInvested < 0 && { color: theme.colors.success } // Green when negative (house money)
              ]}>
                {formatCurrency(netInvested)}
              </Text>
            </View>
            <View style={[styles.summaryItem, styles.lastItem]}>
              <Text style={styles.summaryLabel}>Owned</Text>
              <Text style={styles.summaryValue}>
                {totalQuantity.toLocaleString('en-US', { maximumFractionDigits: 4 }).replace(/\.?0+$/, '')}
              </Text>
            </View>
          </View>
          
          <View style={styles.rightColumn}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Market Value</Text>
              <Text style={styles.summaryValue}>
                {formatCurrency(currentValue)}
              </Text>
            </View>
            <View style={[styles.summaryItem, styles.lastItem]}>
              <ExpandableGains
                totalReturn={totalReturn}
                totalReturnPercent={totalReturnPercent}
                realizedGains={realizedGains}
                unrealizedGains={unrealizedGains}
                netInvested={netInvested}
                onExpandChange={setIsGainsExpanded}
              />
            </View>
          </View>
        </View>
        
        {/* Expandable breakdown section */}
        {isGainsExpanded && (
          <View style={styles.expandedBreakdown}>
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Realized</Text>
              <View style={styles.breakdownRight}>
                <Text style={[
                  styles.breakdownValue,
                  { color: realizedGains >= 0 ? theme.colors.success : theme.colors.destructive }
                ]}>
                  {formatCurrency(realizedGains)}
                </Text>
                <Text style={styles.breakdownPercent}>
                  {((Math.abs(netInvested) > 0 ? (realizedGains / Math.abs(netInvested)) * 100 : 0) >= 0 ? '+' : '')}{(Math.abs(netInvested) > 0 ? (realizedGains / Math.abs(netInvested)) * 100 : 0).toFixed(1)}%
                </Text>
              </View>
            </View>
            
            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Unrealized</Text>
              <View style={styles.breakdownRight}>
                <Text style={[
                  styles.breakdownValue,
                  { color: unrealizedGains >= 0 ? theme.colors.success : theme.colors.destructive }
                ]}>
                  {formatCurrency(unrealizedGains)}
                </Text>
                <Text style={styles.breakdownPercent}>
                  {((Math.abs(netInvested) > 0 ? (unrealizedGains / Math.abs(netInvested)) * 100 : 0) >= 0 ? '+' : '')}{(Math.abs(netInvested) > 0 ? (unrealizedGains / Math.abs(netInvested)) * 100 : 0).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}
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
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftColumn: {
    alignItems: 'flex-start',
  },
  rightColumn: {
    alignItems: 'flex-start',
    minWidth: 180,
  },
  expandableGainsContainer: {
    marginTop: theme.spacing.md,
  },
  summaryItem: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  lastItem: {
    marginBottom: 0,
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
  combinedGainsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  returnPercentContainer: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  returnPercent: {
    ...getTextStyle('sm', 'bold'),
  },
  expandedBreakdown: {
    marginTop: theme.spacing.md,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.md,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  breakdownLabel: {
    ...getTextStyle('sm', 'normal'),
    color: theme.colors.muted,
  },
  breakdownRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownValue: {
    ...getTextStyle('sm', 'medium'),
  },
  breakdownPercent: {
    ...getTextStyle('xs', 'normal'),
    color: theme.colors.muted,
    minWidth: 50,
    textAlign: 'right',
  },
});