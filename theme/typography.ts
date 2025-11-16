/**
 * Typography styles for the DSober app
 * 
 * Provides consistent text style presets with appropriate colors from the theme.
 * All text styles use colors that meet WCAG AA contrast requirements.
 */

import { StyleSheet, TextStyle } from 'react-native';
import { theme } from './colors';

/**
 * Typography style presets
 * 
 * Usage:
 * <Text style={typography.h1}>Heading</Text>
 * <Text style={typography.body}>Body text</Text>
 */
export const typography = StyleSheet.create({
  // Heading 1 - Large titles
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  } as TextStyle,
  
  // Heading 2 - Section titles
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  } as TextStyle,
  
  // Heading 3 - Subsection titles
  h3: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text.primary,
    letterSpacing: 0.25,
  } as TextStyle,
  
  // Body text - Primary content
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.colors.text.primary,
    lineHeight: 24,
  } as TextStyle,
  
  // Body secondary - Less emphasized content
  bodySecondary: {
    fontSize: 16,
    fontWeight: '400',
    color: theme.colors.text.secondary,
    lineHeight: 24,
  } as TextStyle,
  
  // Caption - Small descriptive text
  caption: {
    fontSize: 14,
    fontWeight: '400',
    color: theme.colors.text.tertiary,
    lineHeight: 20,
  } as TextStyle,
  
  // Label - Form labels and emphasized small text
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    letterSpacing: 0.15,
  } as TextStyle,
  
  // Button text - Text for buttons
  button: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  } as TextStyle,
  
  // Small text - Very small text (legal, footnotes)
  small: {
    fontSize: 12,
    fontWeight: '400',
    color: theme.colors.text.tertiary,
    lineHeight: 16,
  } as TextStyle,
});

/**
 * Helper function to create custom text styles with theme colors
 * @param baseStyle - Base typography style
 * @param color - Override color from theme
 * @returns Combined text style
 */
export const createTextStyle = (
  baseStyle: keyof typeof typography,
  color?: string
): TextStyle => {
  const base = typography[baseStyle];
  return color ? { ...base, color } : base;
};

/**
 * Text color utilities for specific use cases
 */
export const textColors = {
  // Text on primary color background
  onPrimary: {
    color: theme.colors.text.onPrimary,
  } as TextStyle,
  
  // Text on secondary color background
  onSecondary: {
    color: theme.colors.text.onSecondary,
  } as TextStyle,
  
  // Disabled text
  disabled: {
    color: theme.colors.text.disabled,
  } as TextStyle,
  
  // Error text
  error: {
    color: theme.colors.functional.error,
  } as TextStyle,
  
  // Success text
  success: {
    color: theme.colors.functional.success,
  } as TextStyle,
  
  // Warning text
  warning: {
    color: theme.colors.functional.warning,
  } as TextStyle,
  
  // Info text
  info: {
    color: theme.colors.functional.info,
  } as TextStyle,
};
