import { Alert } from 'react-native';

export function handleError(error: any, context: string) {
  console.error(`Error in ${context}:`, error);

  const errorMessage = error?.message || '';

  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    Alert.alert(
      'Connection Issue',
      'Please check your internet connection and try again.'
    );
  } else if (
    errorMessage.includes('auth') ||
    errorMessage.includes('session') ||
    errorMessage.includes('JWT')
  ) {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.'
    );
  } else if (errorMessage.includes('Invalid login credentials')) {
    Alert.alert(
      'Authentication Failed',
      'Invalid email or password. Please try again.'
    );
  } else {
    Alert.alert(
      'Error',
      errorMessage || 'Something went wrong. Please try again.'
    );
  }
}
