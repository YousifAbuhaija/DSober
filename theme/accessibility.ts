/**
 * Accessibility utilities for verifying WCAG compliance
 * 
 * This module provides tools to verify color contrast ratios and
 * ensure the app meets WCAG AA accessibility standards.
 */

/**
 * Convert hex color to RGB values
 */
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

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.0: https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
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

/**
 * Calculate contrast ratio between two colors
 * Formula from WCAG 2.0: https://www.w3.org/TR/WCAG20/#contrast-ratiodef
 * 
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @returns Contrast ratio (e.g., 4.5 for 4.5:1)
 */
export function getContrastRatio(foreground: string, background: string): number {
  const lum1 = getLuminance(foreground);
  const lum2 = getLuminance(background);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a color combination meets WCAG AA standards
 * 
 * @param foreground - Foreground color (hex)
 * @param background - Background color (hex)
 * @param level - 'AA' or 'AAA'
 * @param isLargeText - Whether the text is large (18pt+ or 14pt+ bold)
 * @returns Object with pass/fail status and contrast ratio
 */
export function checkContrast(
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  isLargeText: boolean = false
): { passes: boolean; ratio: number; required: number } {
  const ratio = getContrastRatio(foreground, background);
  
  // WCAG requirements
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

/**
 * Format contrast ratio for display
 */
export function formatRatio(ratio: number): string {
  return `${Math.round(ratio * 10) / 10}:1`;
}

/**
 * Get accessibility status emoji
 */
export function getStatusEmoji(passes: boolean): string {
  return passes ? '✅' : '❌';
}

/**
 * Verify all theme color combinations
 * Returns a report of all color combinations and their accessibility status
 */
export function verifyThemeAccessibility(theme: any): AccessibilityReport {
  const report: AccessibilityReport = {
    timestamp: new Date().toISOString(),
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
    },
    combinations: [],
  };

  const combinations: ColorCombination[] = [
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
    {
      name: 'Primary color on dark background',
      foreground: theme.colors.primary.main,
      background: theme.colors.background.primary,
      usage: 'Primary color as text/icon (NOT RECOMMENDED)',
      isLargeText: false,
    },
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

  combinations.forEach((combo) => {
    const result = checkContrast(
      combo.foreground,
      combo.background,
      'AA',
      combo.isLargeText
    );
    
    report.combinations.push({
      ...combo,
      ...result,
    });
    
    report.summary.total++;
    if (result.passes) {
      report.summary.passed++;
    } else {
      report.summary.failed++;
    }
  });

  return report;
}

/**
 * Print accessibility report to console
 */
export function printAccessibilityReport(report: AccessibilityReport): void {
  console.log('\n=== ACCESSIBILITY REPORT ===\n');
  console.log(`Generated: ${new Date(report.timestamp).toLocaleString()}\n`);
  console.log(`Summary: ${report.summary.passed}/${report.summary.total} passed\n`);
  
  report.combinations.forEach((combo) => {
    const status = getStatusEmoji(combo.passes);
    const ratio = formatRatio(combo.ratio);
    const required = formatRatio(combo.required);
    
    console.log(`${status} ${combo.name}`);
    console.log(`   Contrast: ${ratio} (required: ${required})`);
    console.log(`   Usage: ${combo.usage}`);
    console.log(`   Colors: ${combo.foreground} on ${combo.background}\n`);
  });
  
  if (report.summary.failed > 0) {
    console.log(`⚠️  ${report.summary.failed} color combination(s) failed WCAG AA standards`);
  } else {
    console.log('✅ All color combinations meet WCAG AA standards!');
  }
}

// Type definitions
export interface ColorCombination {
  name: string;
  foreground: string;
  background: string;
  usage: string;
  isLargeText: boolean;
}

export interface AccessibilityResult extends ColorCombination {
  passes: boolean;
  ratio: number;
  required: number;
}

export interface AccessibilityReport {
  timestamp: string;
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  combinations: AccessibilityResult[];
}
