import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export type SortOption = 
  | 'alphabetical'
  | 'highest-value'
  | 'lowest-value'
  | 'highest-gains'
  | 'lowest-gains'
  | 'highest-returns'
  | 'lowest-returns';

interface SortDropdownProps {
  selectedSort: SortOption;
  onSortChange: (sort: SortOption) => void;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'highest-value', label: 'Highest Value' },
  { value: 'lowest-value', label: 'Lowest Value' },
  { value: 'highest-gains', label: 'Highest Gains ($)' },
  { value: 'lowest-gains', label: 'Lowest Gains ($)' },
  { value: 'highest-returns', label: 'Highest Returns (%)' },
  { value: 'lowest-returns', label: 'Lowest Returns (%)' },
];

export default function SortDropdown({ selectedSort, onSortChange }: SortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = sortOptions.find(option => option.value === selectedSort);

  const handleOptionSelect = (option: SortOption) => {
    onSortChange(option);
    setIsOpen(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.triggerText} numberOfLines={1}>
          {selectedOption?.label || 'Sort'}
        </Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setIsOpen(false)}
        >
          <View style={styles.dropdown}>
            <ScrollView style={styles.optionsList}>
              {sortOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.option,
                    selectedSort === option.value && styles.selectedOption
                  ]}
                  onPress={() => handleOptionSelect(option.value)}
                >
                  <Text
                    style={[
                      styles.optionText,
                      selectedSort === option.value && styles.selectedOptionText
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = createStyles({
  container: {
    position: 'relative',
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.accent,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: 20,
  },
  triggerText: {
    color: theme.colors.foreground,
    fontSize: 12,
    fontWeight: theme.typography.weights.normal,
    fontFamily: theme.typography.fontFamily,
    textAlign: 'right',
  },
  arrow: {
    color: theme.colors.muted,
    fontSize: 12,
    marginLeft: theme.spacing.xs,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dropdown: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.md,
    maxHeight: 300,
    minWidth: 180,
    marginHorizontal: theme.spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  optionsList: {
    maxHeight: 280,
  },
  option: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.accent,
  },
  selectedOption: {
    backgroundColor: theme.colors.accent,
  },
  optionText: {
    color: theme.colors.foreground,
    ...getTextStyle('sm'),
  },
  selectedOptionText: {
    color: theme.colors.foreground,
    ...getTextStyle('sm', 'medium'),
  },
});