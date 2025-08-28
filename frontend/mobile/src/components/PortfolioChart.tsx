import React, { useMemo } from 'react';
import { View } from 'react-native';
import FinancialChart, { ChartDataPoint } from './FinancialChart';
import { PortfolioDurationSelector } from './DurationSelector';
import { PerformanceData } from '../data/types';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';

interface PortfolioChartProps {
  data: PerformanceData[];
  onDataPointSelected?: (dataPoint: PerformanceData | null) => void;
  isLoading?: boolean;
  isCached?: boolean;
  selectedGranularity?: string;
  onGranularityChange?: (granularity: string) => void;
}

export default function PortfolioChart({ 
  data, 
  onDataPointSelected, 
  isLoading = false,
  isCached = false,
  selectedGranularity = 'ALL',
  onGranularityChange
}: PortfolioChartProps) {
  
  // Transform portfolio performance data for chart
  const chartData: ChartDataPoint[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    return data.map((item, index) => ({
      x: index,
      y: parseFloat(item.value),
      date: item.date,
      value: parseFloat(item.value),
      originalData: item
    }));
  }, [data]);

  // Determine if overall portfolio return is positive
  const isPositive = useMemo(() => {
    if (chartData.length === 0) return true;
    const first = chartData[0];
    const last = chartData[chartData.length - 1];
    return last.y >= first.y;
  }, [chartData]);

  const handleDataPointSelected = (dataPoint: any) => {
    if (onDataPointSelected) {
      onDataPointSelected(dataPoint);
    }
  };

  return (
    <>
      <FinancialChart
        data={chartData}
        onDataPointSelected={handleDataPointSelected}
        isLoading={isLoading}
        isCached={isCached}
        isPositive={isPositive}
        showGradient={true}
      />
      
      <View style={styles.durationSelectorContainer}>
        <PortfolioDurationSelector
          selectedDuration={selectedGranularity as any}
          onDurationChange={onGranularityChange as any}
        />
      </View>
    </>
  );
}

const styles = createStyles({
  durationSelectorContainer: {
    zIndex: 999,
    elevation: 999,
  },
});