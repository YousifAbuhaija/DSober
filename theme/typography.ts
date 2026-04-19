import { Platform, TextStyle } from 'react-native';

const base: TextStyle = {};

export const typography = {
  display: { ...base, fontSize: 34, fontWeight: '700' as const, letterSpacing: -0.5 },
  title1:  { ...base, fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  title2:  { ...base, fontSize: 22, fontWeight: '600' as const, letterSpacing: -0.2 },
  title3:  { ...base, fontSize: 18, fontWeight: '600' as const },
  body:    { ...base, fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyBold:{ ...base, fontSize: 16, fontWeight: '600' as const, lineHeight: 24 },
  callout: { ...base, fontSize: 15, fontWeight: '400' as const, lineHeight: 22 },
  caption: { ...base, fontSize: 13, fontWeight: '400' as const },
  label:   { ...base, fontSize: 12, fontWeight: '600' as const, letterSpacing: 0.5 },
  mono:    {
    fontSize: 14,
    fontWeight: '400' as const,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
} as const;

export type TypographyKey = keyof typeof typography;

// Legacy shim for existing code using old typography keys
export const createTextStyle = (key: string, color?: string): TextStyle => {
  return color ? { color } : {};
};
export const textColors = {};
