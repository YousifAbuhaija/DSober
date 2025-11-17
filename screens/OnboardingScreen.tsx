import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { theme } from '../theme/colors';
import BasicInfoScreen from './onboarding/BasicInfoScreen';
import GroupJoinScreen from './onboarding/GroupJoinScreen';
import DDInterestScreen from './onboarding/DDInterestScreen';
import DriverInfoScreen from './onboarding/DriverInfoScreen';
import ProfilePhotoScreen from './onboarding/ProfilePhotoScreen';
import SEPReactionScreen from './onboarding/SEPReactionScreen';
import SEPPhraseScreen from './onboarding/SEPPhraseScreen';
import SEPSelfieScreen from './onboarding/SEPSelfieScreen';
import SEPResultScreen from './onboarding/SEPResultScreen';
import OnboardingCompleteScreen from './onboarding/OnboardingCompleteScreen';

export type OnboardingStackParamList = {
  BasicInfo: undefined;
  GroupJoin: undefined;
  DDInterest: undefined;
  DriverInfo: undefined;
  ProfilePhoto: undefined;
  SEPReaction: { mode: 'baseline' | 'attempt'; eventId?: string };
  SEPPhrase: {
    mode: 'baseline' | 'attempt';
    reactionAvgMs: number;
    eventId?: string;
  };
  SEPSelfie: {
    mode: 'baseline' | 'attempt';
    reactionAvgMs: number;
    phraseDurationSec: number;
    audioUrl: string;
    eventId?: string;
  };
  SEPResult: {
    eventId?: string;
    reactionAvgMs: number;
    phraseDurationSec: number;
    selfieUrl: string;
  };
  OnboardingComplete: undefined;
};

const Stack = createStackNavigator<OnboardingStackParamList>();

export default function OnboardingScreen() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: true,
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
      <Stack.Screen
        name="ProfilePhoto"
        component={ProfilePhotoScreen}
        options={{ title: 'Profile Photo' }}
      />
      <Stack.Screen
        name="SEPReaction"
        component={SEPReactionScreen}
        options={{ title: 'Reaction Time Test' }}
      />
      <Stack.Screen
        name="SEPPhrase"
        component={SEPPhraseScreen}
        options={{ title: 'Phrase Recording' }}
      />
      <Stack.Screen
        name="SEPSelfie"
        component={SEPSelfieScreen}
        options={{ title: 'Selfie Capture' }}
      />
      <Stack.Screen
        name="SEPResult"
        component={SEPResultScreen}
        options={{ 
          title: 'SEP Results',
          headerLeft: () => null, // Prevent going back
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
      <Stack.Screen
        name="OnboardingComplete"
        component={OnboardingCompleteScreen}
        options={{ 
          title: 'Setup Complete',
          headerLeft: () => null, // Prevent going back
          gestureEnabled: false, // Disable swipe back gesture
        }}
      />
    </Stack.Navigator>
  );
}
