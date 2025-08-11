import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  headerText: {
    color: '#F5F5F5',
    fontSize: 24,
    fontWeight: 'bold',
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
  },
  placeholder: {
    color: '#999999',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
});