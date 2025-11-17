# Implementation Plan

- [x] 1. Create theme infrastructure
  - Create `DSober/theme/` directory with centralized color definitions, typography styles, and reusable component styles
  - Implement TypeScript types for theme structure to ensure type safety
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 1.1 Create colors.ts with theme object
  - Write the main theme object containing all color definitions (background, primary, secondary, text, functional, border, state colors)
  - Include accessibility-adjusted colors (e.g., lighter primary tint #6B4FB8 for borders)
  - Export theme object and helper functions
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 1.4, 3.5_

- [x] 1.2 Create typography.ts with text styles
  - Define text style presets (h1, h2, h3, body, bodySecondary, caption, label) using theme colors
  - Ensure all text styles use appropriate contrast colors from the theme
  - _Requirements: 2.5, 7.1, 7.2, 7.3_

- [x] 1.3 Create components.ts with common component styles
  - Implement reusable style generators for buttons (primary, secondary, disabled states)
  - Implement input field styles with focus states
  - Implement screen container styles
  - _Requirements: 2.5, 5.1, 8.1, 8.2, 8.3_

- [ ]* 1.4 Create TypeScript types for theme structure
  - Define ColorPalette and Theme interfaces
  - Export types for use across the application
  - _Requirements: 2.5_

- [x] 2. Update navigation and core components
  - Update RootNavigator and MainAppScreen to use new theme colors
  - Update tab bar styling with new background, active/inactive colors
  - Update loading indicators to use primary color
  - _Requirements: 4.5, 9.1, 9.2, 9.3, 9.4, 9.5, 10.5_

- [x] 2.1 Update RootNavigator.tsx
  - Replace hardcoded colors with theme imports
  - Update loading container background to use theme.colors.background.primary
  - Update ActivityIndicator color to use theme.colors.primary.main
  - _Requirements: 4.1, 10.5_

- [x] 2.2 Update MainAppScreen.tsx tab navigator
  - Update tab bar background to theme.colors.background.primary
  - Update tabBarActiveTintColor to theme.colors.primary.main
  - Update tabBarInactiveTintColor to theme.colors.state.inactive
  - _Requirements: 9.1, 9.2, 9.3_

- [x] 3. Update authentication screens
  - Update AuthScreen to use new dark background, primary color buttons, and appropriate text colors
  - Ensure input fields use elevated background color for visibility
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 8.1, 8.2, 8.3, 10.1_

- [x] 3.1 Update AuthScreen.tsx
  - Replace background color with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update input styles to use theme.colors.background.input with theme.colors.border.default
  - Update text colors (title, subtitle, toggle text) to use theme.colors.text.primary and theme.colors.text.secondary
  - Update ActivityIndicator to use theme.colors.text.onPrimary
  - _Requirements: 4.1, 5.1, 5.5, 7.1, 7.2, 8.1, 8.2, 8.3, 10.1_

- [x] 4. Update onboarding screens (excluding SEP tests)
  - Update BasicInfoScreen, GroupJoinScreen, DDInterestScreen, DriverInfoScreen, ProfilePhotoScreen, and OnboardingCompleteScreen
  - Apply new background, primary button colors, and text hierarchy
  - Ensure form inputs use elevated backgrounds and proper focus states
  - _Requirements: 4.1, 4.2, 5.1, 5.3, 5.4, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 8.4, 10.2_

- [x] 4.1 Update BasicInfoScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update input styles to use theme.colors.background.input with theme.colors.border.default and theme.colors.border.focus
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update gender selection buttons to use theme.colors.primary.main for selected state
  - _Requirements: 4.1, 5.1, 5.3, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.2_

- [x] 4.2 Update GroupJoinScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update input styles to use theme.colors.background.input with theme.colors.border.default
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update ActivityIndicator to use theme.colors.text.onPrimary
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.2_

- [x] 4.3 Update DDInterestScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 4.1, 5.1, 6.1, 7.1, 7.2, 10.2_

- [x] 4.4 Update DriverInfoScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update input styles to use theme.colors.background.input with theme.colors.border.default
  - Update upload button to use theme.colors.primary.light for border and background tint
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update ActivityIndicator to use theme.colors.text.onPrimary
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.2_

- [x] 4.5 Update ProfilePhotoScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 10.2_

- [x] 4.6 Update OnboardingCompleteScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 10.2_

- [x] 5. Update SEP test screens with functional color preservation
  - Update SEPReactionScreen, SEPPhraseScreen, SEPSelfieScreen, and SEPResultScreen
  - Preserve functional colors (green for GO, red for errors, yellow for ready state)
  - Update UI chrome (progress indicators, buttons, text) to use new theme
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.1, 5.1, 7.1, 7.2, 10.2_

- [x] 5.1 Update SEPReactionScreen.tsx
  - Update default container background to theme.colors.background.primary
  - **Preserve** containerGo background as #4CAF50 (functional green)
  - **Preserve** containerEarly background as #FF5252 (functional red)
  - **Preserve** containerReady background as #FFF9E6 (functional yellow tint)
  - Update progress indicators to use theme.colors.primary.main for active state
  - Update instruction text colors to use theme.colors.text.primary and secondary
  - Update start button to use theme.colors.primary.main
  - _Requirements: 3.1, 3.5, 4.1, 5.1, 5.4, 7.1, 7.2, 10.2_

- [x] 5.2 Update SEPPhraseScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - **Preserve** recording indicator red color (functional)
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 3.2, 4.1, 5.1, 6.1, 7.1, 7.2, 10.2_

- [x] 5.3 Update SEPSelfieScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - **Preserve** camera UI functional colors
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 3.2, 4.1, 5.1, 7.1, 7.2, 10.2_

- [x] 5.4 Update SEPResultScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - **Preserve** pass/fail indicators using theme.colors.functional.success and theme.colors.functional.error
  - Update text colors to use theme.colors.text.primary and secondary
  - _Requirements: 3.2, 3.3, 4.1, 5.1, 7.1, 7.2, 10.2_

- [-] 6. Update main app screens
  - Update EventsListScreen, EventDetailScreen, CreateEventScreen, DDsListScreen, DDDetailScreen, RidesScreen, and ProfileScreen
  - Apply new background, primary/secondary colors, and text hierarchy consistently
  - Ensure cards and elevated surfaces use slightly lighter background
  - _Requirements: 4.1, 4.4, 5.1, 5.2, 6.1, 6.2, 7.1, 7.2, 7.3, 10.3_

- [x] 6.1 Update EventsListScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/item backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 5.1, 7.1, 7.2, 7.3, 10.3_

- [x] 6.2 Update EventDetailScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status badges to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 6.3 Update CreateEventScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update button styles to use theme.colors.primary.main
  - Update input styles to use theme.colors.background.input with theme.colors.border.default and theme.colors.border.focus
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - _Requirements: 4.1, 5.1, 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 10.3_

- [x] 6.4 Update DDsListScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/item backgrounds to use theme.colors.background.elevated
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate theme colors
  - _Requirements: 4.1, 4.4, 7.1, 7.2, 7.3, 10.3_

- [x] 6.5 Update DDDetailScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 6.6 Update RidesScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/item backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 5.1, 7.1, 7.2, 7.3, 10.3_

- [x] 6.7 Update ProfileScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 7. Update admin screens
  - Update AdminDashboardScreen and AdminRideLogScreen
  - Apply new background, primary colors, and text hierarchy
  - Ensure data tables and lists use elevated backgrounds for readability
  - _Requirements: 4.1, 4.4, 5.1, 7.1, 7.2, 7.3, 10.3_

- [x] 7.1 Update AdminDashboardScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators and badges to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 5.1, 7.1, 7.2, 7.3, 10.3_

- [x] 7.2 Update AdminRideLogScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update list item backgrounds to use theme.colors.background.elevated
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 7.1, 7.2, 7.3, 10.3_

- [x] 8. Update active session screens
  - Update DDActiveSessionScreen, DDRideQueueScreen, and RideStatusScreen
  - Apply new background, primary/secondary colors, and text hierarchy
  - Ensure real-time status indicators use appropriate functional colors
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 8.1 Update DDActiveSessionScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate functional colors (success, warning, error)
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 8.2 Update DDRideQueueScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/item backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main and theme.colors.secondary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status badges to use appropriate functional or theme colors
  - _Requirements: 4.1, 4.4, 5.1, 6.1, 7.1, 7.2, 7.3, 10.3_

- [x] 8.3 Update RideStatusScreen.tsx
  - Replace background colors with theme.colors.background.primary
  - Update card/section backgrounds to use theme.colors.background.elevated
  - Update button styles to use theme.colors.primary.main
  - Update text colors to use theme.colors.text.primary, secondary, and tertiary
  - Update status indicators to use appropriate functional colors (success, warning, error)
  - _Requirements: 4.1, 4.4, 5.1, 7.1, 7.2, 7.3, 10.3_

- [x] 9. Update modal and overlay components
  - Search for and update any modal components, alert overlays, or popup dialogs
  - Ensure modals use theme.colors.background.elevated with appropriate borders
  - Update modal buttons and text to use theme colors
  - _Requirements: 4.2, 5.1, 7.1, 7.2, 10.4_

- [x] 10. Verify accessibility compliance
  - Test all screens with accessibility tools to ensure WCAG AA compliance
  - Verify contrast ratios for all text and interactive elements
  - Test with iOS VoiceOver and Increase Contrast settings
  - Document any accessibility issues and create fixes
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ]* 11. Visual regression testing
  - Take screenshots of all screens before and after theme update
  - Compare screenshots to identify unintended changes
  - Verify all intentional color changes are applied correctly
  - Test on multiple device sizes (phone, tablet)
  - _Requirements: All requirements_

- [x] 12. Manual testing and polish
  - Test all user flows end-to-end with new theme
  - Verify tab navigation, screen transitions, and animations
  - Test form interactions (focus states, validation errors)
  - Test loading states and activity indicators
  - Verify SEP test functional colors are preserved correctly
  - Test admin features with new theme
  - Gather feedback and make final adjustments
  - _Requirements: All requirements_
