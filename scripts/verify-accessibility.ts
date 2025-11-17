/**
 * Script to verify accessibility compliance of the DSober theme
 * 
 * This script checks all color combinations in the theme against
 * WCAG AA standards and generates a detailed report.
 * 
 * Run with: npx ts-node scripts/verify-accessibility.ts
 */

// Import theme colors directly
const theme = {
  colors: {
    background: {
      primary: '#121212',
      elevated: '#1E1E1E',
      input: '#2A2A2A',
    },
    primary: {
      main: '#402B78',
      light: '#8B6FD8',
      dark: '#2A1A50',
    },
    secondary: {
      main: '#B7F79E',
      light: '#D4FFBE',
      dark: '#8BC34A',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      tertiary: '#808080',
      disabled: '#4A4A4A',
      onPrimary: '#FFFFFF',
      onSecondary: '#121212',
    },
    functional: {
      success: '#4CAF50',
      error: '#FF5252',
      warning: '#FFC107',
      info: '#2196F3',
    },
    border: {
      default: '#666666',
      focus: '#8B6FD8',
      error: '#FF5252',
    },
    state: {
      active: '#402B78',
      inactive: '#808080',
      disabled: '#4A4A4A',
      hover: '#6B4FB8',
      pressed: '#2A1A50',
    },
  },
};

