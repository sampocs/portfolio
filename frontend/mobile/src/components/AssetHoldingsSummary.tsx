import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency, formatTradeDate } from '../styles/utils';
import { isClosedPosition } from '../constants';
import { AssetHoldings } from '../data/assetTypes';
import ExpandableGains from './ExpandableGains';

interface AssetHoldingsSummaryProps {
  symbol: string;
  holdings: AssetHoldings;
  isLoading?: boolean;
}

// Percent of total cash invested that a given gain/loss represents (0 when nothing was invested).
function percentOfInvested(amount: number, invested: number): number {
  return invested > 0 ? (amount / invested) * 100 : 0;
}

// Quantity formatted with up to 4 decimals (toLocaleString already omits trailing
// fractional zeros, so no extra stripping is needed).
function formatOwned(value: number): string {
  return value.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

// A currency amount with an explicit "+" prefix for non-negative values (formatCurrency
// already renders the "-" for negative ones).
function signedCurrency(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value)}`;
}

// One-decimal signed percentage for the Market Value sub-line (±x.x%), distinct from
// formatPercentage's two decimals used elsewhere.
function signedPercent1dp(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

// Lifetime strip detail: open assets just show the trade count, closed assets add
// either the sell-out date (nothing left) or the leftover dust (still holding some).
function formatLifetimeDetail(symbol: string, holdings: AssetHoldings): string {
  const { tradeCount, owned, marketValue, lastSellDate } = holdings;
  const tradesLabel = `${tradeCount} trades`;

  if (!isClosedPosition(marketValue)) {
    return tradesLabel;
  }

  if (owned === 0) {
    return lastSellDate ? `${tradesLabel} · sold out ${formatTradeDate(lastSellDate)}` : tradesLabel;
  }

  return `${tradesLabel} · ${formatOwned(owned)} ${symbol} left (${formatCurrency(marketValue)})`;
}

export default function AssetHoldingsSummary({ symbol, holdings, isLoading = false }: AssetHoldingsSummaryProps) {
  const {
    owned,
    averagePrice,
    costBasis,
    marketValue,
    unrealized,
    invested,
    sold,
    netInvested,
    realized,
    totalReturn,
    totalReturnPercent,
  } = holdings;
  const [isGainsExpanded, setIsGainsExpanded] = React.useState(false);

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Holdings</Text>

        <View style={styles.card}>
          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>Position</Text>
            <Text style={styles.stripDetail}>---.--</Text>
          </View>
          <View style={styles.columnsContainer}>
            <View style={styles.column}>
              <View style={[styles.summaryItem, styles.lastItem]}>
                <Text style={styles.summaryLabel}>Cost Basis</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={[styles.summaryItem, styles.lastItem]}>
                <Text style={styles.summaryLabel}>Market Value</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.stripRow}>
            <Text style={styles.stripLabel}>Lifetime</Text>
            <Text style={styles.stripDetail}>---.--</Text>
          </View>
          <View style={styles.columnsContainer}>
            <View style={styles.column}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Invested</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
              <View style={[styles.summaryItem, styles.lastItem]}>
                <Text style={styles.summaryLabel}>Net Invested</Text>
                <Text style={styles.summaryValue}>---.--</Text>
              </View>
            </View>
            <View style={styles.column}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>Sold</Text>
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

  const closed = isClosedPosition(marketValue);
  const unrealizedPercent = costBasis !== 0 ? (unrealized / costBasis) * 100 : 0;
  const unrealizedColor = unrealized >= 0 ? theme.colors.success : theme.colors.destructive;
  const netInvestedIsHouseMoney = netInvested < 0;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Holdings</Text>

      <View style={styles.card}>
        {!closed && (
          <>
            <View style={styles.stripRow}>
              <Text style={styles.stripLabel}>Position</Text>
              <Text style={styles.stripDetail}>{formatOwned(owned)} {symbol}</Text>
            </View>
            <View style={styles.columnsContainer}>
              <View style={styles.column}>
                <View style={[styles.summaryItem, styles.lastItem]}>
                  <Text style={styles.summaryLabel}>Cost Basis</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(costBasis)}</Text>
                  <Text style={styles.summarySubLine}>avg {formatCurrency(averagePrice)}</Text>
                </View>
              </View>
              <View style={styles.column}>
                <View style={[styles.summaryItem, styles.lastItem]}>
                  <Text style={styles.summaryLabel}>Market Value</Text>
                  <Text style={styles.summaryValue}>{formatCurrency(marketValue)}</Text>
                  <Text style={[styles.summarySubLine, { color: unrealizedColor }]}>
                    {signedCurrency(unrealized)} · {signedPercent1dp(unrealizedPercent)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />
          </>
        )}

        <View style={styles.stripRow}>
          <Text style={styles.stripLabel}>Lifetime</Text>
          <Text style={styles.stripDetail}>{formatLifetimeDetail(symbol, holdings)}</Text>
        </View>
        <View style={styles.columnsContainer}>
          <View style={styles.column}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Invested</Text>
              <Text style={styles.summaryValue}>{formatCurrency(invested)}</Text>
            </View>
            <View style={[styles.summaryItem, styles.lastItem]}>
              <Text style={styles.summaryLabel}>Net Invested</Text>
              <Text style={[styles.summaryValue, netInvestedIsHouseMoney && { color: theme.colors.success }]}>
                {formatCurrency(netInvested)}
              </Text>
              {netInvestedIsHouseMoney && (
                <Text style={[styles.summarySubLine, { color: theme.colors.success }]}>house money</Text>
              )}
            </View>
          </View>

          <View style={styles.column}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sold</Text>
              <Text style={styles.summaryValue}>{formatCurrency(sold)}</Text>
            </View>
            <View style={[styles.summaryItem, styles.lastItem]}>
              <ExpandableGains
                totalReturn={totalReturn}
                totalReturnPercent={totalReturnPercent}
                realizedGains={realized}
                unrealizedGains={unrealized}
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
                  { color: realized >= 0 ? theme.colors.success : theme.colors.destructive }
                ]}>
                  {formatCurrency(realized)}
                </Text>
                <Text style={styles.breakdownPercent}>
                  {(percentOfInvested(realized, invested) >= 0 ? '+' : '')}{percentOfInvested(realized, invested).toFixed(1)}%
                </Text>
              </View>
            </View>

            <View style={styles.breakdownRow}>
              <Text style={styles.breakdownLabel}>Unrealized</Text>
              <View style={styles.breakdownRight}>
                <Text style={[
                  styles.breakdownValue,
                  { color: unrealized >= 0 ? theme.colors.success : theme.colors.destructive }
                ]}>
                  {formatCurrency(unrealized)}
                </Text>
                <Text style={styles.breakdownPercent}>
                  {(percentOfInvested(unrealized, invested) >= 0 ? '+' : '')}{percentOfInvested(unrealized, invested).toFixed(1)}%
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
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  stripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  stripLabel: {
    color: theme.colors.muted,
    textTransform: 'uppercase',
    ...getTextStyle('xs', 'semibold'),
  },
  stripDetail: {
    color: theme.colors.muted,
    ...getTextStyle('xs', 'medium'),
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: theme.spacing.md,
  },
  columnsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  column: {
    alignItems: 'flex-start',
    minWidth: 180,
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
  summarySubLine: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
    marginTop: theme.spacing.xs,
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
