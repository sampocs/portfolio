import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  Easing,
  interpolate
} from 'react-native-reanimated';
import { CartesianChart, Line, useChartTransformState, useChartPressState } from 'victory-native';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Svg, Line as SvgLine, Circle } from 'react-native-svg';
import { Canvas, Path, LinearGradient as SkiaLinearGradient, vec, Skia, LinearGradient } from '@shopify/react-native-skia';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { PerformanceData } from '../data/types';

interface TotalWorthChartProps {
  data: PerformanceData[];
  onDataPointSelected?: (dataPoint: PerformanceData | null) => void;
  onGranularityChange?: (granularity: string) => void;
  isLoading?: boolean;
}

type Duration = '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

const durations: Duration[] = ['1W', '1M', 'YTD', '1Y', 'ALL'];


// Loading animation component
const ChartLoadingAnimation = ({ width, height }: { width: number; height: number }) => {
  const shimmerTranslate = useSharedValue(-width);
  const waveOffset = useSharedValue(0);
  const advancedAnimationsOpacity = useSharedValue(0);

  React.useEffect(() => {
    // Start shimmer and dots after 1 second delay
    setTimeout(() => {
      // Fade in advanced animations
      advancedAnimationsOpacity.value = withTiming(1, { duration: 300 });
      
      // Shimmer effect
      shimmerTranslate.value = withRepeat(
        withTiming(width, { duration: 1500, easing: Easing.ease }),
        -1,
        false
      );
      
      // Wave animation
      waveOffset.value = withRepeat(
        withTiming(2 * Math.PI, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      );
    }, 1000);
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerTranslate.value }],
    opacity: advancedAnimationsOpacity.value,
  }));

  // Create wavy path points
  const createWavePath = () => {
    const path = Skia.Path.Make();
    const points: { x: number; y: number }[] = [];
    const numPoints = 50;
    
    for (let i = 0; i < numPoints; i++) {
      const x = (i / (numPoints - 1)) * width;
      const baseY = height * 0.6; // Center the wave
      const waveAmplitude = height * 0.15; // Wave height
      const y = baseY + Math.sin((i / numPoints) * Math.PI * 3) * waveAmplitude;
      points.push({ x, y });
    }
    
    if (points.length > 0) {
      path.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        path.lineTo(points[i].x, points[i].y);
      }
    }
    
    return path;
  };

  const wavePath = createWavePath();

  return (
    <View style={{ width, height, position: 'relative' }}>
      {/* Background skeleton */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: theme.colors.muted + '10',
        borderRadius: 8,
      }} />
      
      {/* Animated wave */}
      <Canvas style={{ width, height }}>
        <Path
          path={wavePath}
          style="stroke"
          strokeWidth={2.5}
          color={theme.colors.accent + '60'}
        />
      </Canvas>
      
      {/* Shimmer overlay */}
      <Animated.View
        style={[
          shimmerStyle,
          {
            position: 'absolute',
            top: 0,
            width: width * 0.3,
            height: height,
            backgroundColor: 'transparent',
          }
        ]}
      >
        <Canvas style={{ width: width * 0.3, height }}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width * 0.3, 0)}
            colors={[
              'transparent',
              theme.colors.foreground + '20',
              theme.colors.foreground + '10',
              'transparent'
            ]}
          />
        </Canvas>
      </Animated.View>
      
      {/* Animated dots */}
      {[...Array(3)].map((_, i) => {
        const dotAnimation = useSharedValue(0);
        
        React.useEffect(() => {
          // Start dot animations after 1 second delay
          setTimeout(() => {
            dotAnimation.value = withRepeat(
              withTiming(1, { 
                duration: 2000 + i * 200, 
                easing: Easing.inOut(Easing.ease) 
              }),
              -1,
              true
            );
          }, 1000);
        }, []);
        
        const dotStyle = useAnimatedStyle(() => {
          const x = interpolate(dotAnimation.value, [0, 1], [width * 0.1, width * 0.9]);
          const y = interpolate(
            Math.sin(dotAnimation.value * Math.PI * 2), 
            [-1, 1], 
            [height * 0.3, height * 0.7]
          );
          
          const baseDotOpacity = interpolate(dotAnimation.value, [0, 0.5, 1], [0.3, 1, 0.3]);
          const finalOpacity = baseDotOpacity * advancedAnimationsOpacity.value;
          
          return {
            position: 'absolute',
            left: x - 3,
            top: y - 3,
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: theme.colors.accent,
            opacity: finalOpacity,
          };
        });
        
        return <Animated.View key={i} style={dotStyle} />;
      })}
    </View>
  );
};

