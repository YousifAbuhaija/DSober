import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface Props {
  title: string;
  action?: { label: string; onPress: () => void };
}

export default function SectionHeader({ title, action }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={styles.action}>{action.label}</Text>
        </TouchableOpacity>
      )}
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
});
