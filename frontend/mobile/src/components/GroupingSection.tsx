import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export type GroupingType = 'categories' | 'assets';

interface GroupingSectionProps {
  selectedGrouping: GroupingType;
  onGroupingChange: (grouping: GroupingType) => void;
}

export default function GroupingSection({ selectedGrouping, onGroupingChange }: GroupingSectionProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          selectedGrouping === 'categories' && styles.selectedButton
        ]}
        onPress={() => onGroupingChange('categories')}
      >
        <Text style={[
          styles.buttonText,
          selectedGrouping === 'categories' && styles.selectedButtonText
        ]}>
          Categories
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
    marginBottom: theme.spacing.xl,
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