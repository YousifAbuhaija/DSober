import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { handleError } from '../utils/errorHandler';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { colors, spacing, typography, radii } from '../theme';

type Mode = 'login' | 'signup';

export default function AuthScreen() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const passwordRef = useRef<TextInput>(null);
  const { signIn, signUp } = useAuth();

  const validate = () => {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(email)) next.email = 'Enter a valid email';
    if (!password) next.password = 'Password is required';
    else if (mode === 'signup' && password.length < 6)
      next.password = 'Password must be at least 6 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        const { needsEmailConfirmation } = await signUp(email.trim(), password);
        if (needsEmailConfirmation) setConfirmationSent(true);
      }
    } catch (error: any) {
      handleError(error, mode === 'login' ? 'Login' : 'Signup');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode((m) => (m === 'login' ? 'signup' : 'login'));
    setEmail('');
    setPassword('');
    setErrors({});
    setConfirmationSent(false);
  };

  if (confirmationSent) {
    return (
      <ScreenWrapper keyboard>
        <View style={styles.confirmContainer}>
          <View style={styles.confirmIcon}>
            <Ionicons name="mail-outline" size={40} color={colors.brand.primary} />
          </View>
          <Text style={styles.confirmTitle}>Check your inbox</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.confirmEmail}>{email}</Text>
          </Text>
          <Text style={styles.confirmHint}>
            Click the link to activate your account, then come back and log in.
          </Text>
          <TouchableOpacity style={styles.backLink} onPress={switchMode}>
            <Ionicons name="arrow-back" size={16} color={colors.brand.primary} />
            <Text style={styles.backLinkText}>Back to log in</Text>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper keyboard scroll>
      <View style={styles.container}>
        {/* Wordmark */}
        <View style={styles.header}>
          <Text style={styles.wordmark}>DSober</Text>
          <Text style={styles.tagline}>Safe rides, every night.</Text>
        </View>

        {/* Mode toggle pill */}
        <View style={styles.modePill}>
          <TouchableOpacity
            style={[styles.modeOption, mode === 'login' && styles.modeOptionActive]}
            onPress={() => mode !== 'login' && switchMode()}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeText, mode === 'login' && styles.modeTextActive]}>
              Log In
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeOption, mode === 'signup' && styles.modeOptionActive]}
            onPress={() => mode !== 'signup' && switchMode()}
            activeOpacity={0.8}
          >
            <Text style={[styles.modeText, mode === 'signup' && styles.modeTextActive]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Input
            label="Email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
            }}
            error={errors.email}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            editable={!loading}
            autoComplete="email"
          />

          <Input
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={(v) => {
              setPassword(v);
              if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
            }}
            error={errors.password}
            secureTextEntry={!showPassword}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
            editable={!loading}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            rightElement={
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)} activeOpacity={0.7}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.text.tertiary}
                />
              </TouchableOpacity>
            }
          />

          <Button
            onPress={handleSubmit}
            label={mode === 'login' ? 'Log In' : 'Create Account'}
            loading={loading}
            disabled={loading}
            fullWidth
            size="lg"
            style={styles.cta}
          />
        </View>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Switch mode link */}
        <TouchableOpacity style={styles.switchRow} onPress={switchMode} disabled={loading}>
          <Text style={styles.switchText}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
          </Text>
          <Text style={styles.switchAction}>
            {mode === 'login' ? ' Sign up' : ' Log in'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing['3xl'],
  },
  wordmark: {
    ...typography.display,
    color: colors.text.primary,
    letterSpacing: -1,
  },
  tagline: {
    ...typography.callout,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  modePill: {
    flexDirection: 'row',
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    padding: 4,
    marginBottom: spacing['2xl'],
  },
  modeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
  },
  modeOptionActive: {
    backgroundColor: colors.bg.elevated,
  },
  modeText: {
    ...typography.bodyBold,
    color: colors.text.tertiary,
  },
  modeTextActive: {
    color: colors.text.primary,
  },
  form: {
    gap: spacing.xs,
  },
  cta: {
    marginTop: spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.subtle,
  },
  dividerText: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  switchText: {
    ...typography.callout,
    color: colors.text.secondary,
  },
  switchAction: {
    ...typography.callout,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  // Confirmation screen
  confirmContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.faint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  confirmTitle: {
    ...typography.title2,
    color: colors.text.primary,
    textAlign: 'center',
  },
  confirmBody: {
    ...typography.body,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  confirmEmail: {
    color: colors.text.primary,
    fontWeight: '600',
  },
  confirmHint: {
    ...typography.callout,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  backLinkText: {
    ...typography.callout,
    color: colors.brand.primary,
    fontWeight: '600',
  },
});
