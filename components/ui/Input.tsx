import React, { forwardRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TextInputProps,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { colors, radii, spacing, typography } from '../../theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: ViewStyle;
}

const Input = forwardRef<TextInput, Props>(function Input(
  { label, error, hint, leftIcon, rightElement, containerStyle, style, onFocus, onBlur, ...rest },
  ref
) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.ui.error
    : focused
    ? colors.border.strong
    : colors.border.default;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, { borderColor }]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={ref}
          style={[
            styles.input,
            leftIcon ? styles.inputWithLeft : null,
            { textAlignVertical: rest.multiline ? 'top' : 'center' },
            style,
          ]}
          placeholderTextColor={colors.text.tertiary}
          selectionColor={colors.brand.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
        />
        {rightElement && <View style={styles.rightElement}>{rightElement}</View>}
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
});

export default Input;

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  label: {
    ...typography.label,
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.input,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '400' as const,
    color: colors.text.primary,
    minHeight: 48,
  },
  inputWithLeft: {
    paddingLeft: spacing.sm,
  },
  leftIcon: {
    paddingLeft: spacing.md,
  },
  rightElement: {
    paddingRight: spacing.md,
  },
  error: {
    ...typography.caption,
    color: colors.ui.error,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
});
