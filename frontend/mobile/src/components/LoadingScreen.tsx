import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

interface LoadingScreenProps {
  title: string; // "Portfolio" or "Allocations"
}

export default function LoadingScreen({ title }: LoadingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const createPulseAnimation = () => {
      return Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]);
    };

    const loopAnimation = Animated.loop(createPulseAnimation());
    loopAnimation.start();

    return () => loopAnimation.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>{title}</Text>
      </View>
      
      <View style={styles.content}>
        {/* Category selector placeholder */}
        <View style={styles.categorySection}>
          <View style={styles.buttonRow}>
            <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            {title === 'Allocations' && (
              <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            )}
          </View>
        </View>

        {title === 'Portfolio' ? (
          <>
            {/* Summary placeholder */}
            <View style={styles.summarySection}>
              <Animated.View style={[styles.summaryLabel, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.summaryValue, { opacity: pulseAnim }]} />
              <Animated.View style={[styles.summarySubtext, { opacity: pulseAnim }]} />
            </View>

            {/* Chart placeholder */}
            <Animated.View style={[styles.chartPlaceholder, { opacity: pulseAnim }]} />

            {/* Duration buttons placeholder */}
            <View style={styles.durationSection}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Animated.View 
                  key={index} 
                  style={[styles.durationButton, { opacity: pulseAnim }]} 
                />
              ))}
            </View>

            {/* Asset list placeholder */}
            <View style={styles.assetListSection}>
              {Array.from({ length: 4 }).map((_, index) => (
                <Animated.View 
                  key={index} 
                  style={[styles.assetRow, { opacity: pulseAnim }]} 
                />
              ))}
            </View>
          </>
        ) : (
          <>
            {/* Donut chart placeholder */}
            <Animated.View style={[styles.donutChartPlaceholder, { opacity: pulseAnim }]} />

            {/* Legend placeholder */}
            <View style={styles.legendSection}>
              {Array.from({ length: 3 }).map((_, index) => (
                <Animated.View 
                  key={index} 
                  style={[styles.legendRow, { opacity: pulseAnim }]} 
                />
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
}

// Custom lighter skeleton color for better contrast
const skeletonColor = '#404040'; // Much lighter gray for better visibility

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  headerText: {
    color: theme.colors.foreground,
    ...getTextStyle('xxl', 'bold'),
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xs,
  },
  
  // Category section
  categorySection: {
    marginBottom: theme.spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  button: {
    width: 80,
    height: 32,
    backgroundColor: skeletonColor,
    borderRadius: 20,
  },

  // Portfolio-specific placeholders
  summarySection: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  summaryLabel: {
    width: 100,
    height: 16,
    backgroundColor: skeletonColor,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    width: 200,
    height: 32,
    backgroundColor: skeletonColor,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  summarySubtext: {
    width: 150,
    height: 16,
    backgroundColor: skeletonColor,
    borderRadius: 4,
  },
  chartPlaceholder: {
    height: 200,
    backgroundColor: skeletonColor,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.lg,
  },
  durationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.md,
  },
  durationButton: {
    width: 50,
    height: 28,
    backgroundColor: skeletonColor,
    borderRadius: 14,
  },
  assetListSection: {
    gap: theme.spacing.sm,
  },
  assetRow: {
    height: 60,
    backgroundColor: skeletonColor,
    borderRadius: theme.borderRadius.md,
  },

  // Allocations-specific placeholders
  donutChartPlaceholder: {
    width: 258, // Match SVG_SIZE from DonutChart
    height: 258,
    backgroundColor: skeletonColor,
    borderRadius: 129, // Half of width for circle
    alignSelf: 'center',
    marginVertical: theme.spacing.xs,
  },
  legendSection: {
    marginTop: theme.spacing.md - 4, // Match AllocationLegend margin
    gap: 0,
  },
  legendRow: {
    height: 72, // Match AllocationLegend row height
    backgroundColor: skeletonColor,
    borderRadius: 0,
  },
});