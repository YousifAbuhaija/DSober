# Implementation Plan

- [x] 1. Install dependencies and configure Expo Notifications
  - Install expo-notifications package
  - Install expo-device package for device info
  - Configure app.json with notification settings (icon, color, Android channels)
  - Set up notification icon assets
  - _Requirements: 1.1, 1.2_

- [x] 2. Create database schema for notifications
- [x] 2.1 Create user_devices table
  - Write migration to create user_devices table with columns for user_id, expo_push_token, device_name, device_os, app_version, is_active, timestamps
  - Add indexes on user_id, expo_push_token, and is_active
  - Add RLS policies to allow users to manage their own devices
  - _Requirements: 1.3, 1.4_

- [x] 2.2 Create notifications table
  - Write migration to create notifications table with columns for user_id, type, title, body, data (JSONB), priority, read status, delivery timestamps, retry_count
  - Add indexes on user_id, type, created_at, and read status
  - Add RLS policies to allow users to read their own notifications
  - _Requirements: 9.3, 12.2_

- [x] 2.3 Create notification_preferences table
  - Write migration to create notification_preferences table with boolean columns for each notification type
  - Add default values (all true)
  - Add RLS policies to allow users to manage their own preferences
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 3. Implement client-side notification manager
- [x] 3.1 Create NotificationContext with token management
  - Create contexts/NotificationContext.tsx with React Context
  - Implement requestPermissions function to request notification permissions
  - Implement registerDevice function to get Expo push token and store in database
  - Implement unregisterDevice function to remove token on logout
  - Handle token refresh and update in database
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 3.2 Implement notification listeners
  - Set up foreground notification listener using Notifications.addNotificationReceivedListener
  - Set up notification tap handler using Notifications.addNotificationResponseReceivedListener
  - Implement handleNotificationReceived to show in-app alerts when app is in foreground
  - Implement handleNotificationTapped to parse data and navigate to appropriate screen
  - _Requirements: 2.5, 3.5, 4.4, 5.5, 6.5, 7.4_

- [x] 3.3 Implement badge management
  - Create getBadgeCount function using Notifications.getBadgeCountAsync
  - Create setBadgeCount function using Notifications.setBadgeCountAsync
  - Create clearBadge function to reset badge to 0
  - Implement badge increment on notification received
  - Implement badge decrement on notification viewed
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 3.4 Implement navigation routing from notifications
  - Create navigateFromNotification function that parses notification data
  - Map notification types to screen names and parameters
  - Handle navigation for all notification types (ride requests, ride status, SEP alerts, DD requests, events)
  - _Requirements: 2.5, 3.5, 4.4, 5.5, 6.5, 7.4_

- [x] 4. Create notification preferences UI
- [x] 4.1 Create NotificationPreferencesScreen
  - Create screens/NotificationPreferencesScreen.tsx
  - Fetch user's current notification preferences from database
  - Display toggle switches for each notification type
  - Disable toggles for critical notifications based on user role (SEP alerts for DDs/admins, DD revocation for DDs)
  - Implement updatePreferences function to save changes to database
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 4.2 Add navigation to preferences from profile screen
  - Add "Notification Settings" button to ProfileScreen
  - Navigate to NotificationPreferencesScreen when tapped
  - _Requirements: 8.1_

- [x] 5. Create notification center UI
- [x] 5.1 Create NotificationCenterScreen
  - Create screens/NotificationCenterScreen.tsx
  - Fetch notification history from database (last 30 days)
  - Display notifications grouped by date
  - Show unread indicator for unread notifications
  - Implement pull-to-refresh to fetch latest notifications
  - Implement pagination (20 items per page)
  - _Requirements: 12.1, 12.2, 12.3_

- [x] 5.2 Implement notification tap handling in center
  - Handle notification item tap to navigate to relevant screen
  - Mark notification as read when tapped
  - Update badge count when notification is read
  - _Requirements: 12.4, 12.5_

- [x] 5.3 Add navigation to notification center
  - Add notification bell icon to main navigation header
  - Show badge count on bell icon
  - Navigate to NotificationCenterScreen when tapped
  - _Requirements: 12.1_