export default function TotalWorthChart({ data, onDataPointSelected, onGranularityChange, isLoading = false }: TotalWorthChartProps) {
  const [selectedDuration, setSelectedDuration] = useState<Duration>('ALL');
  const { width } = Dimensions.get('window');
  const chartWidth = width - theme.spacing.xl * 2;
  const chartHeight = 170;

  // Animation values for smooth transitions
  const chartOpacity = useSharedValue(1);
  const loadingOpacity = useSharedValue(0);
  const referenceLinesOpacity = useSharedValue(1);
  const overlayOpacity = useSharedValue(0); // Simple overlay to hide chart during transitions
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);

  // Transform data for chart (needs numeric values and date objects)
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index, // Use index for x-axis
      y: parseFloat(item.value),
      date: item.date,
      cost: parseFloat(item.cost),
      value: parseFloat(item.value),
      returns: parseFloat(item.returns),
    }));
  }, [data]);

  // Calculate min/max values for the horizontal lines
  const minValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.min(...chartData.map(d => d.y));
  }, [chartData]);
  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map(d => d.y));
  }, [chartData]);

  // Determine if overall return is positive
  const totalReturn = useMemo(() => {
    if (chartData.length === 0) return 0;
    const latest = chartData[chartData.length - 1];
    return latest.value - latest.cost;
  }, [chartData]);

  const isPositiveReturn = totalReturn >= 0;
  const lineColor = isPositiveReturn ? theme.colors.success : theme.colors.destructive;

  // Initialize press state with proper structure for single y key
  const INIT_PRESS_STATE = { x: 0, y: { y: 0 } };
  
  // Transform and press state for gestures
  const { state: transformState } = useChartTransformState();
  const { state: pressState, isActive: pressActive } = useChartPressState(INIT_PRESS_STATE);

  // Handle data point selection
  const handleDataPointSelected = useCallback((dataPoint: typeof chartData[0] | null) => {
    if (dataPoint && onDataPointSelected) {
      const originalDataPoint = data.find(d => d.date === dataPoint.date);
      onDataPointSelected(originalDataPoint || null);
    } else if (onDataPointSelected) {
      onDataPointSelected(null);
    }
  }, [data, onDataPointSelected]);

  // State to track the currently selected data point
  const [selectedDataPoint, setSelectedDataPoint] = useState<typeof chartData[0] | null>(null);
  
  // State to store chart bounds for proper line positioning
  const [chartBounds, setChartBounds] = useState<{top: number, bottom: number, left: number, right: number} | null>(null);
  
  // State to store Victory Native's exact points for gradient
  const [victoryPoints, setVictoryPoints] = useState<any[] | null>(null);

  // Reset gradient state when data changes
  React.useEffect(() => {
    setChartBounds(null);
    setVictoryPoints(null);
    setSelectedDataPoint(null);
  }, [data]);

  // Handle smooth transitions between loading and chart states
  React.useEffect(() => {
    let loadingAnimationTimeout: NodeJS.Timeout | undefined;
    
    if (isLoading) {
      // Show opaque overlay instantly to hide any chart glitches
      overlayOpacity.value = withTiming(1, { duration: 50 });
      
      // Start loading overlay after overlay is opaque
      setTimeout(() => {
        loadingOpacity.value = withTiming(1, { duration: 300 });
      }, 100);
      
      setShowLoadingAnimation(false);
      
      // If we're still loading after 500ms, show the animation
      loadingAnimationTimeout = setTimeout(() => {
        setShowLoadingAnimation(true);
      }, 500);
    } else {
      // Clear the timeout if we finish loading quickly
      if (loadingAnimationTimeout) {
        clearTimeout(loadingAnimationTimeout);
      }
      
      // Hide loading animation
      setShowLoadingAnimation(false);
      loadingOpacity.value = withTiming(0, { duration: 200 });
      
      // Wait longer for new chart to fully stabilize, then hide overlay
      setTimeout(() => {
        overlayOpacity.value = withTiming(0, { duration: 500 });
      }, 400);
    }

    return () => {
      if (loadingAnimationTimeout) {
        clearTimeout(loadingAnimationTimeout);
      }
    };
  }, [isLoading]);

  // Function to find closest point (this runs on JS thread)
  const findClosestPoint = useCallback((xValue: number) => {
    if (chartData.length === 0) return null;
        
    // Map screen coordinate to data index
    // Victory Native XL gives us screen coordinates, so we need to normalize
    const normalizedX = Math.max(0, Math.min(1, xValue / chartWidth));
    const dataIndex = Math.round(normalizedX * (chartData.length - 1));
    const clampedIndex = Math.max(0, Math.min(chartData.length - 1, dataIndex));
    
    return chartData[clampedIndex];
  }, [chartData, chartWidth]);

  // Wrapper function to find and set the closest point (for runOnJS)
  const updateSelectedPoint = useCallback((xValue: number) => {
    const closestPoint = findClosestPoint(xValue);
    setSelectedDataPoint(closestPoint);
  }, [findClosestPoint]);

  // Use useAnimatedReaction to listen to press state changes and update data point
  useAnimatedReaction(
    () => {
      return {
        isActive: pressActive,
        xPosition: pressState?.x?.position?.value || 0
      };
    },
    (current) => {
      if (current.isActive && pressState?.x?.position) {
        // Update the selected point on JS thread
        runOnJS(updateSelectedPoint)(current.xPosition);
      } else {
        runOnJS(setSelectedDataPoint)(null);
      }
    }
  );

  // Calculate Y positions for min/max horizontal lines
  const getHorizontalLinePositions = useMemo(() => {
    if (!chartBounds) return { maxY: 50, minY: chartHeight - 50 }; // Fallback to old positions
    
    // Calculate Y position for max value (top of chart area)
    // Adjust by ~9px to account for label space and internal padding
    const maxY = chartBounds.top + 9;
    
    // Calculate Y position for min value (bottom of chart area)  
    const minY = chartBounds.bottom;
    
    return { maxY, minY };
  }, [chartBounds, maxValue, minValue, chartHeight]);

  // Create Skia path using Victory Native's exact points with smooth curves
  const createGradientPathFromPoints = useCallback((points: any[], bounds: {top: number, bottom: number, left: number, right: number}) => {
    if (!points?.length || !bounds) return null;

    const path = Skia.Path.Make();

    // Start at bottom-left corner
    path.moveTo(bounds.left, bounds.bottom);
    
    // Connect to first point
    if (points[0] && typeof points[0].x === 'number' && typeof points[0].y === 'number') {
      path.lineTo(points[0].x, points[0].y);
    }
    
    // Create smooth curve through all points using cubic bezier curves
    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const prev = points[i - 1];
      
      if (current && prev && 
          typeof current.x === 'number' && typeof current.y === 'number' &&
          typeof prev.x === 'number' && typeof prev.y === 'number') {
        
        // Simple smoothing - use control points based on neighboring points
        const next = points[i + 1];
        const prevPrev = points[i - 2];
        
        // Calculate control points for smooth curve (adjusted tension to match Victory Native's "natural" curve)
        const tension = 0.25; // Reduced tension to match Victory Native better
        
        let cp1x = prev.x, cp1y = prev.y;
        let cp2x = current.x, cp2y = current.y;
        
        if (prevPrev && typeof prevPrev.x === 'number' && typeof prevPrev.y === 'number') {
          cp1x = prev.x + tension * (current.x - prevPrev.x);
          cp1y = prev.y + tension * (current.y - prevPrev.y);
        }
        
        if (next && typeof next.x === 'number' && typeof next.y === 'number') {
          cp2x = current.x - tension * (next.x - prev.x);
          cp2y = current.y - tension * (next.y - prev.y);
        }
        
        // Draw cubic bezier curve
        path.cubicTo(cp1x, cp1y, cp2x, cp2y, current.x, current.y);
      }
    }

    // Close the path
    path.lineTo(bounds.right, bounds.bottom);
    path.lineTo(bounds.left, bounds.bottom);
    path.close();

    return path;
  }, []);

  // Fallback path creation method
  const createGradientPath = useCallback((bounds: {top: number, bottom: number, left: number, right: number}) => {
    if (!chartData.length || !bounds) return null;

    const path = Skia.Path.Make();
    const chartRange = bounds.right - bounds.left;
    const valueRange = maxValue - minValue;
    const heightRange = bounds.bottom - bounds.top;

    // Start at bottom-left corner of the chart area
    path.moveTo(bounds.left, bounds.bottom);

    // Create points that exactly match Victory Native's line positioning
    chartData.forEach((dataPoint, index) => {
      const x = bounds.left + (index / (chartData.length - 1)) * chartRange;
      const normalizedValue = valueRange > 0 ? (dataPoint.y - minValue) / valueRange : 0.5;
      const y = bounds.top + (1 - normalizedValue) * heightRange;
      
      path.lineTo(x, y);
    });

    // Close the path by going to bottom-right corner and back to start
    path.lineTo(bounds.right, bounds.bottom);
    path.lineTo(bounds.left, bounds.bottom);
    path.close();

    return path;
  }, [chartData, maxValue, minValue]);

  // Notify parent component of selection changes
  React.useEffect(() => {
    handleDataPointSelected(selectedDataPoint);
  }, [selectedDataPoint, handleDataPointSelected]);

  // Animated styles for smooth transitions
  const chartAnimatedStyle = useAnimatedStyle(() => ({
    opacity: chartOpacity.value,
  }));

  const loadingAnimatedStyle = useAnimatedStyle(() => ({
    opacity: loadingOpacity.value,
  }));

  const referenceLinesAnimatedStyle = useAnimatedStyle(() => ({
    opacity: referenceLinesOpacity.value,
  }));

  const overlayAnimatedStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Show empty state if no data and not loading
  const showEmptyState = !isLoading && (!data || data.length === 0);

  return (
    <View style={styles.container}>
      {/* Loading overlay */}
      {(isLoading || showEmptyState) && (
        <Animated.View style={[
          styles.overlayContainer,
          loadingAnimatedStyle,
          { height: chartHeight + 50 } // Account for labels
        ]}>
          <View style={[styles.chartWrapper, styles.loadingContainer, { height: chartHeight }]}>
            {isLoading ? (
              showLoadingAnimation ? (
                <ChartLoadingAnimation width={chartWidth} height={chartHeight} />
              ) : (
                // Simple fade placeholder for first 500ms
                <View style={{ width: chartWidth, height: chartHeight, backgroundColor: theme.colors.muted + '10', borderRadius: 8 }} />
              )
            ) : (
              <Text style={[{ color: theme.colors.muted }, getTextStyle('md')]}>
                No data available
              </Text>
            )}
          </View>
        </Animated.View>
      )}

      {/* Main chart content */}
      <View style={styles.chartContainer}>
        <Text style={styles.maxLabel}>{formatCurrency(maxValue)}</Text>
          
          {/* Chart and Overlays */}
          <View style={styles.chartWrapper}>
            <View style={[{ width: chartWidth, height: chartHeight }]}>
              {/* Skia gradient background - positioned behind Victory chart */}
              {chartBounds && victoryPoints && chartData.length > 0 && (() => {
                const gradientPath = createGradientPathFromPoints(victoryPoints, chartBounds);
                return gradientPath ? (
                  <Canvas 
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: chartWidth,
                      height: chartHeight,
                      zIndex: 1,
                    }}
                  >
                    <Path path={gradientPath}>
                      <SkiaLinearGradient
                        start={vec(0, 0)}
                        end={vec(0, chartHeight)}
                        colors={[lineColor + '66', lineColor + '00']} // 40% to 0% opacity
                      />
                    </Path>
                  </Canvas>
                ) : null;
              })()}
            
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 2 }}>
              <CartesianChart
                data={chartData}
                xKey="x"
                yKeys={['y']}
                transformState={transformState}
                chartPressState={pressState}
              >
              {({ points, chartBounds: victoryChartBounds }) => {
                // Update chart bounds using a ref callback instead of useEffect
                if (victoryChartBounds && (!chartBounds || 
                    chartBounds.top !== victoryChartBounds.top || 
                    chartBounds.bottom !== victoryChartBounds.bottom)) {
                  // Only update if bounds have changed to avoid unnecessary re-renders
                  setTimeout(() => setChartBounds(victoryChartBounds), 0);
                }

                // Store Victory points for gradient
                if (points.y && (!victoryPoints || points.y.length !== victoryPoints.length)) {
                  setTimeout(() => setVictoryPoints(points.y), 0);
                }

                return (
                  <>
                    {/* Main line */}
                    <Line
                      points={points.y}
                      curveType="natural"
                      strokeWidth={2.5}
                      color={lineColor}
                    />
                  </>
                );
              }}
            </CartesianChart>
            </View>
          </View>
          
          {/* Horizontal reference lines and crosshair overlay */}
          <View style={styles.referenceLinesContainer}>
            <Animated.View style={referenceLinesAnimatedStyle}>
              <Svg
                height={chartHeight}
                width={chartWidth}
                style={styles.referenceLinesOverlay}
              >
                {/* Only show reference lines when we have valid data and bounds */}
                {chartBounds && chartData.length > 0 && (
                  <>
                    {/* Top horizontal line at max value */}
                    <SvgLine
                      x1={0}
                      y1={getHorizontalLinePositions.maxY}
                      x2={chartWidth}
                      y2={getHorizontalLinePositions.maxY}
                      stroke={theme.colors.muted}
                      strokeWidth={0.5}
                      opacity={0.6}
                    />
                    
                    {/* Bottom horizontal line at min value */}
                    <SvgLine
                      x1={0}
                      y1={getHorizontalLinePositions.minY}
                      x2={chartWidth}
                      y2={getHorizontalLinePositions.minY}
                      stroke={theme.colors.muted}
                      strokeWidth={0.5}
                      opacity={0.6}
                    />
                  </>
                )}
              </Svg>
            </Animated.View>

            {/* Crosshair overlay (separate from reference lines) */}
            <Svg
              height={chartHeight}
              width={chartWidth}
              style={[styles.referenceLinesOverlay, { position: 'absolute' }]}
            >
              {/* Crosshair - only show when chart is being pressed */}
              {pressActive && pressState && (
                <>
                  {/* Vertical line */}
                  <SvgLine
                    x1={pressState.x.position.value}
                    y1={20}
                    x2={pressState.x.position.value}
                    y2={chartHeight - 20}
                    stroke={theme.colors.foreground}
                    strokeWidth={1}
                    opacity={0.8}
                  />
                  
                  {/* Point indicator */}
                  <Circle
                    cx={pressState.x.position.value}
                    cy={pressState.y.y.position.value}
                    r={4}
                    fill={lineColor}
                    stroke={theme.colors.background}
                    strokeWidth={2}
                  />
                </>
              )}
            </Svg>
          </View>
        </View>

        <Text style={styles.minLabel}>{formatCurrency(minValue)}</Text>
        
        {/* Simple overlay to hide chart glitches during transitions */}
        <Animated.View style={[
          overlayAnimatedStyle,
          {
            position: 'absolute',
            top: -15, // Extend up to cover max label
            left: 0,
            right: 0,
            bottom: -15, // Extend down to cover min label
            backgroundColor: theme.colors.background,
            zIndex: 20,
            pointerEvents: 'none',
          }
        ]} />
      </View>

      {/* Duration Selector - Memoized to prevent flicker */}
      <DurationSelector 
        selectedDuration={selectedDuration}
        onDurationChange={(duration) => {
          setSelectedDuration(duration);
          onGranularityChange?.(duration);
        }}
      />
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: 0,
  },
  chartContainer: {
    position: 'relative',
    marginBottom: theme.spacing.lg,
  },
  chartWrapper: {
    position: 'relative',
  },
  gradientCanvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    zIndex: 1,
  },
  referenceLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    zIndex: 3,
  },
  referenceLinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  maxLabel: {
    position: 'absolute',
    top: -8,
    right: theme.spacing.sm,
    color: theme.colors.muted,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.weights.normal,
    zIndex: 1,
  },
  minLabel: {
    position: 'absolute',
    bottom: -8,
    right: theme.spacing.sm,
    color: theme.colors.muted,
    fontSize: 13,
    fontFamily: theme.typography.fontFamily,
    fontWeight: theme.typography.weights.normal,
    zIndex: 1,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    marginTop: 2,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: theme.spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  durationButtonSelected: {
    backgroundColor: theme.colors.accent,
  },
  durationText: {
    color: theme.colors.muted,
    ...getTextStyle('sm', 'medium'),
  },
  durationTextSelected: {
    color: theme.colors.foreground,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
  },
  overlayContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: theme.colors.background,
  },
});

// Memoized duration selector to prevent flickering during data changes
const DurationSelector = React.memo(({ selectedDuration, onDurationChange }: {
  selectedDuration: Duration;
  onDurationChange: (duration: Duration) => void;
}) => {
  return (
    <View style={styles.durationContainer}>
      {durations.map((duration) => (
        <View
          key={duration}
          style={[
            styles.durationButton,
            selectedDuration === duration && styles.durationButtonSelected,
          ]}
          onTouchEnd={() => onDurationChange(duration)}
        >
          <Text
            style={[
              styles.durationText,
              selectedDuration === duration && styles.durationTextSelected,
            ]}
          >
            {duration}
          </Text>
        </View>
      ))}
    </View>
  );
});