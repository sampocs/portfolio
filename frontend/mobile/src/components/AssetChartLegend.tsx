import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export default function AssetChartLegend() {
  return (
    <View style={styles.container}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.currentIndicators}>
            <View style={[styles.colorIndicator, { backgroundColor: theme.colors.success }]} />
            <View style={[styles.colorIndicator, styles.secondIndicator, { backgroundColor: theme.colors.destructive }]} />
          </View>
          <Text style={styles.labelText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorIndicator, { backgroundColor: theme.colors.allocationTarget }]} />
          <Text style={styles.labelText}>Target</Text>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginTop: theme.spacing.md,
    marginBottom: 0,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: theme.spacing.xs,
  },
  labelText: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'medium'),
  },
  currentIndicators: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.spacing.xs,
  },
  secondIndicator: {
    marginLeft: -2, // Slight overlap for compact display
  },
});