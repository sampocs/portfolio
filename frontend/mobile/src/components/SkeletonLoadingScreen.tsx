import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { TIMING, UI, COLORS } from '../constants';

interface SkeletonLoadingScreenProps {
  title: string;
}

/**
 * SkeletonLoadingScreen - Displays animated skeleton UI while content is loading
 * 
 * Shows animated placeholder elements that match the structure of the Portfolio,
 * Watch List, or Allocations screen based on the title prop. Uses pulsing
 * animations to provide visual feedback during data loading.
 */
export default function SkeletonLoadingScreen({ title }: SkeletonLoadingScreenProps) {
  const pulseAnim = useRef(new Animated.Value(UI.LOADING_OPACITY_MIN)).current;

  useEffect(() => {
    const createPulseAnimation = () => {
      return Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: UI.LOADING_OPACITY_MAX,
          duration: TIMING.PULSE_ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: UI.LOADING_OPACITY_MIN,
          duration: TIMING.PULSE_ANIMATION_DURATION,
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
        {/* The watch list has no category segments, so it starts at the duration row */}
        {title !== 'Watch List' && (
        <View style={styles.categorySection}>
          <View style={styles.buttonRow}>
            <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            {title === 'Allocations' && (
              <Animated.View style={[styles.button, { opacity: pulseAnim }]} />
            )}
          </View>
        </View>
        )}

        {title === 'Watch List' && (
          <>
            {/* Duration buttons placeholder */}
            <View style={styles.watchlistDurationSection}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Animated.View
                  key={index}
                  style={[styles.durationButton, { opacity: pulseAnim }]}
                />
              ))}
            </View>

            {/* Sort pill placeholder, right-aligned like the real dropdown */}
            <View style={styles.sortRow}>
              <Animated.View style={[styles.sortPill, { opacity: pulseAnim }]} />
            </View>

            {/* Card list placeholder */}
            <View style={styles.assetListSection}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Animated.View
                  key={index}
                  style={[styles.assetRow, { opacity: pulseAnim }]}
                />
              ))}
            </View>
          </>
        )}

        {title === 'Portfolio' && (
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
        )}

        {title === 'Allocations' && (
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

// Use centralized skeleton color constant

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
    height: UI.CATEGORY_BUTTON_HEIGHT,
    backgroundColor: COLORS.SKELETON,
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
    backgroundColor: COLORS.SKELETON,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  summaryValue: {
    width: 200,
    height: 32,
    backgroundColor: COLORS.SKELETON,
    borderRadius: 4,
    marginBottom: theme.spacing.xs,
  },
  summarySubtext: {
    width: 150,
    height: 16,
    backgroundColor: COLORS.SKELETON,
    borderRadius: 4,
  },
  chartPlaceholder: {
    height: UI.CHART_HEIGHT,
    backgroundColor: COLORS.SKELETON,
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
    height: UI.DURATION_BUTTON_HEIGHT,
    backgroundColor: COLORS.SKELETON,
    borderRadius: 14,
  },
  assetListSection: {
    gap: theme.spacing.sm,
  },

  // Watch list-specific placeholders
  watchlistDurationSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
    marginBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.md,
  },
  sortRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: theme.spacing.sm,
  },
  sortPill: {
    width: 120,
    height: 28,
    backgroundColor: COLORS.SKELETON,
    borderRadius: 14,
  },
  assetRow: {
    height: UI.ASSET_ROW_HEIGHT,
    backgroundColor: COLORS.SKELETON,
    borderRadius: theme.borderRadius.md,
  },

  // Allocations-specific placeholders
  donutChartPlaceholder: {
    width: UI.DONUT_CHART_SIZE,
    height: UI.DONUT_CHART_SIZE,
    backgroundColor: COLORS.SKELETON,
    borderRadius: UI.DONUT_CHART_SIZE / 2,
    alignSelf: 'center',
    marginVertical: theme.spacing.xs,
  },
  legendSection: {
    marginTop: theme.spacing.md - 4,
    gap: 0,
  },
  legendRow: {
    height: UI.LEGEND_ROW_HEIGHT,
    backgroundColor: COLORS.SKELETON,
    borderRadius: 0,
  },
});