- [x] 6. Create notification type definitions and templates
- [x] 6.1 Create notification types file
  - Create types/notifications.ts with NotificationType enum
  - Define NotificationData, NotificationPriority, PushNotification interfaces
  - Define NotificationTemplate interface
  - _Requirements: All notification requirements_

- [x] 6.2 Implement notification templates
  - Create utils/notificationTemplates.ts
  - Implement templates for all notification types: ride_request, ride_accepted, ride_picked_up, ride_cancelled, sep_failure, dd_revoked, dd_session_started, dd_session_reminder, dd_request_approved, dd_request_rejected, event_active, event_cancelled, dd_assigned
  - Each template should define priority, sound, title builder, body builder, and data builder
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.3, 7.5_

- [x] 7. Implement Supabase Edge Function for sending notifications
- [x] 7.1 Create send-notification edge function
  - Create supabase/functions/send-notification/index.ts
  - Implement request handler that accepts type, userId/groupId, and data
  - Implement getRecipients function to determine who should receive notification (single user or all admins in group)
  - Implement getDeviceTokens function to fetch active Expo push tokens from user_devices table
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_

- [x] 7.2 Implement preference filtering
  - Implement filterByPreferences function to check notification_preferences table
  - Skip preference check for critical notifications (SEP failures, DD revocations)
  - Filter out recipients who have disabled the notification type
  - _Requirements: 8.2, 8.3, 8.4_

- [x] 7.3 Implement Expo Push API integration
  - Implement buildNotificationPayload function using notification templates
  - Implement sendToExpoPush function to call Expo Push API
  - Batch notifications in groups of 100
  - Handle Expo API response and parse receipts
  - _Requirements: 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 9.1_

- [x] 7.4 Implement notification logging and retry logic
  - Implement logNotifications function to insert records into notifications table
  - Implement handleFailures function to process failed deliveries
  - Mark tokens as inactive if DeviceNotRegistered error
  - Retry failed notifications up to 3 times with exponential backoff
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 7.5 Deploy edge function
  - Deploy send-notification function to Supabase
  - Set environment variables for Expo Push API URL
  - Test edge function with sample notification request
  - _Requirements: All notification requirements_

- [x] 8. Create database triggers for automatic notifications
- [x] 8.1 Create trigger for ride request notifications
  - Write migration to create notify_dd_on_ride_request function
  - Function should call send-notification edge function with ride request data
  - Create AFTER INSERT trigger on ride_requests table
  - _Requirements: 2.1, 2.2, 2.3, 2.4_

- [x] 8.2 Create trigger for ride status notifications
  - Write migration to create notify_rider_on_status_change function
  - Function should call send-notification edge function when status changes
  - Create AFTER UPDATE trigger on ride_requests table
  - Handle accepted, picked_up, and cancelled status changes
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 8.3 Create trigger for SEP failure notifications
  - Write migration to create notify_admins_on_sep_failure function
  - Function should call send-notification edge function with groupId to notify all admins
  - Create AFTER INSERT trigger on sep_attempts table (only for result = 'fail')
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 8.4 Create trigger for DD request status notifications
  - Write migration to create notify_user_on_dd_request_update function
  - Function should call send-notification edge function when DD request is approved or rejected
  - Create AFTER UPDATE trigger on dd_requests table
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [x] 8.5 Create trigger for DD session notifications
  - Write migration to create notify_dd_on_session_start function for session start confirmation
  - Write migration to create notify_dd_on_revocation function for DD status revocation
  - Create AFTER INSERT trigger on dd_sessions table
  - Create AFTER UPDATE trigger on users table (when dd_status changes to 'revoked')
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [x] 8.6 Create trigger for event notifications
  - Write migration to create notify_members_on_event_status function
  - Function should notify users when event status changes to 'active' or when event is cancelled
  - Create AFTER UPDATE trigger on events table
  - _Requirements: 6.1, 6.2_

