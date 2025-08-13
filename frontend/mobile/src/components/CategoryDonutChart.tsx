import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { Svg, Circle, G } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { CategoryAllocation } from '../data/types';
import { getCategoryColor } from '../data/utils';

interface CategoryDonutChartProps {
  categories: CategoryAllocation[];
}

interface DonutSegment {
  category: string;
  startAngle: number;
  endAngle: number;
  color: string;
  percentage: number;
}

const CHART_SIZE = 200;
const INNER_RADIUS = 55;
const OUTER_RADIUS = 85;
const TARGET_RADIUS = 40;
const STROKE_WIDTH = 22;
const TARGET_STROKE_WIDTH = 18;

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

export default function CategoryDonutChart({ categories }: CategoryDonutChartProps) {
  const centerX = CHART_SIZE / 2;
  const centerY = CHART_SIZE / 2;

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

  return (
    <View style={styles.container}>
      <View style={styles.chartContainer}>
        <Svg width={CHART_SIZE} height={CHART_SIZE}>
          {/* Target allocations (inner ring) */}
          <G>
            {targetSegments.map((segment, index) => {
              // Only render if percentage is greater than 0
              if (segment.percentage <= 0) return null;
              
              const circumference = 2 * Math.PI * TARGET_RADIUS;
              const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((segment.startAngle / 360) * circumference);
              
              return (
                <Circle
                  key={`target-${index}`}
                  cx={centerX}
                  cy={centerY}
                  r={TARGET_RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={TARGET_STROKE_WIDTH}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  opacity={0.7}
                  transform={`rotate(-90 ${centerX} ${centerY})`}
                />
              );
            })}
          </G>

          {/* Current allocations (outer ring) */}
          <G>
            {currentSegments.map((segment, index) => {
              // Only render if percentage is greater than 0
              if (segment.percentage <= 0) return null;
              
              const circumference = 2 * Math.PI * OUTER_RADIUS;
              const strokeDasharray = `${(segment.percentage / 100) * circumference} ${circumference}`;
              const strokeDashoffset = -((segment.startAngle / 360) * circumference);
              
              return (
                <Circle
                  key={`current-${index}`}
                  cx={centerX}
                  cy={centerY}
                  r={OUTER_RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={STROKE_WIDTH}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform={`rotate(-90 ${centerX} ${centerY})`}
                />
              );
            })}
          </G>
        </Svg>

        {/* Center label */}
        <View style={styles.centerLabel}>
          <Text style={styles.centerLabelText}>Current vs</Text>
          <Text style={styles.centerLabelText}>Target</Text>
        </View>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  chartContainer: {
    position: 'relative',
    width: CHART_SIZE,
    height: CHART_SIZE,
  },
  centerLabel: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -30 }, { translateY: -12 }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerLabelText: {
    color: theme.colors.muted,
    ...getTextStyle('xs'),
    textAlign: 'center',
    lineHeight: 14,
  },
});