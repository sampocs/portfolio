import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing
} from 'react-native-reanimated';
import { CartesianChart, Line, useChartPressState } from 'victory-native';
import { useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Svg, Line as SvgLine, Circle } from 'react-native-svg';
import { Canvas, Path, LinearGradient as SkiaLinearGradient, vec, Skia } from '@shopify/react-native-skia';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';

export interface ChartDataPoint {
  x: number;
  y: number;
  date: string;
  value: number;
  originalData?: any; // For passing back original data structure
}

export interface FinancialChartProps {
  data: ChartDataPoint[];
  onDataPointSelected?: (dataPoint: any | null) => void;
  isLoading?: boolean;
  isCached?: boolean;
  isPositive?: boolean; // Override color logic
  formatLabel?: (value: number) => string; // Custom label formatting
  showGradient?: boolean;
}

function FinancialChart({ 
  data, 
  onDataPointSelected, 
  isLoading = false, 
  isCached = false,
  isPositive,
  formatLabel = formatCurrency,
  showGradient = true
}: FinancialChartProps) {
  const { width } = Dimensions.get('window');
  const chartWidth = width - theme.spacing.xl * 2;
  const chartHeight = 170;

  // Animation values for smooth transitions
  const chartOpacity = useSharedValue(1);
  const loadingOpacity = useSharedValue(0);
  const referenceLinesOpacity = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);

  // Transform data for chart (needs numeric values and date objects)
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      y: item.y,
      date: item.date,
      value: item.value,
      originalData: item.originalData || item,
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

  // Determine line color
  const determineIsPositive = useMemo(() => {
    if (isPositive !== undefined) return isPositive;
    if (chartData.length === 0) return true;
    
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    return last.y >= first.y;
  }, [chartData, isPositive]);

  const lineColor = determineIsPositive ? theme.colors.success : theme.colors.destructive;

  // Initialize press state
  const INIT_PRESS_STATE = { x: 0, y: { y: 0 } };
  const { state: pressState, isActive: pressActive } = useChartPressState(INIT_PRESS_STATE);

  // Handle data point selection
  const handleDataPointSelected = useCallback((dataPoint: typeof chartData[0] | null) => {
    if (dataPoint && onDataPointSelected) {
      onDataPointSelected(dataPoint.originalData);
    } else if (onDataPointSelected) {
      onDataPointSelected(null);
    }
  }, [onDataPointSelected]);

  // State to track the currently selected data point
  const [selectedDataPoint, setSelectedDataPoint] = useState<typeof chartData[0] | null>(null);
  
  // State to store chart bounds for proper line positioning
  const [chartBounds, setChartBounds] = useState<{top: number, bottom: number, left: number, right: number} | null>(null);
  
  // State to store Victory Native's exact points for gradient
  const [victoryPoints, setVictoryPoints] = useState<any[] | null>(null);

  // Reset state when data changes
  React.useEffect(() => {
    setChartBounds(null);
    setVictoryPoints(null);
    setSelectedDataPoint(null);
  }, [data]);

  // Handle smooth transitions between loading and chart states
  React.useEffect(() => {
    if (isLoading) {
      const duration = isCached ? 60 : 120;
      const loadDuration = isCached ? 50 : 100;
      
      overlayOpacity.value = withTiming(0.95, { 
        duration,
        easing: Easing.out(Easing.quad)
      });
      loadingOpacity.value = withTiming(1, { 
        duration: loadDuration, 
        easing: Easing.out(Easing.quad) 
      });
    } else {
      const fadeDuration = isCached ? 50 : 100;
      const overlayDuration = isCached ? 75 : 150;
      const delay = isCached ? 10 : 20;
      
      loadingOpacity.value = withTiming(0, { 
        duration: fadeDuration,
        easing: Easing.in(Easing.quad)
      });
      setTimeout(() => {
        overlayOpacity.value = withTiming(0, { 
          duration: overlayDuration,
          easing: Easing.out(Easing.quad) 
        });
      }, delay);
    }
  }, [isLoading, isCached]);

  // Function to find closest point
  const findClosestPoint = useCallback((xValue: number) => {
    if (chartData.length === 0) return null;
        
    const normalizedX = Math.max(0, Math.min(1, xValue / chartWidth));
    const dataIndex = Math.round(normalizedX * (chartData.length - 1));
    const clampedIndex = Math.max(0, Math.min(chartData.length - 1, dataIndex));
    
    return chartData[clampedIndex];
  }, [chartData, chartWidth]);

  // Wrapper function to find and set the closest point
  const updateSelectedPoint = useCallback((xValue: number) => {
    const closestPoint = findClosestPoint(xValue);
    setSelectedDataPoint(closestPoint);
  }, [findClosestPoint]);

  // Listen to press state changes and update data point
  useAnimatedReaction(
    () => {
      return {
        isActive: pressActive,
        xPosition: pressState?.x?.position?.value || 0
      };
    },
    (current) => {
      if (current.isActive && pressState?.x?.position) {
        runOnJS(updateSelectedPoint)(current.xPosition);
      } else {
        runOnJS(setSelectedDataPoint)(null);
      }
    }
  );

  // Store scale function and bounds for reference line positioning
  const [yScale, setYScale] = useState<any>(null);
  
  // Calculate Y positions using Victory Native's scale function
  const getHorizontalLinePositions = useMemo(() => {
    if (!yScale || !chartBounds) return { maxY: 50, minY: chartHeight - 50 };
    
    // Use Victory Native's scale function to convert data values to pixel positions
    const maxY = yScale(maxValue);
    const minY = yScale(minValue);
    
    return { maxY, minY };
  }, [yScale, maxValue, minValue, chartBounds, chartHeight]);

  // Create Skia path using Victory Native's exact points with smooth curves
  const createGradientPathFromPoints = useCallback((points: any[], bounds: {top: number, bottom: number, left: number, right: number}) => {
    if (!points?.length || !bounds || !showGradient) return null;

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
        
        const next = points[i + 1];
        const prevPrev = points[i - 2];
        
        const tension = 0.25;
        
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
        
        path.cubicTo(cp1x, cp1y, cp2x, cp2y, current.x, current.y);
      }
    }

    // Close the path
    path.lineTo(bounds.right, bounds.bottom);
    path.lineTo(bounds.left, bounds.bottom);
    path.close();

    return path;
  }, [showGradient]);

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
          { height: chartHeight + 50 }
        ]}>
          <View style={[styles.chartWrapper, styles.loadingContainer, { height: chartHeight }]}>
            {isLoading ? (
              <View style={{ width: chartWidth, height: chartHeight, backgroundColor: theme.colors.background }} />
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
          <Text style={[
            styles.maxLabel,
            yScale && { top: getHorizontalLinePositions.maxY - 16 }
          ]}>{formatLabel(maxValue)}</Text>
            
            {/* Chart and Overlays */}
            <View style={styles.chartWrapper}>
              <View style={[{ width: chartWidth, height: chartHeight }]}>
                {/* Skia gradient background - positioned behind Victory chart */}
                {showGradient && chartBounds && victoryPoints && chartData.length > 0 && (() => {
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
                          colors={[lineColor + '66', lineColor + '00']}
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
                  chartPressState={pressState}
                >
                {({ points, chartBounds: victoryChartBounds, yScale: victoryYScale }) => {
                  if (victoryChartBounds && (!chartBounds || 
                      chartBounds.top !== victoryChartBounds.top || 
                      chartBounds.bottom !== victoryChartBounds.bottom)) {
                    setTimeout(() => setChartBounds(victoryChartBounds), 0);
                  }

                  if (points.y && (!victoryPoints || points.y.length !== victoryPoints.length)) {
                    setTimeout(() => setVictoryPoints(points.y), 0);
                  }
                  
                  if (victoryYScale && !yScale) {
                    setTimeout(() => setYScale(() => victoryYScale), 0);
                  }

                  return (
                    <>
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
                  {chartBounds && chartData.length > 0 && (
                    <>
                      <SvgLine
                        x1={0}
                        y1={getHorizontalLinePositions.maxY}
                        x2={chartWidth}
                        y2={getHorizontalLinePositions.maxY}
                        stroke={theme.colors.muted}
                        strokeWidth={0.5}
                        opacity={0.6}
                      />
                      
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

              {/* Crosshair overlay */}
              <Svg
                height={chartHeight}
                width={chartWidth}
                style={[styles.referenceLinesOverlay, { position: 'absolute' }]}
              >
                {pressActive && pressState && (
                  <>
                    <SvgLine
                      x1={pressState.x.position.value}
                      y1={20}
                      x2={pressState.x.position.value}
                      y2={chartHeight - 20}
                      stroke={theme.colors.foreground}
                      strokeWidth={1}
                      opacity={0.8}
                    />
                    
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

          <Text style={[
            styles.minLabel,
            yScale && { bottom: chartHeight - getHorizontalLinePositions.minY - 17 }
          ]}>{formatLabel(minValue)}</Text>
          
          {/* Simple overlay to hide chart glitches during transitions */}
          <Animated.View style={[
            overlayAnimatedStyle,
            {
              position: 'absolute',
              top: -15,
              left: 0,
              right: 0,
              bottom: -15,
              backgroundColor: theme.colors.background,
              zIndex: 20,
              pointerEvents: 'none',
            }
          ]} />
        </View>
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

export default React.memo(FinancialChart);