- [x] 8.7 Create trigger for DD assignment notifications
  - Write migration to create notify_user_on_dd_assignment function
  - Function should notify user when they are assigned as DD for an event
  - Create AFTER INSERT trigger on dd_assignments table
  - _Requirements: 6.3_

- [-] 9. Implement notification sound and priority handling
- [ ] 9.1 Configure notification channels for Android
  - Create notification channels in NotificationContext initialization
  - Create 'critical' channel with high importance for SEP failures and DD revocations
  - Create 'high' channel with default importance for ride requests
  - Create 'default' channel with low importance for general notifications
  - _Requirements: 11.1, 11.2, 11.3_

- [ ] 9.2 Implement sound selection based on priority
  - Map notification priority to sound in notification templates
  - Use 'critical_alert' sound for critical notifications
  - Use 'default' sound for high and normal priority
  - Respect device Do Not Disturb settings for non-critical notifications
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 10. Implement error handling and offline support
- [ ] 10.1 Create error handling utilities
  - Create utils/notificationErrors.ts with NotificationError class
  - Define error codes: PERMISSION_DENIED, TOKEN_REGISTRATION_FAILED, NETWORK_ERROR, INVALID_TOKEN
  - Implement handleNotificationError function with recovery strategies
  - _Requirements: 9.1, 9.2_

- [ ] 10.2 Implement token registration retry logic
  - Add retry logic to registerDevice function with exponential backoff
  - Maximum 3 retry attempts
  - Queue registration for next app launch if all retries fail
  - _Requirements: 9.1, 9.2_

- [ ] 10.3 Implement offline notification queuing
  - Store failed notification sends in AsyncStorage
  - Retry queued notifications when device comes online
  - Use NetInfo to detect connectivity changes
  - _Requirements: 9.2, 9.4_

- [ ] 11. Integrate notification system with existing screens
- [ ] 11.1 Update AuthContext to initialize notifications
  - Call NotificationContext.initialize() after successful login
  - Call NotificationContext.unregisterDevice() on logout
  - _Requirements: 1.1, 1.4_

- [ ] 11.2 Update App.tsx to wrap with NotificationProvider
  - Import NotificationProvider and wrap app tree
  - Ensure NotificationProvider is inside NavigationContainer
  - _Requirements: 1.1_

- [ ] 11.3 Add notification permission prompt to onboarding
  - Add notification permission request to OnboardingCompleteScreen
  - Show explanation of why notifications are important
  - Handle permission denial gracefully
  - _Requirements: 1.1_

- [ ] 12. Implement DD session reminder notifications
- [ ] 12.1 Create scheduled notification for session reminders
  - Implement function to schedule local notification 4 hours after session start
  - Store scheduled notification ID in dd_sessions table
  - Cancel scheduled notification when session ends
  - _Requirements: 5.4_

- [ ] 13. Testing and validation
- [ ] 13.1 Test notification delivery for all types
  - Test ride request notification to DD
  - Test ride status notifications to rider
  - Test SEP failure notification to admins
  - Test DD request approval/rejection notifications
  - Test event status notifications
  - Test DD session notifications
  - _Requirements: All notification requirements_

- [ ] 13.2 Test notification preferences
  - Test disabling non-critical notifications
  - Test that critical notifications cannot be disabled for DDs/admins
  - Test preference persistence across app restarts
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 13.3 Test error handling and edge cases
  - Test permission denial flow
  - Test token registration failure and retry
  - Test offline notification queuing
  - Test invalid token handling
  - Test notification delivery when app is in foreground vs background
  - _Requirements: 9.1, 9.2, 9.4_

- [ ] 13.4 Test badge management
  - Test badge increment on notification received
  - Test badge clear on app open
  - Test badge decrement on notification viewed
  - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [ ] 13.5 Test notification center
  - Test notification history display
  - Test marking notifications as read
  - Test navigation from notification center
  - Test pagination
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 13.6 Test cross-platform compatibility
  - Test notifications on iOS (simulator and device)
  - Test notifications on Android (emulator and device)
  - Test notification sounds and vibration patterns
  - Test notification appearance and formatting
  - _Requirements: 11.1, 11.2, 11.3_
