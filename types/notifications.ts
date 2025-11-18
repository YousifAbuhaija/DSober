/**
 * Notification Type Definitions
 * 
 * Defines all types and interfaces for the push notification system
 */

// Re-export NotificationType from navigation utils for consistency
export type {
  NotificationType,
  NotificationData as NavigationData,
} from '../utils/notificationNavigation';

/**
 * Notification priority levels
 */
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Notification sound options
 */
export type NotificationSound = 'default' | 'critical_alert' | null;

/**
 * Complete notification data structure
 */
export interface NotificationData {
  // Navigation data
  screen?: string;
  params?: Record<string, any>;
  
  // Notification metadata
  type?: string;
  
  // Entity IDs for navigation
  rideRequestId?: string;
  eventId?: string;
  sessionId?: string;
  alertId?: string;
  userId?: string;
  ddUserId?: string;
  riderUserId?: string;
  groupId?: string;
  
  // Display data
  riderName?: string;
  ddName?: string;
  userName?: string;
  eventName?: string;
  pickupLocation?: string;
  carInfo?: string;
  reason?: string;
  status?: string;
  
  // Additional flexible data
  [key: string]: any;
}

/**
 * Push notification structure
 */
export interface PushNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: NotificationData;
  priority: NotificationPriority;
  sound: NotificationSound;
  badge?: number;
  createdAt: Date;
}

/**
 * Notification response when user interacts with notification
 */
export interface NotificationResponse {
  notification: PushNotification;
  actionIdentifier: string;
  userText?: string;
}

/**
 * Device token information
 */
export interface DeviceToken {
  token: string;
  deviceName?: string;
  deviceOS: 'ios' | 'android';
  appVersion: string;
}

/**
 * Notification template structure
 */
export interface NotificationTemplate {
  type: string;
  priority: NotificationPriority;
  sound: NotificationSound;
  buildTitle: (data: NotificationData) => string;
  buildBody: (data: NotificationData) => string;
  buildData: (data: NotificationData) => NotificationData;
}

/**
 * Notification preferences for a user
 */
export interface NotificationPreferences {
  userId: string;
  rideRequests: boolean;
  rideStatusUpdates: boolean;
  eventUpdates: boolean;
  ddRequestUpdates: boolean;
  ddSessionReminders: boolean;
  sepFailureAlerts: boolean; // Cannot be disabled for DDs/admins
  ddRevocationAlerts: boolean; // Cannot be disabled for DDs
}

/**
 * Notification history item
 */
export interface NotificationHistoryItem {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  data: NotificationData;
  priority: NotificationPriority;
  read: boolean;
  sentAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
  failureReason?: string;
  retryCount: number;
  createdAt: Date;
}

/**
 * Expo push message format
 */
export interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: NotificationData;
  priority?: 'default' | 'normal' | 'high';
  sound?: NotificationSound;
  badge?: number;
  channelId?: string;
  categoryId?: string;
  mutableContent?: boolean;
}

/**
 * Expo push receipt
 */
export interface ExpoPushReceipt {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

/**
 * Notification error codes
 */
export enum NotificationErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  TOKEN_REGISTRATION_FAILED = 'TOKEN_REGISTRATION_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Notification error class
 */
export class NotificationError extends Error {
  constructor(
    message: string,
    public code: NotificationErrorCode,
    public recoverable: boolean
  ) {
    super(message);
    this.name = 'NotificationError';
  }
}
