import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { createStyles, getTextStyle } from '../styles/utils';
import CategorySelector from '../components/CategorySelector';

export default function PortfolioScreen() {
  const [selectedCategories, setSelectedCategories] = useState({
    stocks: true,
    crypto: false,
  });

  const handleCategoryToggle = (category: 'stocks' | 'crypto') => {
    setSelectedCategories(prev => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const getDisplayText = () => {
    if (selectedCategories.stocks && selectedCategories.crypto) {
      return 'Showing All Categories';
    } else if (selectedCategories.stocks) {
      return 'Showing Stocks';
    } else if (selectedCategories.crypto) {
      return 'Showing Crypto';
    } else {
      return 'No Categories Selected';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Portfolio</Text>
      </View>
      <ScrollView style={styles.scrollContent}>
        <CategorySelector
          selectedCategories={selectedCategories}
          onCategoryToggle={handleCategoryToggle}
        />
        <Text style={styles.placeholder}>
          {getDisplayText()} - other components will go here
        </Text>
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