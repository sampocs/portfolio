import React from 'react';
import { View, Text, Image, TouchableOpacity } from 'react-native';
import { Svg, Polyline } from 'react-native-svg';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { WatchlistAsset } from '../data/types';
import { PortfolioDuration } from '../data/assetTypes';
import { getAssetLogo } from '../utils/assetRegistry';

const SPARKLINE_WIDTH = 64;
const SPARKLINE_HEIGHT = 24;

interface SparklineProps {
  points: number[];
  color: string;
}

// Price line over the selected duration. The points are already downsampled by the
// backend, so this only scales them into the box.
function Sparkline({ points, color }: SparklineProps) {
  if (points.length < 2) {
    return <View style={styles.sparkline} />;
  }

  const low = Math.min(...points);
  const high = Math.max(...points);
  const range = high - low || 1;
  const coordinates = points
    .map((price, index) => {
      const x = (index * SPARKLINE_WIDTH) / (points.length - 1);
      const y = SPARKLINE_HEIGHT - 1 - ((price - low) / range) * (SPARKLINE_HEIGHT - 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <Svg width={SPARKLINE_WIDTH} height={SPARKLINE_HEIGHT} style={styles.sparkline}>
      <Polyline points={coordinates} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}

interface WatchListRowProps {
  asset: WatchlistAsset;
  duration: PortfolioDuration;
  isFirst?: boolean;
  isLast?: boolean;
  onPress?: (asset: WatchlistAsset) => void;
}

export default function WatchListRow({ asset, duration, isFirst = false, isLast = false, onPress }: WatchListRowProps) {
  // Get image source from centralized registry
  const imageSource = getAssetLogo(asset.asset);

  const currentPrice = parseFloat(asset.current_price);
  const changePercent = parseFloat(asset.changes[duration]);
  const isPositive = changePercent >= 0;
  const changeColor = isPositive ? theme.colors.success : theme.colors.destructive;
  const sparklinePoints = (asset.sparklines[duration] ?? []).map(parseFloat);

  // Format numbers - matches AssetRow's formatPrice
  const formatPrice = (value: number): string => {
    if (value >= 1000) {
      return new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    }
    return value.toFixed(2);
  };

  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '-';
    return `${sign}${Math.abs(value).toFixed(2)}%`;
  };

  // Dynamic container style based on position
  const containerStyle = [
    styles.container,
    isFirst && styles.firstContainer,
    isLast && styles.lastContainer,
    !isLast && styles.separatorContainer,
  ];

  const handlePress = () => {
    if (onPress) {
      onPress(asset);
    }
  };

  const Component = onPress ? TouchableOpacity : View;
  const touchableProps = onPress ? {
    onPress: handlePress,
    activeOpacity: 0.7,
  } : {};

  return (
    <Component style={containerStyle} {...touchableProps}>
      <View style={styles.leftSection}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.logoImage}
            resizeMode="contain"
          />
        ) : (
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>{asset.asset}</Text>
          </View>
        )}
        <View style={styles.assetInfo}>
          <Text style={styles.ticker}>{asset.asset}</Text>
          <Text style={styles.details}>{asset.description}</Text>
        </View>
        <Sparkline points={sparklinePoints} color={changeColor} />
      </View>

      <View style={styles.rightSection}>
        <Text style={styles.currentPrice}>${formatPrice(currentPrice)}</Text>
        <Text style={[styles.percentText, { color: changeColor }]}>
          {formatPercent(changePercent)}
        </Text>
      </View>
    </Component>
  );
}

const styles = createStyles({
  container: {
    backgroundColor: theme.colors.card,
    padding: theme.spacing.md,
    borderRadius: 0,
    marginBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  firstContainer: {
    borderTopLeftRadius: theme.borderRadius.md,
    borderTopRightRadius: theme.borderRadius.md,
  },
  lastContainer: {
    borderBottomLeftRadius: theme.borderRadius.md,
    borderBottomRightRadius: theme.borderRadius.md,
  },
  separatorContainer: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: theme.spacing.md,
  },
  logoText: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'bold'),
    fontSize: 12,
  },
  assetInfo: {
    flex: 1,
  },
  ticker: {
    color: theme.colors.foreground,
    fontSize: 16,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  details: {
    color: theme.colors.muted,
    fontSize: 12,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
  // Sits between the name and the price; the right margin roughly centers it in the
  // gap once the widest prices are accounted for
  sparkline: {
    width: SPARKLINE_WIDTH,
    height: SPARKLINE_HEIGHT,
    marginRight: 22,
  },
  rightSection: {
    alignItems: 'flex-end',
    minWidth: 96,
  },
  currentPrice: {
    color: theme.colors.foreground,
    fontSize: 17,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  percentText: {
    fontSize: 13,
    fontWeight: theme.typography.weights.semibold,
    fontFamily: theme.typography.fontFamily,
    marginTop: 2,
  },
});