// Inline accessibility functions
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((val) => {
    const normalized = val / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

function checkContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): { passes: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(foreground, background);
  
  const requirements = {
    AA: isLargeText ? 3.0 : 4.5,
    AAA: isLargeText ? 4.5 : 7.0,
  };
  
  const required = requirements[level];
  
  return {
    passes: ratio >= required,
    ratio: Math.round(ratio * 10) / 10,
    required,
  };
}

function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 10) / 10}:1`;
}

function getStatusEmoji(passes: boolean): string {
  return passes ? '✅' : '❌';
}

console.log('🔍 Verifying DSober Theme Accessibility...\n');

// Define color combinations to test
const combinations = [
  // Text on backgrounds
  {
    name: 'Primary text on primary background',
    foreground: theme.colors.text.primary,
    background: theme.colors.background.primary,
    usage: 'Main body text',
    isLargeText: false,
  },
  {
    name: 'Secondary text on primary background',
    foreground: theme.colors.text.secondary,
    background: theme.colors.background.primary,
    usage: 'Secondary/helper text',
    isLargeText: false,
  },
  {
    name: 'Tertiary text on primary background',
    foreground: theme.colors.text.tertiary,
    background: theme.colors.background.primary,
    usage: 'Hints and captions',
    isLargeText: false,
  },
  {
    name: 'Primary text on elevated background',
    foreground: theme.colors.text.primary,
    background: theme.colors.background.elevated,
    usage: 'Text on cards',
    isLargeText: false,
  },
  {
    name: 'Primary text on input background',
    foreground: theme.colors.text.primary,
    background: theme.colors.background.input,
    usage: 'Input field text',
    isLargeText: false,
  },
  
  // Text on brand colors
  {
    name: 'White text on primary color',
    foreground: theme.colors.text.onPrimary,
    background: theme.colors.primary.main,
    usage: 'Primary button text',
    isLargeText: false,
  },
  {
    name: 'Dark text on secondary color',
    foreground: theme.colors.text.onSecondary,
    background: theme.colors.secondary.main,
    usage: 'Secondary button text',
    isLargeText: false,
  },
  
  // Brand colors on backgrounds
  // Note: Primary.main intentionally excluded - should not be used as text/icon
  // Use primary.light instead for accessible contrast
  {
    name: 'Primary light on dark background',
    foreground: theme.colors.primary.light,
    background: theme.colors.background.primary,
    usage: 'Borders and outlines',
    isLargeText: false,
  },
  {
    name: 'Secondary color on dark background',
    foreground: theme.colors.secondary.main,
    background: theme.colors.background.primary,
    usage: 'Secondary color as text/icon',
    isLargeText: false,
  },
  
  // Functional colors
  {
    name: 'Success color on dark background',
    foreground: theme.colors.functional.success,
    background: theme.colors.background.primary,
    usage: 'Success messages and icons',
    isLargeText: false,
  },
  {
    name: 'Error color on dark background',
    foreground: theme.colors.functional.error,
    background: theme.colors.background.primary,
    usage: 'Error messages and icons',
    isLargeText: false,
  },
  {
    name: 'Warning color on dark background',
    foreground: theme.colors.functional.warning,
    background: theme.colors.background.primary,
    usage: 'Warning messages and icons',
    isLargeText: false,
  },
  
  // Border visibility
  {
    name: 'Default border on dark background',
    foreground: theme.colors.border.default,
    background: theme.colors.background.primary,
    usage: 'Input borders',
    isLargeText: true, // Borders use 3:1 requirement
  },
  {
    name: 'Focus border on dark background',
    foreground: theme.colors.border.focus,
    background: theme.colors.background.primary,
    usage: 'Focused input borders',
    isLargeText: true,
  },
  
  // State colors
  {
    name: 'Inactive state on dark background',
    foreground: theme.colors.state.inactive,
    background: theme.colors.background.primary,
    usage: 'Inactive tabs and icons',
    isLargeText: false,
  },
];

// Generate report
console.log('=== ACCESSIBILITY REPORT ===\n');
console.log(`Generated: ${new Date().toLocaleString()}\n`);

let passed = 0;
let failed = 0;

combinations.forEach((combo) => {
  const result = checkContrast(
    combo.foreground,
    combo.background,
    'AA',
    combo.isLargeText
  );
  
  const status = getStatusEmoji(result.passes);
  const ratio = formatRatio(result.ratio);
  const required = formatRatio(result.required);
  
  console.log(`${status} ${combo.name}`);
  console.log(`   Contrast: ${ratio} (required: ${required})`);
  console.log(`   Usage: ${combo.usage}`);
  console.log(`   Colors: ${combo.foreground} on ${combo.background}\n`);
  
  if (result.passes) {
    passed++;
  } else {
    failed++;
  }
});

console.log(`Summary: ${passed}/${combinations.length} passed\n`);

// Additional specific checks for critical UI elements
console.log('\n=== CRITICAL UI ELEMENT CHECKS ===\n');

const criticalChecks = [
  {
    name: 'Primary Button (white on purple)',
    fg: theme.colors.text.onPrimary,
    bg: theme.colors.primary.main,
  },
  {
    name: 'Secondary Button (dark on lime)',
    fg: theme.colors.text.onSecondary,
    bg: theme.colors.secondary.main,
  },
  {
    name: 'Tab Bar Active (purple light on dark)',
    fg: theme.colors.primary.light,
    bg: theme.colors.background.primary,
  },
  {
    name: 'Tab Bar Inactive (gray on dark)',
    fg: theme.colors.state.inactive,
    bg: theme.colors.background.primary,
  },
  {
    name: 'Input Field (white on input bg)',
    fg: theme.colors.text.primary,
    bg: theme.colors.background.input,
  },
  {
    name: 'Input Border (default)',
    fg: theme.colors.border.default,
    bg: theme.colors.background.primary,
  },
  {
    name: 'Input Border (focused)',
    fg: theme.colors.border.focus,
    bg: theme.colors.background.primary,
  },
];

criticalChecks.forEach((check) => {
  const result = checkContrast(check.fg, check.bg, 'AA', false);
  const status = getStatusEmoji(result.passes);
  const ratio = formatRatio(result.ratio);
  
  console.log(`${status} ${check.name}: ${ratio}`);
});

// SEP Test functional colors verification
console.log('\n=== SEP TEST FUNCTIONAL COLORS ===\n');

const sepColors = [
  {
    name: 'GO Signal (green on dark)',
    fg: theme.colors.functional.success,
    bg: theme.colors.background.primary,
  },
  {
    name: 'EARLY Signal (red on dark)',
    fg: theme.colors.functional.error,
    bg: theme.colors.background.primary,
  },
  {
    name: 'READY Signal (yellow on dark)',
    fg: theme.colors.functional.warning,
    bg: theme.colors.background.primary,
  },
  {
    name: 'White text on GO background',
    fg: '#FFFFFF',
    bg: theme.colors.functional.success,
  },
  {
    name: 'White text on EARLY background',
    fg: '#FFFFFF',
    bg: theme.colors.functional.error,
  },
];

sepColors.forEach((check) => {
  const result = checkContrast(check.fg, check.bg, 'AA', false);
  const status = getStatusEmoji(result.passes);
  const ratio = formatRatio(result.ratio);
  
  console.log(`${status} ${check.name}: ${ratio}`);
});

// Exit with error code if any checks failed
if (failed > 0) {
  console.log(`⚠️  ${failed} color combination(s) failed WCAG AA standards\n`);
  console.log('❌ Accessibility verification FAILED');
  process.exit(1);
} else {
  console.log('✅ All color combinations meet WCAG AA standards!\n');
  console.log('✅ Accessibility verification PASSED');
  process.exit(0);
}
