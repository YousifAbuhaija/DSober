import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Try to get from Constants.expoConfig.extra first (production builds)
// Fall back to process.env for development
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';

const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL:', supabaseUrl ? 'present' : 'missing');
  console.error('Supabase Key:', supabaseAnonKey ? 'present' : 'missing');
  throw new Error('Missing Supabase environment variables. Please check your .env file or app.json extra config.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    // PKCE so email links (password reset, signup confirmation) can be
    // exchanged for a session via the dsober:// deep link
    flowType: 'pkce',
  },
});

// Refresh auth tokens only while the app is foregrounded (Supabase RN guidance)
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
