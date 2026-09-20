import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChartSpline, ChartPie, Eye } from 'lucide-react-native';

import PortfolioScreen from './src/screens/PortfolioScreen';
import AllocationsScreen from './src/screens/AllocationsScreen';
import WatchListScreen from './src/screens/WatchListScreen';
import AssetDetailScreen from './src/screens/AssetDetailScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import { DataProvider, useData } from './src/contexts/DataContext';
import { theme } from './src/styles/theme';
import SkeletonLoadingScreen from './src/components/SkeletonLoadingScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Portfolio stack navigator
function PortfolioStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="PortfolioMain" component={PortfolioScreen} />
      <Stack.Screen name="AssetDetail" component={AssetDetailScreen} />
    </Stack.Navigator>
  );
}

// Watch list stack navigator - mirrors PortfolioStack so back returns to the watch list
function WatchListStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="WatchListMain" component={WatchListScreen} />
      <Stack.Screen name="AssetDetail" component={AssetDetailScreen} />
    </Stack.Navigator>
  );
}

// Main app content component (inside DataProvider)
function AppContent() {
  const { isAuthenticated, isCheckingAuth, hasCompletedOnboarding, setAuthenticated, switchToDemo } = useData();

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return <SkeletonLoadingScreen title="Loading..." />;
  }

  // Show welcome screen for new users (haven't completed onboarding)
  if (!hasCompletedOnboarding) {
    return (
      <WelcomeScreen
        onAuthenticationSuccess={() => setAuthenticated(true)}
        onDemoMode={() => switchToDemo()}
      />
    );
  }

  // Show main app if authenticated
  return (
    <Tab.Navigator
      initialRouteName="Portfolio"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Watch List') {
            return <Eye size={size} color={color} />;
          } else if (route.name === 'Portfolio') {
            return <ChartSpline size={size} color={color} />;
          } else if (route.name === 'Allocations') {
            return <ChartPie size={size} color={color} />;
          }
          return null;
        },
        tabBarActiveTintColor: theme.colors.foreground,
        tabBarInactiveTintColor: theme.colors.muted,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingTop: 8,
          height: 90,
        },
        tabBarLabelStyle: {
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Watch List" component={WatchListStack} />
      <Tab.Screen name="Portfolio" component={PortfolioStack} />
      <Tab.Screen name="Allocations" component={AllocationsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <View style={styles.rootContainer}>
      <DataProvider>
        <NavigationContainer>
          <AppContent />
          <StatusBar style="light" />
        </NavigationContainer>
      </DataProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#0B0022',
  },
});
