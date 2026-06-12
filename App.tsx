import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import RootNavigator from './navigation/RootNavigator';
import { ErrorBoundary } from './ErrorBoundary';
import { initSentry, wrapApp } from './lib/sentry';

initSentry();

// Hold the native splash screen until RootNavigator knows the final destination,
// then fade it out — so the app never flashes intermediate auth/onboarding screens.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

function App() {
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

export default wrapApp(App);
