import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import ScreenWrapper from '../../components/ui/ScreenWrapper';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import StepProgress from '../../components/ui/StepProgress';
import { colors, spacing, typography, radii } from '../../theme';

const TOTAL_STEPS = 8;

export default function GroupJoinScreen({ navigation }: any) {
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!accessCode.trim()) {
      setError('Enter your chapter access code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // SECURITY DEFINER RPC: validates the code and sets group_id server-side
      // without exposing other groups or their access codes
      const { error: joinErr } = await supabase.rpc('join_group_with_code', {
        p_code: accessCode.trim(),
      });

      if (joinErr) {
        setError(
          joinErr.message?.includes('Invalid access code')
            ? 'Code not found — check with your chapter admin'
            : joinErr.message || 'Failed to join. Try again.'
        );
        setLoading(false);
        return;
      }

      navigation.navigate('DDInterest');
    } catch (err: any) {
      setError(err?.message || 'Failed to join. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper keyboard>
      <View style={styles.container}>
        <StepProgress current={1} total={TOTAL_STEPS} label="Join Chapter" />

        <View style={styles.iconRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="people-outline" size={32} color={colors.brand.primary} />
          </View>
        </View>

        <View style={styles.headingBlock}>
          <Text style={styles.title}>Join Your Chapter</Text>
          <Text style={styles.subtitle}>
            Enter the access code provided by your chapter admin to link your account.
          </Text>
        </View>

        <Input
          label="Access Code"
          value={accessCode}
          onChangeText={(v) => { setAccessCode(v); setError(''); }}
          error={error}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={20}
          returnKeyType="go"
          onSubmitEditing={handleJoin}
          hint="Codes are not case-sensitive"
        />

        <Button
          onPress={handleJoin}
          label="Join Chapter"
          loading={loading}
          fullWidth
          size="lg"
          style={styles.cta}
        />

        <Text style={styles.helpText}>
          Don't have a code? Contact your chapter administrator.
        </Text>
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
  cta: {
    marginTop: spacing.sm,
  },
  helpText: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
