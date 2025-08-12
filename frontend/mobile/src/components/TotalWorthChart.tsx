import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { CartesianChart, Line, Area, useChartTransformState, useChartPressState } from 'victory-native';
import { useDerivedValue, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import { Defs, LinearGradient, Stop, Svg, Line as SvgLine, Circle } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { PerformanceData } from '../data/types';

interface TotalWorthChartProps {
  data: PerformanceData[];
  onDataPointSelected?: (dataPoint: PerformanceData | null) => void;
}

type Duration = '1W' | '1M' | 'YTD' | '1Y' | 'ALL';

const durations: Duration[] = ['1W', '1M', 'YTD', '1Y', 'ALL'];

export default function TotalWorthChart({ data, onDataPointSelected }: TotalWorthChartProps) {
  console.log('TotalWorthChart - data:', data);
  console.log('TotalWorthChart - onDataPointSelected:', onDataPointSelected);
  
  const [selectedDuration, setSelectedDuration] = useState<Duration>('ALL');
  const { width } = Dimensions.get('window');
  const chartWidth = width - theme.spacing.xl * 2;
  const chartHeight = 210;

  // Early return if no data
  if (!data || data.length === 0) {
    console.log('TotalWorthChart - No data available');
    return (
      <View style={styles.container}>
        <View style={[styles.chartWrapper, { height: chartHeight, backgroundColor: theme.colors.card, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={[{ color: theme.colors.muted }, getTextStyle('md')]}>
            No data available
          </Text>
        </View>
      </View>
    );
  }

  // Transform data for chart (needs numeric values and date objects)
  const chartData = useMemo(() => {
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
  const minValue = useMemo(() => Math.min(...chartData.map(d => d.y)), [chartData]);
  const maxValue = useMemo(() => Math.max(...chartData.map(d => d.y)), [chartData]);

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

  // Function to find closest point (this runs on JS thread)
  const findClosestPoint = useCallback((xValue: number) => {
    if (chartData.length === 0) return null;
    
    console.log('Finding closest point - Press X:', xValue, 'Chart Width:', chartWidth);
    
    // Map screen coordinate to data index
    // Victory Native XL gives us screen coordinates, so we need to normalize
    const normalizedX = Math.max(0, Math.min(1, xValue / chartWidth));
    const dataIndex = Math.round(normalizedX * (chartData.length - 1));
    const clampedIndex = Math.max(0, Math.min(chartData.length - 1, dataIndex));
    
    console.log('Normalized X:', normalizedX, 'Data Index:', clampedIndex, 'Date:', chartData[clampedIndex]?.date);
    
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
    
    // Map data values to screen Y coordinates
    const dataRange = maxValue - minValue;
    const chartRange = chartBounds.bottom - chartBounds.top;
    
    // Calculate Y position for max value (top of chart area)
    const maxY = chartBounds.top;
    
    // Calculate Y position for min value (bottom of chart area)  
    const minY = chartBounds.bottom;
    
    console.log('Chart Bounds:', chartBounds, 'Max Y:', maxY, 'Min Y:', minY);
    
    return { maxY, minY };
  }, [chartBounds, maxValue, minValue, chartHeight]);

  // Notify parent component of selection changes
  React.useEffect(() => {
    handleDataPointSelected(selectedDataPoint);
  }, [selectedDataPoint, handleDataPointSelected]);

  return (
    <View style={styles.container}>
      {/* Chart Container with Labels */}
      <View style={styles.chartContainer}>
        <Text style={styles.maxLabel}>{formatCurrency(maxValue)}</Text>
        
        {/* Chart and Overlays */}
        <View style={styles.chartWrapper}>
          <View style={[{ width: chartWidth, height: chartHeight }]}>
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

                return (
                  <>
                    {/* Gradient Definition */}
                    <Defs>
                      <LinearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <Stop
                          offset="0%"
                          stopColor={lineColor}
                          stopOpacity="0.4"
                        />
                        <Stop
                          offset="100%"
                          stopColor={lineColor}
                          stopOpacity="0.0"
                        />
                      </LinearGradient>
                    </Defs>

                    {/* Area with gradient fill */}
                    <Area
                      points={points.y}
                      y0={victoryChartBounds.bottom}
                      curveType="natural"
                      color="url(#areaGradient)"
                    />

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
          
          {/* Horizontal reference lines and crosshair overlay */}
          <View style={styles.referenceLinesContainer}>
            <Svg
              height={chartHeight}
              width={chartWidth}
              style={styles.referenceLinesOverlay}
            >
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
      </View>

      {/* Duration Selector */}
      <View style={styles.durationContainer}>
        {durations.map((duration) => (
          <View
            key={duration}
            style={[
              styles.durationButton,
              selectedDuration === duration && styles.durationButtonSelected,
            ]}
            onTouchEnd={() => setSelectedDuration(duration)}
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
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.xl,
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
  },
  referenceLinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  maxLabel: {
    position: 'absolute',
    top: 0,
    left: theme.spacing.sm,
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    zIndex: 1,
  },
  minLabel: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    left: theme.spacing.sm,
    color: theme.colors.muted,
    ...getTextStyle('sm'),
    zIndex: 1,
  },
  durationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
  },
  durationButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: theme.spacing.xs,
    borderRadius: 20, // Large enough to make sides semi-circular
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
});