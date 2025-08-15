import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartSpline, ChartPie } from 'lucide-react-native';

import PortfolioScreen from './src/screens/PortfolioScreen';
import AllocationsScreen from './src/screens/AllocationsScreen';
import WelcomeScreen from './src/screens/WelcomeScreen';
import { DataProvider, useData } from './src/contexts/DataContext';
import { theme } from './src/styles/theme';
import LoadingScreen from './src/components/LoadingScreen';

const Tab = createBottomTabNavigator();

// Main app content component (inside DataProvider)
function AppContent() {
  const { isAuthenticated, isCheckingAuth, hasCompletedOnboarding, setAuthenticated, switchToDemo } = useData();

  // Show loading screen while checking authentication
  if (isCheckingAuth) {
    return <LoadingScreen title="Loading..." />;
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
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Portfolio') {
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
      <Tab.Screen name="Portfolio" component={PortfolioScreen} />
      <Tab.Screen name="Allocations" component={AllocationsScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <DataProvider>
      <NavigationContainer>
        <AppContent />
        <StatusBar style="light" />
      </NavigationContainer>
    </DataProvider>
  );
}
