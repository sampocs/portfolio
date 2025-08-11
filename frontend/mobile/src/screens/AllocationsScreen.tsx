import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';

export default function AllocationsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Allocations</Text>
      </View>
      <ScrollView style={styles.scrollContent}>
        <Text style={styles.placeholder}>Allocations content will go here</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = createStyles({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
  },
  headerText: {
    color: theme.colors.foreground,
    ...getTextStyle('xxl', 'bold'),
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  placeholder: {
    color: theme.colors.muted,
    ...getTextStyle('md'),
    textAlign: 'center',
    marginTop: 50,
  },
});