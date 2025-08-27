import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { AssetTrade } from '../data/assetTypes';
import TradeRow from './TradeRow';

interface TradesListProps {
  trades: AssetTrade[];
  isLoading?: boolean;
}

export default function TradesList({ trades, isLoading = false }: TradesListProps) {
  // Sort trades by date (newest first)
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Trades</Text>
        
        <View style={styles.tradesList}>
          {/* Loading skeleton */}
          {[1, 2, 3].map((_, index) => (
            <View
              key={index}
              style={[
                styles.loadingRow,
                index === 0 && styles.firstContainer,
                index === 2 && styles.lastContainer,
                index < 2 && styles.separatorContainer,
              ]}
            >
              <View style={styles.loadingLeftSection}>
                <View style={styles.loadingBadge} />
                <View style={styles.loadingInfo}>
                  <View style={styles.loadingText} />
                  <View style={[styles.loadingText, styles.loadingTextSmall]} />
                </View>
              </View>
              <View style={styles.loadingValue} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (trades.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Trades</Text>
        
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No trades found</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Trades</Text>
      
      <View style={styles.tradesList}>
        {sortedTrades.map((trade, index) => (
          <TradeRow
            key={`${trade.date}-${trade.action}-${index}`}
            trade={trade}
            isFirst={index === 0}
            isLast={index === sortedTrades.length - 1}
          />
        ))}
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
  tradesList: {
    // Container for trade rows
  },
  emptyState: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  emptyStateText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
  },
  // Loading states
  loadingRow: {
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
  loadingLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  loadingBadge: {
    width: 50,
    height: 24,
    backgroundColor: theme.colors.accent,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.md,
  },
  loadingInfo: {
    flex: 1,
  },
  loadingText: {
    height: 16,
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
    marginBottom: 4,
    width: '60%',
  },
  loadingTextSmall: {
    height: 12,
    width: '80%',
  },
  loadingValue: {
    width: 80,
    height: 16,
    backgroundColor: theme.colors.accent,
    borderRadius: 2,
  },
});