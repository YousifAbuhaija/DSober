import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

type KnownStatus =
  | 'upcoming' | 'active' | 'completed'
  | 'pending' | 'accepted' | 'picked_up'
  | 'pass' | 'fail'
  | 'revoked' | 'approved' | 'rejected'
  | 'none';

interface Props {
  status?: KnownStatus;
  label?: string;
  color?: string;
  style?: ViewStyle;
}

const STATUS_MAP: Record<KnownStatus, { bg: string; fg: string; text: string }> = {
  upcoming:  { bg: colors.brand.faint,    fg: '#9B82FF',          text: 'Upcoming' },
  active:    { bg: '#0D2E1A',             fg: colors.ui.success,  text: 'Active' },
  completed: { bg: colors.bg.muted,       fg: colors.text.tertiary, text: 'Completed' },
  pending:   { bg: '#2B2110',             fg: colors.ui.warning,  text: 'Pending' },
  accepted:  { bg: '#0D2E1A',             fg: colors.ui.success,  text: 'Accepted' },
  picked_up: { bg: '#0D2E1A',             fg: colors.ui.success,  text: 'Picked Up' },
  pass:      { bg: '#0D2E1A',             fg: colors.ui.success,  text: 'Pass' },
  fail:      { bg: '#2E0D0D',             fg: colors.ui.error,    text: 'Fail' },
  revoked:   { bg: '#2E0D0D',             fg: colors.ui.error,    text: 'Revoked' },
  approved:  { bg: '#0D2E1A',             fg: colors.ui.success,  text: 'Approved' },
  rejected:  { bg: '#2E0D0D',             fg: colors.ui.error,    text: 'Rejected' },
  none:      { bg: colors.bg.muted,       fg: colors.text.tertiary, text: 'None' },
};

export default function StatusPill({ status, label, color, style }: Props) {
  const map = status ? STATUS_MAP[status] : null;
  const bg = map?.bg ?? colors.bg.muted;
  const fg = color ?? map?.fg ?? colors.text.secondary;
  const displayLabel = label ?? map?.text ?? status ?? '';

  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      <Text style={[styles.text, { color: fg }]}>{displayLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
