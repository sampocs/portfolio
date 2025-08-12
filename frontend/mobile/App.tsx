import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';

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
            let iconName: string;

            if (route.name === 'Portfolio') {
              iconName = 'chart-area';
            } else if (route.name === 'Allocations') {
              iconName = 'chart-pie';
            } else {
              iconName = 'question';
            }

            return <FontAwesome5 name={iconName} size={size} color={color} solid={focused} />;
          },
          tabBarActiveTintColor: theme.colors.foreground,
          tabBarInactiveTintColor: theme.colors.muted,
          tabBarStyle: {
            backgroundColor: theme.colors.background,
            borderTopColor: theme.colors.card,
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
