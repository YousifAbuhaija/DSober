import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { NavigationContainer, DarkTheme, Theme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme';
import AuthScreen from '../screens/AuthScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import MainAppScreen from '../screens/MainAppScreen';
import SetNewPasswordScreen from '../screens/SetNewPasswordScreen';

const Stack = createStackNavigator();

// Dark navigation theme so scene/card backgrounds match the app (#080808) —
// without this, React Navigation paints scenes white and every transition
// flashes white against the dark UI.
const navTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg.canvas,
    card: colors.bg.canvas,
    primary: colors.brand.primary,
    text: colors.text.primary,
    border: colors.border.subtle,
    notification: colors.brand.primary,
  },
};

export default function RootNavigator() {
  const { session, user, loading, passwordRecovery } = useAuth();
  const [hasSEPBaseline, setHasSEPBaseline] = useState(false);
  // Tracks which user id we've finished the baseline check for. Used so we never
  // route on stale data (the gap between "auth resolved" and "baseline known").
  const [baselineCheckedFor, setBaselineCheckedFor] = useState<string | null>(null);
  const [recheckTrigger, setRecheckTrigger] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setHasSEPBaseline(false);
      setBaselineCheckedFor(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('sep_baselines')
          .select('id')
          .eq('user_id', user.id)
          .single();
        if (!cancelled) setHasSEPBaseline(!!data && !error);
      } catch {
        if (!cancelled) setHasSEPBaseline(false);
      } finally {
        if (!cancelled) setBaselineCheckedFor(user.id);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, recheckTrigger]);

  // During onboarding the user id stays the same while fields fill in; re-check
  // the baseline so the app advances to the main experience once SEP is done.
  useEffect(() => {
    if (user?.name && user?.groupId && !hasSEPBaseline) {
      setRecheckTrigger((p) => p + 1);
    }
  }, [user?.name, user?.groupId, hasSEPBaseline]);

  const isProfileComplete = useMemo(() => {
    if (!user) return false;
    const hasBasicInfo = user.name && user.groupId;
    const hasCompletedDDFlow = !user.isDD || (user.carMake && user.carModel && user.carPlate);
    return Boolean(hasBasicInfo && hasCompletedDDFlow && hasSEPBaseline);
  }, [user?.name, user?.groupId, user?.isDD, user?.carMake, user?.carModel, user?.carPlate, hasSEPBaseline]);

  // Ready = auth resolved AND (no user, or this user's baseline has been checked).
  const baselineResolved = !user || baselineCheckedFor === user.id;
  const appReady = !loading && baselineResolved;

  // Once ready, never fall back to the native splash; a later transition (e.g. a
  // fresh login) shows the in-app loader instead of a wrong screen.
  const hasBeenReadyRef = useRef(false);
  if (appReady) hasBeenReadyRef.current = true;

  const onNavReady = useCallback(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Initial load: keep the native splash visible (render nothing).
  if (!hasBeenReadyRef.current) {
    return null;
  }

  // Later transitions while data resolves — branded loader, not a flashed screen.
  if (!appReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.brand.primary }]}>
        <Text style={styles.wordmark}>DSober</Text>
        <ActivityIndicator size="large" color={colors.bg.elevated} />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme} onReady={onNavReady}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!session ? (
          <Stack.Screen name="Auth" component={AuthScreen} />
        ) : passwordRecovery ? (
          <Stack.Screen name="SetNewPassword" component={SetNewPasswordScreen} />
        ) : isProfileComplete ? (
          <Stack.Screen name="MainApp" component={MainAppScreen} />
        ) : (
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
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
  },
  wordmark: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
});
