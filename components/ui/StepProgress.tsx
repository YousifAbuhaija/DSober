import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '../../theme';

interface Props {
  current: number;
  total: number;
  label?: string;
}

export default function StepProgress({ current, total, label }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < current
                ? styles.dotComplete
                : i === current
                ? styles.dotActive
                : styles.dotInactive,
            ]}
          />
        ))}
      </View>
      {label ? (
        <Text style={styles.label}>{label}</Text>
      ) : (
        <Text style={styles.label}>
          Step {current + 1} of {total}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.base,
    gap: spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    height: 4,
    width: 24,
    borderRadius: 2,
  },
  dotComplete: {
    backgroundColor: colors.brand.primary,
  },
  dotActive: {
    backgroundColor: colors.brand.primary,
    opacity: 1,
  },
  dotInactive: {
    backgroundColor: colors.border.subtle,
  },
  label: {
    ...typography.caption,
    color: colors.text.tertiary,
  },
});
