import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { Svg, Circle, G, Path } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle, formatCurrency } from '../styles/utils';
import { CategoryAllocation } from '../data/types';
import { getCategoryColor } from '../data/utils';

interface CategoryDonutChartProps {
  categories: CategoryAllocation[];
  selectedCategory: CategoryAllocation | null;
  onCategorySelect: (category: CategoryAllocation | null) => void;
}

interface DonutSegment {
  category: string;
  startAngle: number;
  endAngle: number;
  color: string;
  percentage: number;
}

// Base chart configuration - only change these values to resize
const CHART_SIZE = 260;
const STROKE_WIDTH = 22;
const TARGET_STROKE_WIDTH = 18;

// Derived constants - automatically calculated
const CENTER_X = CHART_SIZE / 2;
const CENTER_Y = CHART_SIZE / 2;
// Keep original radius values but make them dynamic if needed
const OUTER_RADIUS = 115;
const TARGET_RADIUS = 85;
const INNER_RADIUS = 60; // For future use if needed
const TOUCH_BUFFER = Math.min(4, STROKE_WIDTH * 0.2); // Dynamic buffer based on stroke width

// Helper function to convert percentage to angle (0-360 degrees)
const percentageToAngle = (percentage: number): number => {
  return (percentage / 100) * 360;
};

// Helper function to convert degrees to radians
const degToRad = (degrees: number): number => {
  return (degrees * Math.PI) / 180;
};

