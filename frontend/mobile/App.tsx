import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { ChartSpline, ChartPie } from 'lucide-react-native';

import PortfolioScreen from './src/screens/PortfolioScreen';
import AllocationsScreen from './src/screens/AllocationsScreen';
import { theme } from './src/styles/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
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
            borderTopColor: "#333333",
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
      <StatusBar style="light" />
    </NavigationContainer>
  );
}
