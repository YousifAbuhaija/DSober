# Implementation Plan

- [x] 1. Create DD upgrade navigation stack
  - Create new file `DSober/navigation/DDUpgradeNavigator.tsx`
  - Define `DDUpgradeStackParamList` type with DriverInfo screen and mode parameter
  - Implement stack navigator with modal presentation style
  - Configure header styling to match app theme
  - _Requirements: 1.1, 1.2_

- [x] 2. Modify DriverInfoScreen to support upgrade mode
  - Add optional `mode` parameter to route params interface ('onboarding' | 'upgrade')
  - Extract navigation logic after successful save into conditional based on mode
  - When mode is 'upgrade': call refreshUser(), show success alert, navigate back
  - When mode is 'onboarding' or undefined: maintain existing navigation to ProfilePhoto
  - Ensure all existing validation and upload logic remains unchanged
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.2, 6.3_

- [x] 3. Update RidesScreen to navigate to DD upgrade flow
  - Modify `renderNonDDView()` function to navigate to DDUpgrade stack instead of showing alert
  - Update button text from "Learn More" to "Get Started"
  - Add navigation call: `navigation.navigate('DDUpgrade', { screen: 'DriverInfo', params: { mode: 'upgrade' }})`
  - Remove existing Alert.alert code for "Become a DD"
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 4. Integrate DD upgrade navigator into main app navigation
  - Read MainAppScreen.tsx to understand current navigation structure
  - Import DDUpgradeNavigator component
  - Add DDUpgrade screen to main stack navigator as a modal
  - Configure modal presentation options (presentation: 'modal', headerShown: false)
  - Update navigation type definitions if needed
  - _Requirements: 1.2, 3.6_

- [x] 5. Verify real-time state updates and UI transitions
  - Test that AuthContext real-time subscription detects DD status changes
  - Verify that RidesScreen automatically re-renders after DD upgrade
  - Confirm DD interface (renderInactiveDDView) displays after upgrade completion
  - Ensure no manual page refresh is required
  - _Requirements: 3.5, 4.1, 4.2, 4.3, 4.4_

- [x] 6. Add error handling and user feedback improvements
  - Verify all error alerts have clear, actionable messages
  - Test upload failure scenarios and recovery
  - Test database update failure scenarios
  - Verify loading states display correctly during upload and save
  - Test permission denial handling for photo library access
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 7. Validate security and data integrity
  - Verify RLS policies allow users to update their own DD status
  - Test that license photos are stored with correct permissions
  - Confirm only user and admins can access uploaded license photos
  - Validate that all form inputs are properly sanitized
  - Test that phone number validation matches existing standards
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
