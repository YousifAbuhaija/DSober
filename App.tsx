import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import RootNavigator from './navigation/RootNavigator';
import { View, Text, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { ErrorBoundary } from './ErrorBoundary';

export default function App() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function prepare() {
      try {
        console.log('[App] Starting initialization...');
        // Give providers time to initialize
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log('[App] Initialization complete');
        setIsReady(true);
      } catch (e) {
        console.error('[App] Error during app initialization:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    }

    prepare();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', marginBottom: 10 }}>Error loading app:</Text>
        <Text>{error}</Text>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#402B78' }}>
        <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#fff', marginBottom: 20 }}>DSober</Text>
        <ActivityIndicator size="large" color="#B7F79E" />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <NotificationProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </NotificationProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
