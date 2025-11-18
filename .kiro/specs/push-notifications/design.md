# Push Notifications Design Document

## Overview

This document outlines the design for implementing push notifications in the DSober mobile application. The solution leverages Expo's push notification service (Expo Notifications) for cross-platform delivery, Supabase for backend storage and triggering, and implements a robust notification management system that handles device registration, message delivery, and user preferences.

The design prioritizes reliability for safety-critical notifications (SEP failures, DD revocations) while providing flexibility for non-critical alerts. The architecture supports both foreground and background notification handling, offline queuing, and graceful degradation when push services are unavailable.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Mobile Application                       │
│                   (React Native + Expo)                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Notification Manager (Client)                │  │
│  │  - Device token registration                         │  │
│  │  - Permission handling                               │  │
│  │  - Foreground/background listeners                   │  │
│  │  - Badge management                                  │  │
│  │  - Navigation routing                                │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                      ↑             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Supabase Client                            │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                      ↑             │
└─────────┼──────────────────────────────────────┼─────────────┘
          ↓                                      ↑
┌─────────┼──────────────────────────────────────┼─────────────┐
│         ↓              Supabase Backend        ↑             │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         PostgreSQL Database                          │  │
│  │  - user_devices (token storage)                      │  │
│  │  - notifications (history)                           │  │
│  │  - notification_preferences                          │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Database Triggers & Functions                │  │
│  │  - On ride_request insert → notify DD                │  │
│  │  - On ride_request update → notify rider             │  │
│  │  - On sep_attempt fail → notify admins               │  │
│  │  - On dd_request update → notify user                │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Edge Functions (Notification Sender)         │  │
│  │  - Fetch device tokens                               │  │
│  │  - Check notification preferences                    │  │
│  │  - Call Expo Push API                                │  │
│  │  - Log delivery status                               │  │
│  │  - Handle retries                                    │  │
│  └──────────────────────────────────────────────────────┘  │
│         ↓                                                    │
└─────────┼────────────────────────────────────────────────────┘
          ↓
┌─────────┼────────────────────────────────────────────────────┐
│         ↓              Expo Push Service                      │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  - Receives push requests from Edge Functions                │
│  - Routes to APNs (iOS) or FCM (Android)                     │
│  - Handles delivery receipts                                 │
│  - Manages rate limiting                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Device Registration Flow
```
App Launch → Request Permissions → Get Expo Push Token → 
Store in user_devices table → Update on token change
```

#### Notification Trigger Flow
```
Database Event (insert/update) → Database Trigger → 
Call Edge Function → Fetch Recipients & Tokens → 
Check Preferences → Send to Expo Push API → 
Deliver to Device → Update notification history
```

#### Notification Handling Flow
```
Device Receives Notification → 
  If App Foreground: Show in-app alert → 
  If App Background: Show system notification → 
User Taps Notification → Parse data → Navigate to screen
```

## Components and Interfaces

### 1. Client-Side Components

#### NotificationManager (contexts/NotificationContext.tsx)

Central manager for all notification operations on the client side.

```typescript
interface NotificationManager {
  // Initialization
  initialize(): Promise<void>;
  requestPermissions(): Promise<boolean>;
  
  // Token management
  registerDevice(): Promise<void>;
  unregisterDevice(): Promise<void>;
  
  // Listeners
  setupNotificationListeners(): void;
  handleNotificationReceived(notification: Notification): void;
  handleNotificationTapped(response: NotificationResponse): void;
  
  // Badge management
  getBadgeCount(): Promise<number>;
  setBadgeCount(count: number): Promise<void>;
  clearBadge(): Promise<void>;
  
  // Navigation
  navigateFromNotification(data: NotificationData): void;
  
  // Preferences
  updatePreferences(preferences: NotificationPreferences): Promise<void>;
}
```

**Key Responsibilities:**
- Request and manage notification permissions
- Register/unregister device tokens with backend
- Set up foreground and background notification listeners
- Handle notification taps and route to appropriate screens
- Manage app badge counts
- Sync notification preferences

#### NotificationPreferencesScreen (screens/NotificationPreferencesScreen.tsx)

