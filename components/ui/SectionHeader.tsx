import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface Props {
  title: string;
  action?: { label: string; onPress: () => void };
  rightLabel?: string;
}

export default function SectionHeader({ title, action, rightLabel }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {rightLabel ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{rightLabel}</Text>
        </View>
      ) : action ? (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.text.tertiary,
  },
  action: {
    ...typography.caption,
    color: colors.brand.primary,
    fontWeight: '600',
  },
  badge: {
    backgroundColor: colors.brand.primary,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '700',
  },
});
