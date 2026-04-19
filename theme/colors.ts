export const colors = {
  bg: {
    canvas:  '#080808',
    surface: '#111111',
    elevated:'#1A1A1A',
    input:   '#1E1E1E',
    muted:   '#262626',
  },
  brand: {
    primary: '#6B4FDB',
    pressed:  '#5538C8',
    faint:    '#2A1E6E',
    lime:     '#B7F79E',
    limePressed: '#9AE080',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#9A9A9A',
    tertiary:  '#5A5A5A',
    inverse:   '#080808',
    onBrand:   '#FFFFFF',
    onLime:    '#0A1A08',
  },
  ui: {
    success: '#22C55E',
    error:   '#EF4444',
    warning: '#F59E0B',
    info:    '#3B82F6',
  },
  border: {
    subtle:  '#2A2A2A',
    default: '#3A3A3A',
    strong:  '#555555',
  },
} as const;

export type Colors = typeof colors;

// Legacy compat shim — screens still importing `theme.colors.*`
export const theme = {
  colors: {
    background: {
      primary:  colors.bg.canvas,
      elevated: colors.bg.elevated,
      input:    colors.bg.input,
    },
    primary: {
      main:  colors.brand.primary,
      light: '#9B82FF',
      dark:  colors.brand.pressed,
    },
    secondary: {
      main:  colors.brand.lime,
      light: '#D4FFBE',
      dark:  colors.brand.limePressed,
    },
    text: {
      primary:     colors.text.primary,
      secondary:   colors.text.secondary,
      tertiary:    colors.text.tertiary,
      disabled:    colors.text.tertiary,
      onPrimary:   colors.text.onBrand,
      onSecondary: colors.text.onLime,
    },
    functional: {
      success: colors.ui.success,
      error:   colors.ui.error,
      warning: colors.ui.warning,
      info:    colors.ui.info,
    },
    border: {
      default: colors.border.default,
      focus:   colors.border.strong,
      error:   colors.ui.error,
    },
    state: {
      active:   colors.brand.primary,
      inactive: colors.text.tertiary,
      disabled: '#333333',
      hover:    '#7D62E8',
      pressed:  colors.brand.pressed,
    },
  },
};

export const { bg, brand, text, ui, border } = colors;
