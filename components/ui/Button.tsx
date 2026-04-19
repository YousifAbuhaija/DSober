import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
} from 'react-native';
import { colors, radii, spacing } from '../../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'lime';
type Size = 'sm' | 'md' | 'lg';

interface Props {
  onPress: () => void;
  label: string;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: ViewStyle;
}

export default function Button({
  onPress,
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  style,
}: Props) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        styles.base,
        sizeStyles[size],
        variantStyles[variant].container,
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' ? colors.brand.primary : variantStyles[variant].textColor}
        />
      ) : (
        <View style={styles.inner}>
          {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
          <Text style={[styles.label, sizeTextStyles[size], { color: variantStyles[variant].textColor }]}>
            {label}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    marginRight: spacing.sm,
  },
  label: {
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

const sizeStyles: Record<Size, ViewStyle> = {
  sm: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, minHeight: 36, borderRadius: radii.sm },
  md: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  lg: { paddingHorizontal: spacing.xl, paddingVertical: spacing.base, minHeight: 54 },
};

const sizeTextStyles: Record<Size, TextStyle> = {
  sm: { fontSize: 14 },
  md: { fontSize: 16 },
  lg: { fontSize: 17 },
};

const variantStyles: Record<Variant, { container: ViewStyle; textColor: string }> = {
  primary: {
    container: { backgroundColor: colors.brand.primary },
    textColor: colors.text.onBrand,
  },
  secondary: {
    container: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: colors.border.default,
    },
    textColor: colors.text.primary,
  },
  ghost: {
    container: { backgroundColor: 'transparent' },
    textColor: colors.brand.primary,
  },
  danger: {
    container: { backgroundColor: colors.ui.error },
    textColor: '#FFFFFF',
  },
  success: {
    container: { backgroundColor: colors.ui.success },
    textColor: '#FFFFFF',
  },
  lime: {
    container: { backgroundColor: colors.brand.lime },
    textColor: colors.text.onLime,
  },
};
