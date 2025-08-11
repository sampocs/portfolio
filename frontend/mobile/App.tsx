import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import PortfolioScreen from './src/screens/PortfolioScreen';
import AllocationsScreen from './src/screens/AllocationsScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: keyof typeof Ionicons.glyphMap;

            if (route.name === 'Portfolio') {
              iconName = focused ? 'trending-up' : 'trending-up-outline';
            } else if (route.name === 'Allocations') {
              iconName = focused ? 'bar-chart' : 'bar-chart-outline';
            } else {
              iconName = 'help-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#F5F5F5',
          tabBarInactiveTintColor: '#999999',
          tabBarStyle: {
            backgroundColor: '#000000',
            borderTopColor: '#171717',
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
