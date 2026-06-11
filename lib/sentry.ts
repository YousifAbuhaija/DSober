import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

// DSN comes from app.json `extra.sentryDsn` (production builds) or
// EXPO_PUBLIC_SENTRY_DSN (development). When neither is set, Sentry stays
// disabled and every helper below is a safe no-op — the app runs unchanged.
const dsn =
  Constants.expoConfig?.extra?.sentryDsn ||
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  '';

export const sentryEnabled = !!dsn;

export function initSentry() {
  if (!sentryEnabled) return;
  Sentry.init({
    dsn,
    // Send a modest trace sample; raise once we know the volume
    tracesSampleRate: 0.2,
    // PII (emails, locations) flows through this app — don't attach it to events
    sendDefaultPii: false,
    environment: __DEV__ ? 'development' : 'production',
  });
}

export function captureError(error: unknown, context?: Record<string, any>) {
  if (!sentryEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

// Re-export wrap so the root component is instrumented only when enabled
export const wrapApp = sentryEnabled ? Sentry.wrap : <T,>(c: T): T => c;