// Helper function to calculate arc path for SVG
const createArcPath = (
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string => {
  const start = degToRad(startAngle - 90); // -90 to start from top
  const end = degToRad(endAngle - 90);
  
  const x1 = centerX + radius * Math.cos(start);
  const y1 = centerY + radius * Math.sin(start);
  const x2 = centerX + radius * Math.cos(end);
  const y2 = centerY + radius * Math.sin(end);
  
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  
  return [
    'M', centerX, centerY,
    'L', x1, y1,
    'A', radius, radius, 0, largeArc, 1, x2, y2,
    'Z'
  ].join(' ');
};

// Helper function to create touch area for ring segments
const createTouchArea = (
  radius: number,
  strokeWidth: number,
  startAngle: number,
  endAngle: number,
  category: CategoryAllocation,
  onCategorySelect: (category: CategoryAllocation | null) => void,
  keyPrefix: string,
  index: number
): React.ReactElement => {
  const adjustedStartAngle = startAngle - 90;
  const adjustedEndAngle = endAngle - 90;
  
  const innerRadius = radius - strokeWidth / 2 - TOUCH_BUFFER;
  const outerRadius = radius + strokeWidth / 2 + TOUCH_BUFFER;
  
  const startAngleRad = (adjustedStartAngle * Math.PI) / 180;
  const endAngleRad = (adjustedEndAngle * Math.PI) / 180;
  
  const x1 = CENTER_X + innerRadius * Math.cos(startAngleRad);
  const y1 = CENTER_Y + innerRadius * Math.sin(startAngleRad);
  const x2 = CENTER_X + outerRadius * Math.cos(startAngleRad);
  const y2 = CENTER_Y + outerRadius * Math.sin(startAngleRad);
  const x3 = CENTER_X + outerRadius * Math.cos(endAngleRad);
  const y3 = CENTER_Y + outerRadius * Math.sin(endAngleRad);
  const x4 = CENTER_X + innerRadius * Math.cos(endAngleRad);
  const y4 = CENTER_Y + innerRadius * Math.sin(endAngleRad);
  
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  
  const pathData = [
    'M', x1, y1, 'L', x2, y2,
    'A', outerRadius, outerRadius, 0, largeArc, 1, x3, y3,
    'L', x4, y4, 'A', innerRadius, innerRadius, 0, largeArc, 0, x1, y1, 'Z'
  ].join(' ');

  return (
    <Path
      key={`${keyPrefix}-interactive-${index}`}
      d={pathData}
      fill="transparent"
      stroke="transparent"
      strokeWidth={0}
      onPress={(e) => {
        e.stopPropagation();
        onCategorySelect(category);
      }}
    />
  );
};

export default function CategoryDonutChart({ categories, selectedCategory, onCategorySelect }: CategoryDonutChartProps) {

  // Calculate total portfolio value for center display
  const totalPortfolioValue = categories.reduce((sum, cat) => sum + cat.currentValue, 0);

  // Calculate segments for current allocations (outer ring)
  const currentSegments = useMemo(() => {
    let startAngle = 0;
    return categories.map(category => {
      const percentage = category.currentAllocation;
      const endAngle = startAngle + percentageToAngle(percentage);
      const segment: DonutSegment = {
        category: category.category,
        startAngle,
        endAngle,
        color: getCategoryColor(category.category),
        percentage,
      };
      startAngle = endAngle;
      return segment;
    });
  }, [categories]);

  // Calculate segments for target allocations (inner ring)
  const targetSegments = useMemo(() => {
    let startAngle = 0;
    return categories.map(category => {
      const percentage = category.targetAllocation;
      const endAngle = startAngle + percentageToAngle(percentage);
      const segment: DonutSegment = {
        category: category.category,
        startAngle,
        endAngle,
        color: getCategoryColor(category.category),
        percentage,
      };
      startAngle = endAngle;
      return segment;
    });
  }, [categories]);

  // Create interactive segments using the helper function
  const createInteractiveSegments = (): React.ReactElement[] => {
    const segments: React.ReactElement[] = [];

    // Outer ring touchable areas (current allocations)
    categories.forEach((category, index) => {
      const currentSegment = currentSegments[index];
      if (!currentSegment || currentSegment.percentage <= 0) return;

      segments.push(
        createTouchArea(
          OUTER_RADIUS,
          STROKE_WIDTH,
          currentSegment.startAngle,
          currentSegment.endAngle,
          category,
          onCategorySelect,
          'outer',
          index
        )
      );
    });

    // Inner ring touchable areas (target allocations)
    categories.forEach((category, index) => {
      const targetSegment = targetSegments[index];
      if (!targetSegment || targetSegment.percentage <= 0) return;

      segments.push(
        createTouchArea(
          TARGET_RADIUS,
          TARGET_STROKE_WIDTH,
          targetSegment.startAngle,
          targetSegment.endAngle,
          category,
          onCategorySelect,
          'inner',
          index
        )
      );
    });

    return segments;
  };

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
          <Svg width={CHART_SIZE} height={CHART_SIZE} pointerEvents="none">
            {/* Target allocations (inner ring) - visual only */}
            <G>
              {targetSegments.map((segment, index) => {
                if (segment.percentage <= 0) return null;
                
                const category = categories[index];
                const isSelected = selectedCategory?.category === category.category;
                const opacity = selectedCategory && !isSelected ? 0.3 : 0.7;
                
                const circumference = 2 * Math.PI * TARGET_RADIUS;
                const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((segment.startAngle / 360) * circumference);
                
                return (
                  <Circle
                    key={`target-${index}`}
                    cx={CENTER_X}
                    cy={CENTER_Y}
                    r={TARGET_RADIUS}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={TARGET_STROKE_WIDTH}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    opacity={opacity}
                    transform={`rotate(-90 ${CENTER_X} ${CENTER_Y})`}
                  />
                );
              })}
            </G>

            {/* Current allocations (outer ring) - visual only */}
            <G>
              {currentSegments.map((segment, index) => {
                if (segment.percentage <= 0) return null;
                
                const category = categories[index];
                const isSelected = selectedCategory?.category === category.category;
                const opacity = selectedCategory && !isSelected ? 0.3 : 1.0;
                
                const circumference = 2 * Math.PI * OUTER_RADIUS;
                const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((segment.startAngle / 360) * circumference);
                
                return (
                  <Circle
                    key={`current-${index}`}
                    cx={CENTER_X}
                    cy={CENTER_Y}
                    r={OUTER_RADIUS}
                    fill="none"
                    stroke={segment.color}
                    strokeWidth={STROKE_WIDTH}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    opacity={opacity}
                    transform={`rotate(-90 ${CENTER_X} ${CENTER_Y})`}
                  />
                );
              })}
            </G>
          </Svg>

          {/* Dynamic center content */}
          <View style={styles.centerLabel}>
            {selectedCategory ? (
              <>
                <Text style={styles.selectedCategoryName} numberOfLines={1} adjustsFontSizeToFit>{selectedCategory.category}</Text>
                <Text style={styles.selectedAllocationText}>
                  {selectedCategory.currentAllocation.toFixed(1)}% → {selectedCategory.targetAllocation.toFixed(1)}%
                </Text>
                <Text style={styles.selectedValueText}>
                  {formatCurrency(selectedCategory.currentValue)}
                </Text>
                <Text style={[
                  styles.selectedDeltaText,
                  { color: selectedCategory.percentageDelta >= 0 ? theme.colors.success : theme.colors.destructive }
                ]}>
                  {selectedCategory.percentageDelta >= 0 ? '+' : ''}{selectedCategory.percentageDelta.toFixed(1)}%
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.totalValueText}>
                  {totalPortfolioValue.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </Text>
                <Text style={styles.totalLabelText}>Total Value</Text>
              </>
            )}
          </View>

          {/* Interactive areas on top */}
          <Svg 
            width={CHART_SIZE} 
            height={CHART_SIZE} 
            style={styles.interactiveSvg}
          >
            {createInteractiveSegments()}
          </Svg>
        </View>
    </View>
  );
}

// Calculate center label dimensions - restored to working values
const centerLabelSize = 120; // Original working width
const centerLabelHeight = 60;

const styles = createStyles({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.xs,
    marginHorizontal: 0,
    paddingHorizontal: 0,
  },
  chartContainer: {
    width: CHART_SIZE,
    height: CHART_SIZE,
  },
  interactiveSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  centerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [
      { translateX: -(centerLabelSize / 2) }, 
      { translateY: -(centerLabelHeight / 2) + 5 }
    ],
    alignItems: 'center',
    justifyContent: 'center',
    width: centerLabelSize,
    height: centerLabelHeight,
  },
  totalValueText: {
    color: theme.colors.foreground,
    ...getTextStyle('xxl', 'bold'),
    textAlign: 'center',
  },
  totalLabelText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    textAlign: 'center',
    marginTop: 2,
  },
  selectedCategoryName: {
    color: theme.colors.foreground,
    ...getTextStyle('lg', 'bold'),
    textAlign: 'center',
    marginBottom: 2,
  },
  selectedAllocationText: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    textAlign: 'center',
    marginBottom: 1,
  },
  selectedValueText: {
    color: theme.colors.foreground,
    ...getTextStyle('md', 'medium'),
    textAlign: 'center',
    marginBottom: 1,
  },
  selectedDeltaText: {
    ...getTextStyle('md', 'bold'),
    textAlign: 'center',
  },
});