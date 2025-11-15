import { Alert } from 'react-native';

export function handleError(error: any, context: string) {
  console.error(`Error in ${context}:`, error);

  const errorMessage = error?.message || '';
  const errorCode = error?.code || '';

  // Network errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    Alert.alert(
      'Connection Issue',
      'Please check your internet connection and try again.'
    );
    return;
  }

  // Authentication errors
  if (errorMessage.includes('Invalid login credentials')) {
    Alert.alert(
      'Login Failed',
      'The email or password you entered is incorrect. Please try again.'
    );
    return;
  }

  if (errorMessage.includes('User already registered')) {
    Alert.alert(
      'Account Exists',
      'An account with this email already exists. Please log in instead.'
    );
    return;
  }

  if (errorMessage.includes('Email not confirmed')) {
    Alert.alert(
      'Email Not Confirmed',
      'Please check your email and confirm your account before logging in.'
    );
    return;
  }

  // Session errors
  if (
    errorMessage.includes('auth') ||
    errorMessage.includes('session') ||
    errorMessage.includes('JWT') ||
    errorMessage.includes('token')
  ) {
    Alert.alert(
      'Session Expired',
      'Your session has expired. Please log in again.'
    );
    return;
  }

  // Password validation
  if (errorMessage.includes('Password should be at least')) {
    Alert.alert(
      'Invalid Password',
      'Password must be at least 6 characters long.'
    );
    return;
  }

  // Email validation
  if (errorMessage.includes('Invalid email')) {
    Alert.alert(
      'Invalid Email',
      'Please enter a valid email address.'
    );
    return;
  }

  // Default error
  Alert.alert(
    'Error',
    errorMessage || 'Something went wrong. Please try again.'
  );
}
