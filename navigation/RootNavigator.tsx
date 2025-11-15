import React, { useEffect, useState, useMemo } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainAppScreen from '../screens/MainAppScreen';

const Stack = createStackNavigator();

export default function RootNavigator() {
  const { session, user, loading } = useAuth();
  const [hasSEPBaseline, setHasSEPBaseline] = useState(false);
  const [checkingBaseline, setCheckingBaseline] = useState(true);

  // Check if user has completed SEP baseline
  useEffect(() => {
    const checkSEPBaseline = async () => {
      if (!user?.id) {
        setHasSEPBaseline(false);
        setCheckingBaseline(false);
        return;
      }

      setCheckingBaseline(true);
      
      try {
        const { data, error } = await supabase
          .from('sep_baselines')
          .select('id')
          .eq('user_id', user.id)
          .single();

        setHasSEPBaseline(!!data && !error);
      } catch (error) {
        console.error('Error checking SEP baseline:', error);
        setHasSEPBaseline(false);
      } finally {
        setCheckingBaseline(false);
      }
    };

    checkSEPBaseline();
  }, [user?.id]); // Only re-run when user ID changes, not when user object updates

  // Authenticated - check if profile is complete
  // Profile is complete when:
  // 1. Basic info is filled (name, groupId)
  // 2. If user is a DD (isDD = true), they must have provided driver info
  // 3. SEP baseline is established
  const isProfileComplete = useMemo(() => {
    const hasBasicInfo = user && user.name && user.groupId;
    const hasCompletedDDFlow = !user?.isDD || (user.carMake && user.carModel && user.carPlate);
    const complete = hasBasicInfo && hasCompletedDDFlow && hasSEPBaseline;
    
    console.log('Profile completion check:', {
      hasBasicInfo,
      hasCompletedDDFlow,
      hasSEPBaseline,
      isComplete: complete,
      userName: user?.name,
      userGroupId: user?.groupId,
    });
    
    return complete;
  }, [user?.name, user?.groupId, user?.isDD, user?.carMake, user?.carModel, user?.carPlate, hasSEPBaseline]);

  // Show loading screen while checking auth state or SEP baseline
  if (loading || checkingBaseline) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // Not authenticated - show auth screen
  if (!session) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isProfileComplete ? (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Stack.Screen name="MainApp" component={MainAppScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