UI for users to manage notification settings.

```typescript
interface NotificationPreferences {
  userId: string;
  rideRequests: boolean;
  rideStatusUpdates: boolean;
  eventUpdates: boolean;
  ddRequestUpdates: boolean;
  ddSessionReminders: boolean;
  // Critical notifications (cannot be disabled for certain roles)
  sepFailureAlerts: boolean; // Always true for DDs and admins
  ddRevocationAlerts: boolean; // Always true for DDs
}
```

#### NotificationCenterScreen (screens/NotificationCenterScreen.tsx)

In-app notification history viewer.

```typescript
interface NotificationHistoryItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  createdAt: Date;
}
```

### 2. Backend Components

#### Database Tables

**user_devices**
```sql
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expo_push_token TEXT NOT NULL UNIQUE,
  device_name TEXT,
  device_os TEXT, -- 'ios' or 'android'
  app_version TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_devices_user_id ON user_devices(user_id);
CREATE INDEX idx_user_devices_token ON user_devices(expo_push_token);
CREATE INDEX idx_user_devices_active ON user_devices(is_active);
```

**notifications**
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'ride_request', 'ride_status', 'sep_failure', etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional data for navigation
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  read BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_read ON notifications(read);
```

**notification_preferences**
```sql
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  ride_requests BOOLEAN DEFAULT true,
  ride_status_updates BOOLEAN DEFAULT true,
  event_updates BOOLEAN DEFAULT true,
  dd_request_updates BOOLEAN DEFAULT true,
  dd_session_reminders BOOLEAN DEFAULT true,
  sep_failure_alerts BOOLEAN DEFAULT true, -- Cannot be disabled for DDs/admins
  dd_revocation_alerts BOOLEAN DEFAULT true, -- Cannot be disabled for DDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Database Triggers

**Trigger: Notify DD on Ride Request**
```sql
CREATE OR REPLACE FUNCTION notify_dd_on_ride_request()
RETURNS TRIGGER AS $$
BEGIN
  -- Call edge function to send notification
  PERFORM net.http_post(
    url := current_setting('app.edge_function_url') || '/send-notification',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
    body := jsonb_build_object(
      'type', 'ride_request',
      'userId', NEW.dd_user_id,
      'data', jsonb_build_object(
        'rideRequestId', NEW.id,
        'riderUserId', NEW.rider_user_id,
        'eventId', NEW.event_id,
        'pickupLocation', NEW.pickup_location_text
      )
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ride_request_created
AFTER INSERT ON ride_requests
FOR EACH ROW
EXECUTE FUNCTION notify_dd_on_ride_request();
```

**Trigger: Notify Rider on Ride Status Change**
```sql
CREATE OR REPLACE FUNCTION notify_rider_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM net.http_post(
      url := current_setting('app.edge_function_url') || '/send-notification',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      body := jsonb_build_object(
        'type', 'ride_status_update',
        'userId', NEW.rider_user_id,
        'data', jsonb_build_object(
          'rideRequestId', NEW.id,
          'status', NEW.status,
          'ddUserId', NEW.dd_user_id,
          'eventId', NEW.event_id
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_ride_status_changed
AFTER UPDATE ON ride_requests
FOR EACH ROW
EXECUTE FUNCTION notify_rider_on_status_change();
```

**Trigger: Notify Admins on SEP Failure**
```sql
CREATE OR REPLACE FUNCTION notify_admins_on_sep_failure()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify on failures
  IF NEW.result = 'fail' THEN
    PERFORM net.http_post(
      url := current_setting('app.edge_function_url') || '/send-notification',
      headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.service_role_key')),
      body := jsonb_build_object(
        'type', 'sep_failure',
        'groupId', (SELECT group_id FROM users WHERE id = NEW.user_id),
        'data', jsonb_build_object(
          'sepAttemptId', NEW.id,
          'userId', NEW.user_id,
          'eventId', NEW.event_id
        )
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_sep_failure
AFTER INSERT ON sep_attempts
FOR EACH ROW
EXECUTE FUNCTION notify_admins_on_sep_failure();
```

#### Edge Function: send-notification

Supabase Edge Function that handles notification sending logic.

