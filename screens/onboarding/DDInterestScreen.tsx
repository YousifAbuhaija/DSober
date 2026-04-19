import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import StepProgress from '../../components/ui/StepProgress';
import { colors, spacing, typography, radii, border } from '../../theme';

const TOTAL_STEPS = 8;

export default function DDInterestScreen({ navigation }: any) {
  const { session } = useAuth();
  const [isDD, setIsDD] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleNext = async () => {
    if (isDD === null) {
      setError('Please make a selection to continue');
      return;
    }
    setLoading(true);
    try {
      await supabase
        .from('users')
        .update({
          is_dd: isDD,
          dd_status: isDD ? 'active' : 'none',
          updated_at: new Date().toISOString(),
        })
        .eq('id', session!.user.id);

      navigation.navigate(isDD ? 'DriverInfo' : 'ProfilePhoto');
    } catch (err: any) {
      setError(err?.message || 'Failed to save. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <StepProgress current={2} total={TOTAL_STEPS} label="DD Interest" />

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Designated Driver</Text>
          <Text style={styles.subtitle}>
            Would you like to serve as a designated driver for your chapter's events?
          </Text>
        </View>

        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.brand.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Pass a sobriety check before every session</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={20} color={colors.brand.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Provide vehicle details and license photo</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="people-outline" size={20} color={colors.brand.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>Members can request rides from you at events</Text>
          </View>
        </Card>

        <View style={styles.optionsBlock}>
          {[
            { value: true,  label: 'Yes, I want to be a DD',   sub: 'Help keep your chapter safe' },
            { value: false, label: 'Not right now',              sub: 'You can change this later in Profile' },
          ].map(({ value, label, sub }) => (
            <TouchableOpacity
              key={String(value)}
              style={[styles.option, isDD === value && styles.optionActive]}
              onPress={() => { setIsDD(value); setError(''); }}
              activeOpacity={0.8}
            >
              <View style={styles.optionInner}>
                <View>
                  <Text style={[styles.optionLabel, isDD === value && styles.optionLabelActive]}>
                    {label}
                  </Text>
                  <Text style={styles.optionSub}>{sub}</Text>
                </View>
                <View style={[styles.radio, isDD === value && styles.radioActive]}>
                  {isDD === value && (
                    <View style={styles.radioDot} />
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          onPress={handleNext}
          label="Continue"
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
  },
  headingBlock: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.title1,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.secondary,
    lineHeight: 22,
  },
  infoCard: {
    marginBottom: spacing.xl,
    gap: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIcon: {
    marginRight: spacing.md,
  },
  infoText: {
    ...typography.callout,
    color: colors.text.secondary,
    flex: 1,
  },
  optionsBlock: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  option: {
    borderWidth: 1.5,
    borderColor: colors.border.default,
    borderRadius: radii.lg,
    padding: spacing.base,
    backgroundColor: colors.bg.surface,
  },
  optionActive: {
    borderColor: colors.brand.primary,
    backgroundColor: colors.brand.faint,
  },
  optionInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLabel: {
    ...typography.bodyBold,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: colors.text.primary,
  },
  optionSub: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border.default,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioActive: {
    borderColor: colors.brand.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.brand.primary,
  },
  errorText: {
    ...typography.caption,
    color: colors.ui.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  cta: {
    marginTop: 'auto' as any,
  },
});
