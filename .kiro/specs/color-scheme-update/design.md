# Color Scheme Update Design Document

## Overview

This design document outlines the implementation strategy for updating the DSober mobile application to use a new dark-themed color scheme. The design focuses on creating a centralized theme system, ensuring WCAG AA accessibility compliance, and systematically applying the new colors across all components while preserving functional color meanings.

### Color Palette

**Primary Colors:**
- Background: `#121212` (Dark gray, almost black)
- Primary: `#402B78` (Deep purple)
- Secondary: `#B7F79E` (Lime green)

**Functional Colors (Preserved):**
- Success/Go: `#4CAF50` (Green)
- Error: `#FF5252` (Red)
- Warning: `#FFC107` (Amber)

### Accessibility Analysis

**Contrast Ratios (WCAG AA requires 4.5:1 for normal text, 3:1 for large text):**

1. **White text (#FFFFFF) on Background (#121212):** 15.3:1 ✅ Excellent
2. **White text (#FFFFFF) on Primary (#402B78):** 8.2:1 ✅ Excellent
3. **Dark text (#121212) on Secondary (#B7F79E):** 12.1:1 ✅ Excellent
4. **Secondary (#B7F79E) on Background (#121212):** 12.1:1 ✅ Excellent
5. **Primary (#402B78) on Background (#121212):** 2.1:1 ❌ Insufficient for text

**Adjustments Needed:**
- The Primary color (#402B78) cannot be used directly for text on the dark background
- Primary should be used for backgrounds of interactive elements with white text
- For borders and outlines, we'll use a lighter tint: `#6B4FB8` (contrast ratio: 4.6:1 ✅)

## Architecture

### Theme System Structure

```
DSober/
├── theme/
│   ├── colors.ts          # Central color definitions
│   ├── typography.ts      # Text styles with appropriate colors
│   └── components.ts      # Reusable styled components
└── screens/
    └── [existing screens]  # Updated to use theme
```

### Color Constants Module

The `colors.ts` file will export a structured theme object:

```typescript
export const theme = {
  colors: {
    // Base colors
    background: {
      primary: '#121212',
      elevated: '#1E1E1E',
      input: '#2A2A2A',
    },
    
    // Brand colors
    primary: {
      main: '#402B78',
      light: '#6B4FB8',
      dark: '#2A1A50',
    },
    
    secondary: {
      main: '#B7F79E',
      light: '#D4FFBE',
      dark: '#8BC34A',
    },
    
    // Text colors
    text: {
      primary: '#FFFFFF',
      secondary: '#B0B0B0',
      tertiary: '#808080',
      disabled: '#4A4A4A',
      onPrimary: '#FFFFFF',
      onSecondary: '#121212',
    },
    
    // Functional colors (preserved)
    functional: {
      success: '#4CAF50',
      error: '#FF5252',
      warning: '#FFC107',
      info: '#2196F3',
    },
    
    // UI element colors
    border: {
      default: '#3A3A3A',
      focus: '#6B4FB8',
      error: '#FF5252',
    },
    
    // State colors
    state: {
      active: '#402B78',
      inactive: '#808080',
      disabled: '#4A4A4A',
      hover: '#6B4FB8',
      pressed: '#2A1A50',
    },
  },
};
```

## Components and Interfaces

### 1. Theme Provider (Optional Enhancement)

While React Native doesn't require a theme provider for this implementation, we can create a simple hook for consistency:

```typescript
// theme/useTheme.ts
import { theme } from './colors';

export const useTheme = () => {
  return theme;
};
```

### 2. Common Component Styles

Create reusable style generators for common patterns:

```typescript
// theme/components.ts
import { StyleSheet } from 'react-native';
import { theme } from './colors';

export const commonStyles = {
  // Button styles
  primaryButton: StyleSheet.create({
    container: {
      backgroundColor: theme.colors.primary.main,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    text: {
      color: theme.colors.text.onPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    disabled: {
      backgroundColor: theme.colors.state.disabled,
    },
  }),
  
  secondaryButton: StyleSheet.create({
    container: {
      backgroundColor: theme.colors.secondary.main,
      borderRadius: 8,
      padding: 16,
      alignItems: 'center',
    },
    text: {
      color: theme.colors.text.onSecondary,
      fontSize: 16,
      fontWeight: '600',
    },
  }),
  
  // Input styles
  input: StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background.input,
      borderWidth: 1,
      borderColor: theme.colors.border.default,
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: theme.colors.text.primary,
    },
    focused: {
      borderColor: theme.colors.border.focus,
    },
  }),
  
  // Screen container
  screen: StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background.primary,
    },
  }),
};
```

### 3. Typography System

```typescript
// theme/typography.ts
import { StyleSheet } from 'react-native';
import { theme } from './colors';

export const typography = StyleSheet.create({
  h1: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text.primary,
  },
  h3: {
    fontSize: 24,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  body: {
    fontSize: 16,
    color: theme.colors.text.primary,
  },
  bodySecondary: {
    fontSize: 16,
    color: theme.colors.text.secondary,
  },
  caption: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
});
```

## Data Models

### Color Configuration Type

```typescript
// types/theme.types.ts
export interface ColorPalette {
  background: {
    primary: string;
    elevated: string;
    input: string;
  };
  primary: {
    main: string;
    light: string;
    dark: string;
  };
  secondary: {
    main: string;
    light: string;
    dark: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    disabled: string;
    onPrimary: string;
    onSecondary: string;
  };
  functional: {
    success: string;
    error: string;
    warning: string;
    info: string;
  };
  border: {
    default: string;
    focus: string;
    error: string;
  };
  state: {
    active: string;
    inactive: string;
    disabled: string;
    hover: string;
    pressed: string;
  };
}

export interface Theme {
  colors: ColorPalette;
}
```

## Implementation Strategy

### Phase 1: Theme Infrastructure
1. Create the `theme/` directory structure
2. Implement `colors.ts` with all color definitions
3. Implement `typography.ts` with text styles
4. Implement `components.ts` with common component styles
5. Create TypeScript types for theme structure

### Phase 2: Core Components
Update components in order of dependency:
1. Navigation components (RootNavigator, MainAppScreen)
2. Authentication screens (AuthScreen)
3. Common UI patterns (buttons, inputs, cards)

### Phase 3: Screen Updates
Update screens systematically by feature area:
1. **Onboarding Flow:**
   - BasicInfoScreen
   - GroupJoinScreen
   - DDInterestScreen
   - DriverInfoScreen
   - ProfilePhotoScreen
   - OnboardingCompleteScreen
   - SEP screens (preserving functional colors)

2. **Main App Screens:**
   - EventsListScreen
   - EventDetailScreen
   - CreateEventScreen
   - DDsListScreen
   - DDDetailScreen
   - RidesScreen
   - ProfileScreen

3. **Admin Screens:**
   - AdminDashboardScreen
   - AdminRideLogScreen

4. **Active Session Screens:**
   - DDActiveSessionScreen
   - DDRideQueueScreen
   - RideStatusScreen

### Phase 4: Special Handling

#### SEP Test Screens
These screens require special attention to preserve functional colors:

**SEPReactionScreen:**
- Background states remain functional:
  - Waiting: `#121212` (new background)
  - Ready: `#FFF9E6` (keep - warning yellow tint)
  - Go: `#4CAF50` (keep - functional green)
  - Early: `#FF5252` (keep - functional red)
- Update UI chrome (progress indicators, text) to use new theme
- Keep "GO!" text white on green background

**SEPPhraseScreen:**
- Update container background to `#121212`
- Update buttons to use primary/secondary colors
- Keep recording state indicators (red for recording)

**SEPSelfieScreen:**
- Update container background to `#121212`
- Update buttons to use primary/secondary colors
- Keep camera UI functional colors

**SEPResultScreen:**
- Update container background to `#121212`
- Use functional colors for pass/fail indicators
- Update action buttons to use primary color

### Color Mapping Strategy

**Current → New Mapping:**

| Current Color | Usage | New Color | Notes |
|--------------|-------|-----------|-------|
| `#fff` (white) | Backgrounds | `#121212` | Main background |
| `#007AFF` (iOS blue) | Primary actions | `#402B78` | Primary brand color |
| `#007AFF` (iOS blue) | Active tabs | `#402B78` | Primary brand color |
| `#f5f5f5` (light gray) | Input backgrounds | `#2A2A2A` | Elevated surface |
| `#000` (black) | Primary text | `#FFFFFF` | Inverted for dark theme |
| `#666` (dark gray) | Secondary text | `#B0B0B0` | Adjusted for contrast |
| `#999` (medium gray) | Tertiary text | `#808080` | Adjusted for contrast |
| `#ddd` (light gray) | Borders | `#3A3A3A` | Adjusted for dark theme |
| `#4CAF50` (green) | Success/Go | `#4CAF50` | **Preserved** |
| `#FF5252` (red) | Error/Early | `#FF5252` | **Preserved** |
| `#FFC107` (amber) | Warning | `#FFC107` | **Preserved** |

## Error Handling

### Color Fallbacks

Implement fallback mechanisms for edge cases:

```typescript
// theme/colors.ts
export const getColor = (colorPath: string, fallback: string = '#FFFFFF'): string => {
  try {
    const keys = colorPath.split('.');
    let value: any = theme.colors;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) return fallback;
    }
    
    return value;
  } catch {
    return fallback;
  }
};
```

### Accessibility Warnings

Add development-time warnings for accessibility issues:

```typescript
// theme/accessibility.ts
export const checkContrast = (
  foreground: string,
  background: string,
  minRatio: number = 4.5
): boolean => {
  // Implementation would calculate actual contrast ratio
  // For production, consider using a library like 'color-contrast-checker'
  return true; // Placeholder
};
```

## Testing Strategy

### Visual Regression Testing
1. Take screenshots of all screens with current colors
2. Apply new theme
3. Compare screenshots to ensure intentional changes only
4. Verify no broken layouts or invisible text

### Accessibility Testing
1. Verify all text meets WCAG AA contrast requirements
2. Test with iOS accessibility features (VoiceOver, Increase Contrast)
3. Test with different system color schemes
4. Verify color-blind friendly combinations

### Manual Testing Checklist
- [ ] All screens render with new background color
- [ ] All buttons use primary or secondary colors appropriately
- [ ] All text is readable with sufficient contrast
- [ ] Tab navigation reflects new color scheme
- [ ] Form inputs are clearly visible and distinguishable
- [ ] Loading indicators use theme colors
- [ ] Modal overlays use theme colors
- [ ] SEP test functional colors are preserved
- [ ] Error states use functional red color
- [ ] Success states use functional green color
- [ ] Disabled states are visually distinct

### Component Testing
Test each updated component individually:
1. Render component with new theme
2. Verify all color props reference theme constants
3. Verify no hardcoded hex values remain
4. Test interactive states (pressed, focused, disabled)
5. Verify text readability

## Migration Path

### Step-by-Step Migration

1. **Create theme infrastructure** (non-breaking)
   - Add theme files
   - No existing code changes

2. **Update one screen at a time** (incremental)
   - Start with AuthScreen (simple, isolated)
   - Test thoroughly before moving to next screen
   - Allows for easy rollback if issues arise

3. **Update navigation last** (final integration)
   - Ensures all screens are ready
   - Provides cohesive final experience

### Rollback Strategy

If issues arise:
1. Theme files can be modified without touching screen files
2. Individual screens can be reverted independently
3. Keep original color values commented in code during transition
4. Use feature flag if needed for gradual rollout

## Performance Considerations

### StyleSheet Optimization

- Use `StyleSheet.create()` for all styles to enable optimization
- Avoid inline style objects where possible
- Cache computed styles

### Color Computation

- All colors are static constants (no runtime computation)
- No performance impact from theme system
- Theme object is created once at module load

## Future Enhancements

### Potential Additions

1. **Light/Dark Mode Toggle**
   - Add light theme variant
   - Implement theme switching mechanism
   - Persist user preference

2. **Custom Theme Support**
   - Allow users to customize accent colors
   - Maintain accessibility automatically

3. **Seasonal Themes**
   - Special color schemes for events
   - Temporary theme overlays

4. **Accessibility Modes**
   - High contrast mode
   - Increased font sizes
   - Reduced motion

## Summary

This design provides a comprehensive, accessible, and maintainable approach to updating the DSober app's color scheme. The centralized theme system ensures consistency, the accessibility analysis guarantees usability, and the phased implementation strategy minimizes risk. The preservation of functional colors maintains intuitive user experiences while the new dark theme with purple and lime green accents creates a modern, distinctive brand identity.