```typescript
// supabase/functions/send-notification/index.ts

interface NotificationRequest {
  type: NotificationType;
  userId?: string; // Single recipient
  groupId?: string; // All admins in group
  data: Record<string, any>;
}

interface NotificationPayload {
  to: string[]; // Expo push tokens
  title: string;
  body: string;
  data: Record<string, any>;
  priority: 'default' | 'normal' | 'high';
  sound: 'default' | string;
  badge?: number;
  channelId?: string; // Android
}

async function sendNotification(req: NotificationRequest) {
  // 1. Determine recipients
  const recipients = await getRecipients(req);
  
  // 2. Fetch device tokens
  const tokens = await getDeviceTokens(recipients);
  
  // 3. Check notification preferences
  const filteredTokens = await filterByPreferences(tokens, req.type);
  
  // 4. Build notification payload
  const payload = buildNotificationPayload(req);
  
  // 5. Send to Expo Push API
  const results = await sendToExpoPush(filteredTokens, payload);
  
  // 6. Log notification history
  await logNotifications(recipients, payload, results);
  
  // 7. Handle failures and retries
  await handleFailures(results);
  
  return results;
}
```

### 3. Notification Types and Templates

#### Notification Type Definitions

```typescript
type NotificationType =
  | 'ride_request'
  | 'ride_accepted'
  | 'ride_picked_up'
  | 'ride_cancelled'
  | 'sep_failure'
  | 'dd_revoked'
  | 'dd_session_started'
  | 'dd_session_reminder'
  | 'dd_request_approved'
  | 'dd_request_rejected'
  | 'event_active'
  | 'event_cancelled'
  | 'dd_assigned';

interface NotificationTemplate {
  type: NotificationType;
  priority: 'low' | 'normal' | 'high' | 'critical';
  sound: string;
  buildTitle: (data: any) => string;
  buildBody: (data: any) => string;
  buildData: (data: any) => Record<string, any>;
}
```

#### Template Examples

```typescript
const NOTIFICATION_TEMPLATES: Record<NotificationType, NotificationTemplate> = {
  ride_request: {
    type: 'ride_request',
    priority: 'high',
    sound: 'default',
    buildTitle: (data) => '🚗 New Ride Request',
    buildBody: (data) => `${data.riderName} needs a ride from ${data.pickupLocation}`,
    buildData: (data) => ({
      screen: 'DDRideQueue',
      params: { sessionId: data.sessionId, eventId: data.eventId }
    })
  },
  
  ride_accepted: {
    type: 'ride_accepted',
    priority: 'high',
    sound: 'default',
    buildTitle: (data) => '✅ Ride Accepted',
    buildBody: (data) => `${data.ddName} is on the way! ${data.carInfo}`,
    buildData: (data) => ({
      screen: 'RideStatus',
      params: { eventId: data.eventId }
    })
  },
  
  sep_failure: {
    type: 'sep_failure',
    priority: 'critical',
    sound: 'critical_alert',
    buildTitle: (data) => '🚨 SEP Failure Alert',
    buildBody: (data) => `${data.userName} failed SEP verification at ${data.eventName}`,
    buildData: (data) => ({
      screen: 'AdminAlerts',
      params: { alertId: data.alertId }
    })
  },
  
  dd_revoked: {
    type: 'dd_revoked',
    priority: 'critical',
    sound: 'critical_alert',
    buildTitle: (data) => '⚠️ DD Status Revoked',
    buildBody: (data) => `Your DD status has been revoked. ${data.reason}`,
    buildData: (data) => ({
      screen: 'Profile',
      params: {}
    })
  }
};
```

## Data Models

### Client-Side Models

```typescript
// types/notifications.ts

export interface PushNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: NotificationData;
  priority: NotificationPriority;
  sound: string;
  badge?: number;
  createdAt: Date;
}

export interface NotificationData {
  screen: string;
  params: Record<string, any>;
  [key: string]: any;
}

export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

export interface NotificationResponse {
  notification: PushNotification;
  actionIdentifier: string;
  userText?: string;
}

export interface DeviceToken {
  token: string;
  deviceName?: string;
  deviceOS: 'ios' | 'android';
  appVersion: string;
}
```

