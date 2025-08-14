import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

interface CategorySelectorProps {
  selectedCategories: { stocks: boolean; crypto: boolean; alternatives: boolean };
  onCategoryToggle: (category: 'stocks' | 'crypto' | 'alternatives') => void;
}

export default function CategorySelector({ selectedCategories, onCategoryToggle }: CategorySelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          selectedCategories.stocks && styles.selectedButton
        ]}
        onPress={() => onCategoryToggle('stocks')}
      >
        <Text style={[
          styles.buttonText,
          selectedCategories.stocks && styles.selectedButtonText
        ]}>
          Stocks
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.button,
          selectedCategories.crypto && styles.selectedButton
        ]}
        onPress={() => onCategoryToggle('crypto')}
      >
        <Text style={[
          styles.buttonText,
          selectedCategories.crypto && styles.selectedButtonText
        ]}>
          Crypto
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[
          styles.button,
          selectedCategories.alternatives && styles.selectedButton
        ]}
        onPress={() => onCategoryToggle('alternatives')}
      >
        <Text style={[
          styles.buttonText,
          selectedCategories.alternatives && styles.selectedButtonText
        ]}>
          Alternatives
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