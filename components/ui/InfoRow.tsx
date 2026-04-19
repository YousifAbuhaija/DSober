import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

interface Props {
  label: string;
  value?: string;
  valueColor?: string;
  onPress?: () => void;
  chevron?: boolean;
}

export default function InfoRow({ label, value, valueColor, onPress, chevron = false }: Props) {
  const content = (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.right}>
        {value !== undefined && (
          <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>
            {value}
          </Text>
        )}
        {(onPress || chevron) && (
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} style={styles.chevron} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    minHeight: 48,
  },
  label: {
    ...typography.body,
    color: colors.text.secondary,
    flex: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    ...typography.body,
    color: colors.text.primary,
    textAlign: 'right',
    flex: 1,
  },
  chevron: {
    marginLeft: spacing.xs,
  },
});