### Backend Models

```typescript
// Edge function types

export interface UserDevice {
  id: string;
  userId: string;
  expoPushToken: string;
  deviceName?: string;
  deviceOS: 'ios' | 'android';
  appVersion: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, any>;
  priority: NotificationPriority;
  read: boolean;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}

export interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
  sound?: 'default' | string | null;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
}

export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}
```

## Error Handling

### Error Categories

1. **Permission Denied**
   - User denies notification permissions
   - Gracefully degrade: Show in-app alerts only
   - Prompt user to enable in settings for critical features

2. **Token Registration Failure**
   - Expo push token generation fails
   - Retry with exponential backoff (3 attempts)
   - Log error and continue without push notifications

3. **Network Errors**
   - Device offline during token registration
   - Queue registration for next app launch
   - Show offline indicator

4. **Delivery Failures**
   - Invalid token (device uninstalled app)
   - Mark token as inactive in database
   - Remove from future sends

5. **Rate Limiting**
   - Expo push service rate limits
   - Implement exponential backoff
   - Queue messages for retry

6. **Database Trigger Failures**
   - Edge function unreachable
   - Log error in database
   - Implement fallback polling mechanism

### Error Handling Strategies

```typescript
// Client-side error handling
class NotificationError extends Error {
  constructor(
    message: string,
    public code: NotificationErrorCode,
    public recoverable: boolean
  ) {
    super(message);
  }
}

enum NotificationErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TOKEN_REGISTRATION_FAILED = 'TOKEN_REGISTRATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNKNOWN = 'UNKNOWN'
}

async function handleNotificationError(error: NotificationError) {
  switch (error.code) {
    case NotificationErrorCode.PERMISSION_DENIED:
      // Show settings prompt
      await showPermissionPrompt();
      break;
    
    case NotificationErrorCode.TOKEN_REGISTRATION_FAILED:
      if (error.recoverable) {
        // Retry with backoff
        await retryTokenRegistration();
      }
      break;
    
    case NotificationErrorCode.NETWORK_ERROR:
      // Queue for retry
      await queueForRetry();
      break;
    
    default:
      // Log and continue
      console.error('Notification error:', error);
  }
}
```

```typescript
// Edge function error handling
async function sendWithRetry(
  tokens: string[],
  payload: ExpoPushMessage,
  maxRetries: number = 3
): Promise<ExpoPushReceipt[]> {
  let attempt = 0;
  let lastError: Error;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(tokens.map(token => ({ ...payload, to: token })))
      });
      
      if (!response.ok) {
        throw new Error(`Expo push API error: ${response.status}`);
      }
      
      const receipts = await response.json();
      return receipts.data;
      
    } catch (error) {
      lastError = error;
      attempt++;
      
      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  
  throw lastError;
}
```

## Testing Strategy

### Unit Tests

1. **Notification Manager Tests**
   - Token registration logic
   - Permission handling
   - Badge count management
   - Navigation routing from notification data

2. **Template Builder Tests**
   - Correct title/body generation for each type
   - Data payload construction
   - Priority assignment

3. **Preference Validation Tests**
   - Critical notifications cannot be disabled
   - Role-based preference enforcement

### Integration Tests

1. **End-to-End Notification Flow**
   - Create ride request → DD receives notification
   - Accept ride → Rider receives notification
   - SEP failure → Admins receive notification

2. **Token Management**
   - Register device → Token stored in database
   - Logout → Token removed
   - Token refresh → Database updated

3. **Offline Handling**
   - Device offline → Notification queued
   - Device online → Queued notifications delivered

### Manual Testing

1. **Permission Flows**
   - First launch permission request
   - Permission denied → Settings prompt
   - Permission granted → Token registration

2. **Notification Interactions**
   - Tap notification → Navigate to correct screen
   - Dismiss notification → Badge decremented
   - Foreground notification → In-app alert shown

3. **Cross-Platform**
   - iOS notification appearance and sounds
   - Android notification channels and priority
   - Badge counts on both platforms

