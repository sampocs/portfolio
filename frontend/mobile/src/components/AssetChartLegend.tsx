import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export default function AssetChartLegend() {
  const currentColor = theme.colors.allocationCurrent;
  const targetColor = theme.colors.allocationTarget;

  return (
    <View style={styles.container}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.colorIndicator, { backgroundColor: currentColor }]} />
          <Text style={styles.labelText}>Current</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorIndicator, { backgroundColor: targetColor }]} />
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
});