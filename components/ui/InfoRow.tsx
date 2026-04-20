import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';

interface Props {
  label: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  chevron?: boolean;
}

export default function InfoRow({ label, subtitle, value, valueColor, icon, onPress, chevron = false }: Props) {
  const content = (
    <View style={styles.row}>
      {icon && (
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={colors.text.secondary} />
        </View>
      )}
      <View style={styles.labelWrap}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.right}>
        {value !== undefined && value !== '' && (
          <Text style={[styles.value, valueColor ? { color: valueColor } : null]} numberOfLines={1}>
            {value}
          </Text>
        )}
        {(onPress || chevron) && (
          <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
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
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  labelWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    marginTop: 1,
    lineHeight: 18,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  value: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text.secondary,
    textAlign: 'right',
  },
});
