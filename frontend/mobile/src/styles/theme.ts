export const colors = {
  background: '#000000',
  foreground: '#F5F5F5',
  muted: '#999999',
  card: '#171717',
  accent: '#242424',
  destructive: '#FF3249',
  destructiveBackground: '#48070F',
  success: '#34D86C',
  successBackground: '#00351D',
};

export const typography = {
  fontFamily: 'Roobertpro',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  weights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
};

export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
};