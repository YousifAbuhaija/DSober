import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import RootNavigator from './navigation/RootNavigator';

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <RootNavigator />
        <StatusBar style="auto" />
      </NotificationProvider>
    </AuthProvider>
  );
}
