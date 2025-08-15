import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export type AllocationGroupingType = 'markets' | 'segments' | 'assets';

interface AllocationGroupingSelectorProps {
  selectedGrouping: AllocationGroupingType;
  onGroupingChange: (grouping: AllocationGroupingType) => void;
}

/**
 * AllocationGroupingSelector - Toggle buttons for choosing allocation display mode
 * 
 * Allows users to switch between different ways of viewing their portfolio allocations:
 * by markets (stocks, crypto, alternatives), segments (specific categories), or individual assets.
 */
export default function AllocationGroupingSelector({ selectedGrouping, onGroupingChange }: AllocationGroupingSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          selectedGrouping === 'markets' && styles.selectedButton
        ]}
        onPress={() => onGroupingChange('markets')}
      >
        <Text style={[
          styles.buttonText,
          selectedGrouping === 'markets' && styles.selectedButtonText
        ]}>
          Markets
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.button,
          selectedGrouping === 'segments' && styles.selectedButton
        ]}
        onPress={() => onGroupingChange('segments')}
      >
        <Text style={[
          styles.buttonText,
          selectedGrouping === 'segments' && styles.selectedButtonText
        ]}>
          Segments
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.button,
          selectedGrouping === 'assets' && styles.selectedButton
        ]}
        onPress={() => onGroupingChange('assets')}
      >
        <Text style={[
          styles.buttonText,
          selectedGrouping === 'assets' && styles.selectedButtonText
        ]}>
          Assets
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = createStyles({
  container: {
    flexDirection: 'row',
    marginBottom: theme.spacing.sm - 4, // Reduced by 4px to offset chart size increase
  },
  button: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.colors.muted,
    borderRadius: 20,
    backgroundColor: theme.colors.background,
    marginRight: theme.spacing.sm,
  },
  selectedButton: {
    borderColor: theme.colors.foreground,
  },
  buttonText: {
    color: theme.colors.muted,
    ...getTextStyle('sm'),
  },
  selectedButtonText: {
    color: theme.colors.foreground,
  },
});