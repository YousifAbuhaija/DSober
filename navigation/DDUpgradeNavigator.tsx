import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { theme } from '../theme';
import DriverInfoScreen from '../screens/onboarding/DriverInfoScreen';

export type DDUpgradeStackParamList = {
  DriverInfo: { mode: 'upgrade' };
};

const Stack = createStackNavigator<DDUpgradeStackParamList>();

export default function DDUpgradeNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        presentation: 'modal',
        headerStyle: {
          backgroundColor: theme.colors.background.primary,
        },
        headerTintColor: theme.colors.text.primary,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Stack.Screen 
        name="DriverInfo" 
        component={DriverInfoScreen}
        options={{ title: 'Become a DD' }}
        initialParams={{ mode: 'upgrade' }}
      />
    </Stack.Navigator>
  );
}
