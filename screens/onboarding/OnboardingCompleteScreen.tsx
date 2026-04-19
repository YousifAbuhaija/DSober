import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Button from '../../components/ui/Button';
import { colors, spacing, typography, radii } from '../../theme';

const BULLETS = [
  { icon: 'calendar-outline' as const, text: 'Browse upcoming events in your chapter' },
  { icon: 'car-outline' as const,      text: 'Find active DDs when you need a safe ride' },
  { icon: 'shield-checkmark-outline' as const, text: 'Complete SEP verification before driving' },
  { icon: 'navigate-outline' as const, text: 'Track your ride status in real time' },
];

export default function OnboardingCompleteScreen() {
  const { refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await refreshUser();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <View style={styles.top}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark" size={48} color="#fff" />
          </View>
          <Text style={styles.title}>You're all set!</Text>
          <Text style={styles.subtitle}>
            Your baseline has been recorded and your account is ready.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>What you can do now</Text>
          {BULLETS.map(({ icon, text }) => (
            <View key={text} style={styles.bullet}>
              <Ionicons name={icon} size={18} color={colors.brand.primary} />
              <Text style={styles.bulletText}>{text}</Text>
            </View>
          ))}
        </View>

        <Button
          onPress={handleStart}
          label="Get Started"
          loading={loading}
          fullWidth
          size="lg"
          style={styles.cta}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing['2xl'],
    justifyContent: 'center',
  },
  top: {
    alignItems: 'center',
    marginBottom: spacing['2xl'],
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.ui.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
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
  card: {
    backgroundColor: colors.bg.surface,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing['2xl'],
    gap: spacing.md,
  },
  cardTitle: {
    ...typography.bodyBold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  bulletText: {
    ...typography.callout,
    color: colors.text.secondary,
    flex: 1,
  },
  cta: {},
});
