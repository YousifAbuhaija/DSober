import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import ScreenWrapper from '../components/ui/ScreenWrapper';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { colors, spacing, typography } from '../theme';

export default function SetNewPasswordScreen() {
  const { completePasswordReset, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await completePasswordReset(password);
      Alert.alert('Password Updated', 'You are now signed in with your new password.');
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenWrapper keyboard>
      <View style={styles.container}>
        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="key-outline" size={32} color={colors.brand.primary} />
          </View>
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Set a New Password</Text>
          <Text style={styles.subtitle}>
            Choose a new password for your account.
          </Text>
        </View>

        <Input
          label="New Password"
          value={password}
          onChangeText={(v) => { setPassword(v); setError(''); }}
          secureTextEntry
          autoComplete="new-password"
        />
        <Input
          label="Confirm Password"
          value={confirm}
          onChangeText={(v) => { setConfirm(v); setError(''); }}
          secureTextEntry
          autoComplete="new-password"
          error={error}
          containerStyle={styles.inputGap}
        />

        <Button
          onPress={handleSave}
          label="Save Password"
          loading={saving}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        <TouchableOpacity style={styles.cancelRow} onPress={signOut} disabled={saving}>
          <Text style={styles.cancelText}>Cancel and sign out</Text>
        </TouchableOpacity>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    justifyContent: 'center',
    paddingBottom: spacing['2xl'],
  },
  iconRow: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingBlock: {
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  title: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  inputGap: { marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
  cancelRow: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  cancelText: {
    ...typography.callout,
    color: colors.text.tertiary,
    fontWeight: '600',
  },
});
