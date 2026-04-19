import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { colors } from '../theme';
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
          backgroundColor: colors.bg.canvas,
        },
        headerTintColor: colors.text.primary,
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
