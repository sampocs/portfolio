import React from 'react';
import { View, Text } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export default function AssetChartLegend() {
  const currentColor = '#07BADA';
  const targetColor = '#8B5CF6';

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
    marginBottom: theme.spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xl,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: theme.spacing.sm,
  },
  labelText: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'medium'),
  },
});