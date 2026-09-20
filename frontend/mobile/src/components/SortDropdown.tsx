import React, { useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, Dimensions } from 'react-native';
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

export const ASSET_SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'alphabetical', label: 'Alphabetical' },
  { value: 'highest-value', label: 'Highest Value' },
  { value: 'lowest-value', label: 'Lowest Value' },
  { value: 'highest-gains', label: 'Highest Gains ($)' },
  { value: 'lowest-gains', label: 'Lowest Gains ($)' },
  { value: 'highest-returns', label: 'Highest Returns (%)' },
  { value: 'lowest-returns', label: 'Lowest Returns (%)' },
];

// Menu geometry used to decide whether it fits below the trigger
const OPTION_ROW_HEIGHT = 38;
const MENU_MAX_HEIGHT = 300;

type MenuAnchor = { top: number; right: number } | { bottom: number; right: number };

interface SortDropdownProps<T extends string> {
  selectedSort: T;
  onSortChange: (sort: T) => void;
  options: { value: T; label: string }[];
}

export default function SortDropdown<T extends string>({ selectedSort, onSortChange, options }: SortDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  // The options render in a Modal (a separate native window), so the trigger's window
  // position is measured on open to anchor the menu directly beneath it, right-aligned
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<MenuAnchor>({ top: 0, right: 0 });

  const selectedOption = options.find(option => option.value === selectedSort);

  const openDropdown = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const window = Dimensions.get('window');
      const right = window.width - (x + width);
      const menuHeight = Math.min(options.length * OPTION_ROW_HEIGHT, MENU_MAX_HEIGHT);
      const below = y + height + theme.spacing.xs;

      // Open upward when the menu would run off the bottom of the screen, which happens
      // for the portfolio list once its trigger has scrolled low enough
      const fitsBelow = below + menuHeight <= window.height - theme.spacing.xl;
      setAnchor(fitsBelow ? { top: below, right } : { bottom: window.height - y + theme.spacing.xs, right });
      setIsOpen(true);
    });
  };

  const handleOptionSelect = (option: T) => {
    onSortChange(option);
    setIsOpen(false);
  };

  return (
    <View style={styles.container} ref={triggerRef}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={openDropdown}
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
          <View style={[styles.dropdown, anchor]}>
            <ScrollView style={styles.optionsList}>
              {options.map((option) => (
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
  },
  dropdown: {
    position: 'absolute',
    backgroundColor: theme.colors.card,
    borderRadius: theme.borderRadius.lg,
    // Clip the option rows (the selected one is filled) to the rounded corners
    overflow: 'hidden',
    maxHeight: MENU_MAX_HEIGHT,
    minWidth: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  optionsList: {
    maxHeight: 280,
    // A ScrollView grows to its maxHeight by default, leaving dead space under short
    // option lists (the watch list has three) - size it to the content instead
    flexGrow: 0,
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