4. **Edge Cases**
   - Multiple devices for same user
   - App in background vs foreground
   - Do Not Disturb mode
   - Low battery mode

### Performance Tests

1. **Batch Notification Sending**
   - Send to 100+ users simultaneously
   - Measure delivery time
   - Check for rate limiting

2. **Token Lookup Performance**
   - Query time for user tokens
   - Index effectiveness

3. **Database Trigger Latency**
   - Time from database event to notification sent
   - Target: < 5 seconds

## Security Considerations

### Token Security

- Expo push tokens are not sensitive but should be protected
- Store tokens with user association to prevent unauthorized sends
- Validate user ownership before updating tokens
- Implement RLS policies on user_devices table

### Notification Content

- Never include sensitive data in notification body (visible on lock screen)
- Use generic messages and load details in-app
- Example: "New ride request" instead of "John Doe at 123 Main St needs a ride"

### Authorization

- Edge functions must validate service role key
- Database triggers run with elevated privileges
- RLS policies prevent users from reading others' notification history

### Rate Limiting

- Implement per-user rate limits to prevent spam
- Maximum 100 notifications per user per hour
- Critical notifications exempt from rate limits

## Performance Optimization

### Client-Side

1. **Token Caching**
   - Cache token in AsyncStorage
   - Only re-register on token change
   - Reduce API calls

2. **Batch Badge Updates**
   - Debounce badge count updates
   - Update once per second maximum

3. **Lazy Loading**
   - Load notification history on demand
   - Paginate with 20 items per page

### Backend

1. **Token Lookup Optimization**
   - Index on user_id and is_active
   - Cache frequently accessed tokens
   - Batch token queries

2. **Notification Batching**
   - Group notifications by type
   - Send in batches of 100 to Expo API
   - Reduces API calls and latency

3. **Database Trigger Optimization**
   - Use AFTER triggers (non-blocking)
   - Async edge function calls
   - Don't wait for response

## Deployment Considerations

### Environment Variables

```env
# .env
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxx

# Supabase Edge Function environment
EXPO_PUSH_API_URL=https://exp.host/--/api/v2/push/send
SUPABASE_SERVICE_ROLE_KEY=xxx
```

### Database Migrations

1. Create user_devices table
2. Create notifications table
3. Create notification_preferences table
4. Create database triggers
5. Create helper functions
6. Set up RLS policies

### Edge Function Deployment

```bash
# Deploy send-notification edge function
supabase functions deploy send-notification

# Set environment variables
supabase secrets set EXPO_PUSH_API_URL=https://exp.host/--/api/v2/push/send
```

### App Configuration

```json
// app.json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#FF6B35",
      "androidMode": "default",
      "androidCollapsedTitle": "DSober"
    },
    "android": {
      "useNextNotificationsApi": true,
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

## Monitoring and Observability

### Metrics to Track

1. **Delivery Metrics**
   - Notification sent count
   - Delivery success rate
   - Average delivery time
   - Failure reasons

2. **User Engagement**
   - Notification open rate
   - Time to open
   - Dismissal rate

3. **System Health**
   - Token registration success rate
   - Edge function execution time
   - Database trigger latency
   - Expo API rate limit hits

### Logging

```typescript
// Log notification events
interface NotificationLog {
  timestamp: Date;
  event: 'sent' | 'delivered' | 'failed' | 'opened' | 'dismissed';
  notificationId: string;
  userId: string;
  type: NotificationType;
  metadata: Record<string, any>;
}
```

### Alerts

- Alert when delivery success rate < 95%
- Alert when average delivery time > 10 seconds
- Alert when token registration failure rate > 10%
- Alert when critical notifications fail

## Future Enhancements

1. **Rich Notifications**
   - Images in notifications
   - Action buttons (Accept/Decline ride)
   - Inline replies

2. **Notification Scheduling**
   - Schedule reminders for events
   - Daily DD availability prompts

3. **Smart Notifications**
   - ML-based notification timing
   - Quiet hours detection
   - Notification grouping

4. **Analytics Dashboard**
   - Admin view of notification metrics
   - User engagement analytics
   - A/B testing for notification content

5. **Multi-Language Support**
   - Localized notification templates
   - User language preferences
