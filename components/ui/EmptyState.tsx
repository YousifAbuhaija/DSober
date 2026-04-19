import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from './Button';
import { colors, spacing, typography } from '../../theme';

interface Props {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
  style?: ViewStyle;
}

export default function EmptyState({ icon, title, subtitle, action, style }: Props) {
  return (
    <View style={[styles.container, style]}>
      {icon && (
        <Ionicons name={icon} size={48} color={colors.text.tertiary} style={styles.icon} />
      )}
      <Text style={styles.title}>{title}</Text>
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && (
        <Button
          onPress={action.onPress}
          label={action.label}
          variant="secondary"
          size="sm"
          style={styles.action}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  icon: {
    marginBottom: spacing.base,
    opacity: 0.5,
  },
  title: {
    ...typography.title3,
    color: colors.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.callout,
    color: colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 22,
  },
  action: {
    marginTop: spacing.xl,
    alignSelf: 'center',
  },
});
