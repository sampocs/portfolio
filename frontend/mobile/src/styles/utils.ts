import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const createStyles = <T extends StyleSheet.NamedStyles<T>>(styles: T): T => {
  return StyleSheet.create(styles);
};

export const getTextStyle = (size: keyof typeof theme.typography.sizes, weight: keyof typeof theme.typography.weights = 'normal') => ({
  fontSize: theme.typography.sizes[size],
  fontWeight: theme.typography.weights[weight],
  fontFamily: theme.typography.fontFamily,
});

export const formatCurrency = (value: number): string => {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatPercentage = (value: number): string => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};