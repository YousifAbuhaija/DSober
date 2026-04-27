import React from 'react';
import { TouchableOpacity, View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radii, spacing, shadow } from '../../theme';

interface Props {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  padding?: number;
  elevated?: boolean;
  noShadow?: boolean;
}

export default function Card({ children, onPress, style, padding = spacing.base, elevated = false, noShadow = false }: Props) {
  const bg = elevated ? colors.bg.elevated : colors.bg.surface;
  const containerStyle = [styles.card, noShadow && styles.noShadow, { backgroundColor: bg, padding }, style];

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={containerStyle}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.lg,
    ...(shadow.sm as object),
  },
  noShadow: {
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
});
