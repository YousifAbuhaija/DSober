/**
 * Common component styles for the DSober app
 * 
 * Provides reusable style generators for buttons, inputs, and containers.
 * All styles use theme colors and meet accessibility requirements.
 */

import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { theme } from './colors';

/**
 * Button style generators
 */
export const buttonStyles = {
  // Primary button (purple background, white text)
  primary: StyleSheet.create({
    container: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    } as ViewStyle,
    
    text: {
      color: theme.colors.text.onPrimary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    } as TextStyle,
    
    pressed: {
      backgroundColor: theme.colors.primary.dark,
    } as ViewStyle,
    
    disabled: {
      backgroundColor: theme.colors.state.disabled,
    } as ViewStyle,
    
    disabledText: {
      color: theme.colors.text.disabled,
    } as TextStyle,
  }),
  
  // Secondary button (lime green background, dark text)
  secondary: StyleSheet.create({
    container: {
      backgroundColor: theme.colors.secondary.main,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    } as ViewStyle,
    
    text: {
      color: theme.colors.text.onSecondary,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    } as TextStyle,
    
    pressed: {
      backgroundColor: theme.colors.secondary.dark,
    } as ViewStyle,
    
    disabled: {
      backgroundColor: theme.colors.state.disabled,
    } as ViewStyle,
    
    disabledText: {
      color: theme.colors.text.disabled,
    } as TextStyle,
  }),
  
  // Outline button (transparent with border)
  outline: StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: theme.colors.primary.light,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    } as ViewStyle,
    
    text: {
      color: theme.colors.primary.light,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    } as TextStyle,
    
    pressed: {
      backgroundColor: theme.colors.primary.dark,
      borderColor: theme.colors.primary.main,
    } as ViewStyle,
    
    disabled: {
      borderColor: theme.colors.state.disabled,
    } as ViewStyle,
    
    disabledText: {
      color: theme.colors.text.disabled,
    } as TextStyle,
  }),
  
  // Text button (no background)
  text: StyleSheet.create({
    container: {
      backgroundColor: 'transparent',
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 48,
    } as ViewStyle,
    
    text: {
      color: theme.colors.primary.light,
      fontSize: 16,
      fontWeight: '600',
      letterSpacing: 0.5,
    } as TextStyle,
    
    pressed: {
      opacity: 0.7,
    } as ViewStyle,
    
    disabled: {
      opacity: 0.5,
    } as ViewStyle,
    
    disabledText: {
      color: theme.colors.text.disabled,
    } as TextStyle,
  }),
};

/**
 * Input field styles
 */
export const inputStyles = StyleSheet.create({
  // Standard input container
  container: {
    backgroundColor: theme.colors.background.input,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: 8,
    padding: 12,
    minHeight: 48,
  } as ViewStyle,
  
  // Input text style
  input: {
    fontSize: 16,
    color: theme.colors.text.primary,
    flex: 1,
  } as TextStyle,
  
  // Focused state
  focused: {
    borderColor: theme.colors.border.focus,
    borderWidth: 2,
  } as ViewStyle,
  
  // Error state
  error: {
    borderColor: theme.colors.border.error,
    borderWidth: 2,
  } as ViewStyle,
  
  // Disabled state
  disabled: {
    backgroundColor: theme.colors.state.disabled,
    borderColor: theme.colors.state.disabled,
  } as ViewStyle,
  
  // Placeholder text color
  placeholder: {
    color: theme.colors.text.tertiary,
  } as TextStyle,
  
  // Label text
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  } as TextStyle,
  
  // Helper text
  helperText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginTop: 4,
  } as TextStyle,
  
  // Error text
  errorText: {
    fontSize: 14,
    color: theme.colors.functional.error,
    marginTop: 4,
  } as TextStyle,
});

/**
 * Screen container styles
 */
export const screenStyles = StyleSheet.create({
  // Main screen container
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  } as ViewStyle,
  
  // Screen with padding
  containerWithPadding: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    padding: 16,
  } as ViewStyle,
  
  // Scrollable content container
  scrollContent: {
    flexGrow: 1,
    padding: 16,
  } as ViewStyle,
  
  // Centered content
  centered: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  } as ViewStyle,
});

/**
 * Card and elevated surface styles
 */
export const cardStyles = StyleSheet.create({
  // Standard card
  card: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  } as ViewStyle,
  
  // Card with border
  cardWithBorder: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    padding: 16,
    marginBottom: 12,
  } as ViewStyle,
  
  // Card title
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 8,
  } as TextStyle,
  
  // Card content
  cardContent: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    lineHeight: 24,
  } as TextStyle,
});

/**
 * Modal and overlay styles
 */
export const modalStyles = StyleSheet.create({
  // Modal backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  
  // Modal container
  container: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  } as ViewStyle,
  
  // Modal title
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 16,
  } as TextStyle,
  
  // Modal content
  content: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    lineHeight: 24,
    marginBottom: 24,
  } as TextStyle,
  
  // Modal button container
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  } as ViewStyle,
});

/**
 * List item styles
 */
export const listStyles = StyleSheet.create({
  // List item container
  item: {
    backgroundColor: theme.colors.background.elevated,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  } as ViewStyle,
  
  // List item with rounded corners (for separated lists)
  itemRounded: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
  } as ViewStyle,
  
  // List item title
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  } as TextStyle,
  
  // List item subtitle
  itemSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  } as TextStyle,
  
  // List separator
  separator: {
    height: 1,
    backgroundColor: theme.colors.border.default,
  } as ViewStyle,
});

/**
 * Badge and status indicator styles
 */
export const badgeStyles = StyleSheet.create({
  // Success badge
  success: {
    backgroundColor: theme.colors.functional.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  } as ViewStyle,
  
  // Error badge
  error: {
    backgroundColor: theme.colors.functional.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  } as ViewStyle,
  
  // Warning badge
  warning: {
    backgroundColor: theme.colors.functional.warning,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  } as ViewStyle,
  
  // Info badge
  info: {
    backgroundColor: theme.colors.functional.info,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  } as ViewStyle,
  
  // Badge text
  text: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.onPrimary,
  } as TextStyle,
});
