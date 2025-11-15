import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import BasicInfoScreen from './onboarding/BasicInfoScreen';
import GroupJoinScreen from './onboarding/GroupJoinScreen';
import DDInterestScreen from './onboarding/DDInterestScreen';
import DriverInfoScreen from './onboarding/DriverInfoScreen';

const Stack = createStackNavigator();

export default function OnboardingScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
        headerTintColor: '#007AFF',
      }}
    >
      <Stack.Screen
        name="BasicInfo"
        component={BasicInfoScreen}
        options={{ title: 'Basic Information' }}
      />
      <Stack.Screen
        name="GroupJoin"
        component={GroupJoinScreen}
        options={{ title: 'Join Chapter' }}
      />
      <Stack.Screen
        name="DDInterest"
        component={DDInterestScreen}
        options={{ title: 'Designated Driver' }}
      />
      <Stack.Screen
        name="DriverInfo"
        component={DriverInfoScreen}
        options={{ title: 'Driver Information' }}
      />
    </Stack.Navigator>
  );
}
