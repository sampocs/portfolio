import React from 'react';
import { View, Text, Image } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import { AssetPriceChange } from '../data/assetTypes';
import RollingText from './RollingText';

// Asset image mapping
const assetImages: { [key: string]: any } = {
  'VT': require('../../assets/images/VT.png'),
  'VOO': require('../../assets/images/VOO.png'),
  'VO': require('../../assets/images/VO.png'),
  'VB': require('../../assets/images/VB.png'),
  'VXUS': require('../../assets/images/VXUS.png'),
  'VWO': require('../../assets/images/VWO.png'),
  'COIN': require('../../assets/images/COIN.png'),
  'HOOD': require('../../assets/images/HOOD.png'),
  'AAAU': require('../../assets/images/AAAU.png'),
  'VNQ': require('../../assets/images/VNQ.png'),
  'BTC': require('../../assets/images/BTC.png'),
  'ETH': require('../../assets/images/ETH.png'),
  'SOL': require('../../assets/images/SOL.png'),
};

interface AssetPriceHeaderProps {
  priceChange: AssetPriceChange;
  isLoading?: boolean;
  selectedDate?: string;
  updatedAt?: string;
  animateChanges?: boolean;
  assetSymbol?: string;
  assetName?: string;
}

export default function AssetPriceHeader({ priceChange, isLoading = false, selectedDate, updatedAt, animateChanges = false, assetSymbol, assetName }: AssetPriceHeaderProps) {
  const { currentPrice, changeAmount, changePercent, isPositive } = priceChange;

  // Get image source from mapping
  const imageSource = assetSymbol ? assetImages[assetSymbol] : null;

  const formatPrice = (price: number): string => {
    if (price >= 1000) {
      return price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return price.toFixed(2);
  };

  const formatPriceChange = (change: number): string => {
    const sign = change >= 0 ? '+' : '-';
    return `${sign}$${Math.abs(change).toFixed(2)}`;
  };

  const formatPercentChange = (percent: number): string => {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
  };

  const formatSelectedDate = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    return `${month} ${day}, ${year}`;
  };

  const formatUpdatedAt = (dateString: string): string => {
    const date = new Date(dateString);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const day = date.getDate();
    const time = date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    }).toLowerCase();
    return `${month} ${day}, ${time}`;
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>---.--</Text>
        </View>
        
        <View style={styles.changeContainer}>
          <Text style={[styles.changeAmount, { color: theme.colors.muted }]}>
            +$--.--
          </Text>
          
          <View style={[styles.changePercentContainer, { backgroundColor: theme.colors.card }]}>
            <Text style={[styles.changePercent, { color: theme.colors.muted }]}>
              +--.--% 
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.assetLabelContainer}>
        {assetSymbol && (
          <View style={styles.logoContainer}>
            {imageSource ? (
              <Image 
                source={imageSource} 
                style={styles.logoImage}
                resizeMode="contain"
              />
            ) : (
              <View style={styles.logoFallback}>
                <Text style={styles.logoText}>{assetSymbol}</Text>
              </View>
            )}
          </View>
        )}
        <Text style={styles.assetLabel}>{assetName || assetSymbol || 'Asset'}</Text>
      </View>
      
      <View style={styles.priceContainer}>
        <Text style={styles.currentPrice}>
          ${formatPrice(currentPrice)}
        </Text>
      </View>
      
      <View style={styles.changeContainer}>
        <RollingText
          text={formatPriceChange(changeAmount)}
          style={[
            styles.changeAmount,
            { color: isPositive ? theme.colors.success : theme.colors.destructive }
          ]}
          animate={animateChanges}
        />
        
        <View style={[
          styles.changePercentContainer,
          { backgroundColor: isPositive ? theme.colors.successBackground : theme.colors.destructiveBackground }
        ]}>
          <RollingText
            text={formatPercentChange(changePercent)}
            style={[
              styles.changePercent,
              { color: isPositive ? theme.colors.success : theme.colors.destructive }
            ]}
            animate={animateChanges}
          />
        </View>
      </View>
      
      <View style={styles.dateContainer}>
        <Text style={styles.dateText}>
          {selectedDate ? formatSelectedDate(selectedDate) : 
           updatedAt ? formatUpdatedAt(updatedAt) : ' '}
        </Text>
      </View>
    </View>
  );
}

const styles = createStyles({
  container: {
    marginBottom: theme.spacing.md,
  },
  assetLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  logoContainer: {
    marginRight: theme.spacing.sm,
  },
  logoImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  logoFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: theme.colors.foreground,
    fontSize: 10,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  assetLabel: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
  },
  priceContainer: {
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  currentPrice: {
    color: theme.colors.foreground,
    fontSize: 36,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
    lineHeight: 40,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeAmount: {
    fontSize: 17,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    marginRight: theme.spacing.sm,
  },
  changePercentContainer: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  changePercent: {
    fontSize: 15,
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontFamily,
  },
  dateContainer: {
    marginTop: theme.spacing.xs,
    minHeight: 16,
  },
  dateText: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
  },
});