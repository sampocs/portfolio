import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { theme } from '../styles/theme';
import { createStyles } from '../styles/utils';

export type PortfolioDuration = '1W' | '1M' | 'YTD' | '1Y' | 'ALL';
export type AssetDuration = '1D' | '1W' | '1M' | 'YTD' | '1Y';

export interface DurationSelectorProps<T extends string> {
  durations: T[];
  selectedDuration?: T;
  onDurationChange: (duration: T) => void;
  defaultDuration?: T;
}

function DurationSelector<T extends string>({ 
  durations, 
  selectedDuration, 
  onDurationChange,
  defaultDuration 
}: DurationSelectorProps<T>) {
  const [internalSelected, setInternalSelected] = useState<T>(
    selectedDuration || defaultDuration || durations[0]
  );

  const currentSelection = selectedDuration !== undefined ? selectedDuration : internalSelected;

  const handlePress = (duration: T) => {
    if (selectedDuration === undefined) {
      setInternalSelected(duration);
    }
    onDurationChange(duration);
  };

  return (
    <View style={styles.container}>
      {durations.map((duration) => (
        <TouchableOpacity
          key={duration}
          style={[
            styles.button,
            currentSelection === duration && styles.buttonSelected,
          ]}
          onPress={() => handlePress(duration)}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.text,
              currentSelection === duration && styles.textSelected,
            ]}
          >
            {duration}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Convenience components for specific use cases
export function PortfolioDurationSelector({ 
  selectedDuration, 
  onDurationChange 
}: {
  selectedDuration?: PortfolioDuration;
  onDurationChange: (duration: PortfolioDuration) => void;
}) {
  return (
    <DurationSelector
      durations={['1W', '1M', 'YTD', '1Y', 'ALL']}
      selectedDuration={selectedDuration}
      onDurationChange={onDurationChange}
      defaultDuration="ALL"
    />
  );
}

export function AssetDurationSelector({ 
  selectedDuration, 
  onDurationChange 
}: {
  selectedDuration?: AssetDuration;
  onDurationChange: (duration: AssetDuration) => void;
}) {
  return (
    <DurationSelector
      durations={['1D', '1W', '1M', 'YTD', '1Y']}
      selectedDuration={selectedDuration}
      onDurationChange={onDurationChange}
      defaultDuration="1Y"
    />
  );
}

const styles = createStyles({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.sm,
    marginTop: 2,
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: theme.spacing.xs,
    marginHorizontal: theme.spacing.xs,
    borderRadius: 16,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  buttonSelected: {
    backgroundColor: theme.colors.accent,
  },
  text: {
    color: theme.colors.muted,
    fontSize: 14,
    fontFamily: theme.typography.fontFamily,
    fontWeight: '500',
  },
  textSelected: {
    color: theme.colors.foreground,
  },
});

export default DurationSelector;