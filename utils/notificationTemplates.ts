/**
 * Notification Templates
 * 
 * Defines templates for all notification types with title, body, and data builders
 */

import type {
  NotificationTemplate,
  NotificationData,
  NotificationPriority,
  NotificationSound,
} from '../types/notifications';

/**
 * All notification templates mapped by type
 */
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  /**
   * Ride Request - Sent to DD when a rider requests a ride
   * Priority: High (time-sensitive)
   */
  ride_request: {
    type: 'ride_request',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🚗 New Ride Request',
    buildBody: (data: NotificationData) => {
      const riderName = data.riderName || 'A rider';
      const pickupLocation = data.pickupLocation || 'their location';
      return `${riderName} needs a ride from ${pickupLocation}`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Rides',
      params: {
        screen: 'DDRideQueue',
        params: {
          sessionId: data.sessionId,
          eventId: data.eventId,
        },
      },
      type: 'ride_request',
      rideRequestId: data.rideRequestId,
      eventId: data.eventId,
      sessionId: data.sessionId,
      riderUserId: data.riderUserId,
      riderName: data.riderName,
      pickupLocation: data.pickupLocation,
    }),
  },

  /**
   * Ride Accepted - Sent to rider when DD accepts their request
   * Priority: High (time-sensitive)
   */
  ride_accepted: {
    type: 'ride_accepted',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '✅ Ride Accepted',
    buildBody: (data: NotificationData) => {
      const ddName = data.ddName || 'Your driver';
      const carInfo = data.carInfo ? ` - ${data.carInfo}` : '';
      return `${ddName} is on the way!${carInfo}`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Rides',
      params: {
        screen: 'RideStatus',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'ride_accepted',
      rideRequestId: data.rideRequestId,
      eventId: data.eventId,
      ddUserId: data.ddUserId,
      ddName: data.ddName,
      carInfo: data.carInfo,
      status: 'accepted',
    }),
  },

  /**
   * Ride Picked Up - Sent to rider when DD marks them as picked up
   * Priority: Normal
   */
  ride_picked_up: {
    type: 'ride_picked_up',
    priority: 'normal',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🎉 Ride Started',
    buildBody: (data: NotificationData) => {
      const ddName = data.ddName || 'Your driver';
      return `${ddName} has picked you up. Have a safe trip!`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Rides',
      params: {
        screen: 'RideStatus',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'ride_picked_up',
      rideRequestId: data.rideRequestId,
      eventId: data.eventId,
      ddUserId: data.ddUserId,
      ddName: data.ddName,
      status: 'picked_up',
    }),
  },

  /**
   * Ride Cancelled - Sent to rider when DD cancels the ride
   * Priority: High (requires action)
   */
  ride_cancelled: {
    type: 'ride_cancelled',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '❌ Ride Cancelled',
    buildBody: (data: NotificationData) => {
      const ddName = data.ddName || 'Your driver';
      return `${ddName} cancelled your ride. Please request another ride.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Rides',
      params: {
        screen: 'RideStatus',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'ride_cancelled',
      rideRequestId: data.rideRequestId,
      eventId: data.eventId,
      ddUserId: data.ddUserId,
      ddName: data.ddName,
      status: 'cancelled',
    }),
  },

  /**
   * SEP Failure - Sent to admins when a DD fails SEP verification
   * Priority: Critical (safety issue)
   */
  sep_failure: {
    type: 'sep_failure',
    priority: 'critical',
    sound: 'critical_alert',
    buildTitle: (data: NotificationData) => '🚨 SEP Failure Alert',
    buildBody: (data: NotificationData) => {
      const userName = data.userName || 'A user';
      const eventName = data.eventName || 'an event';
      return `${userName} failed SEP verification at ${eventName}. Immediate action required.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Admin',
      params: {
        screen: 'AdminDashboard',
        params: {
          alertId: data.alertId,
        },
      },
      type: 'sep_failure',
      userId: data.userId,
      userName: data.userName,
      eventId: data.eventId,
      eventName: data.eventName,
      alertId: data.alertId,
    }),
  },

  /**
   * DD Revoked - Sent to DD when their status is revoked
   * Priority: Critical (safety and status change)
   */
  dd_revoked: {
    type: 'dd_revoked',
    priority: 'critical',
    sound: 'critical_alert',
    buildTitle: (data: NotificationData) => '⚠️ DD Status Revoked',
    buildBody: (data: NotificationData) => {
      const reason = data.reason || 'Policy violation';
      return `Your DD status has been revoked. Reason: ${reason}. Contact an admin for details.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Profile',
      params: {
        screen: 'ProfileMain',
      },
      type: 'dd_revoked',
      userId: data.userId,
      reason: data.reason,
    }),
  },

  /**
   * DD Session Started - Confirmation sent to DD when session starts
   * Priority: Normal
   */
  dd_session_started: {
    type: 'dd_session_started',
    priority: 'normal',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🚦 DD Session Started',
    buildBody: (data: NotificationData) => {
      const eventName = data.eventName || 'the event';
      return `Your DD session for ${eventName} is now active. Stay safe!`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Events',
      params: {
        screen: 'DDActiveSession',
        params: {
          sessionId: data.sessionId,
          eventId: data.eventId,
        },
      },
      type: 'dd_session_started',
      sessionId: data.sessionId,
      eventId: data.eventId,
      eventName: data.eventName,
    }),
  },

  /**
   * DD Session Reminder - Sent 4 hours after session starts
   * Priority: Normal
   */
  dd_session_reminder: {
    type: 'dd_session_reminder',
    priority: 'normal',
    sound: 'default',
    buildTitle: (data: NotificationData) => '⏰ DD Session Reminder',
    buildBody: (data: NotificationData) => {
      const eventName = data.eventName || 'the event';
      return `You've been on duty for 4 hours at ${eventName}. Remember to take breaks and stay alert.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Events',
      params: {
        screen: 'DDActiveSession',
        params: {
          sessionId: data.sessionId,
          eventId: data.eventId,
        },
      },
      type: 'dd_session_reminder',
      sessionId: data.sessionId,
      eventId: data.eventId,
      eventName: data.eventName,
    }),
  },

  /**
   * DD Request Approved - Sent when admin approves DD upgrade request
   * Priority: High (good news, requires action)
   */
  dd_request_approved: {
    type: 'dd_request_approved',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🎉 DD Request Approved',
    buildBody: (data: NotificationData) => 
      'Congratulations! Your DD request has been approved. You can now start DD sessions.',
    buildData: (data: NotificationData) => ({
      screen: 'DDUpgrade',
      type: 'dd_request_approved',
      userId: data.userId,
    }),
  },

  /**
   * DD Request Rejected - Sent when admin rejects DD upgrade request
   * Priority: Normal
   */
  dd_request_rejected: {
    type: 'dd_request_rejected',
    priority: 'normal',
    sound: 'default',
    buildTitle: (data: NotificationData) => '❌ DD Request Not Approved',
    buildBody: (data: NotificationData) => {
      const reason = data.reason || 'Requirements not met';
      return `Your DD request was not approved. Reason: ${reason}. You can reapply after addressing the issues.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'DDUpgrade',
      type: 'dd_request_rejected',
      userId: data.userId,
      reason: data.reason,
    }),
  },

  /**
   * Event Active - Sent when event transitions to active status
   * Priority: Normal
   */
  event_active: {
    type: 'event_active',
    priority: 'normal',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🎊 Event Now Active',
    buildBody: (data: NotificationData) => {
      const eventName = data.eventName || 'Your event';
      return `${eventName} is now active! DDs are available for rides.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Events',
      params: {
        screen: 'EventDetail',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'event_active',
      eventId: data.eventId,
      eventName: data.eventName,
    }),
  },

  /**
   * Event Cancelled - Sent when event is cancelled
   * Priority: High (requires awareness)
   */
  event_cancelled: {
    type: 'event_cancelled',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🚫 Event Cancelled',
    buildBody: (data: NotificationData) => {
      const eventName = data.eventName || 'An event';
      const reason = data.reason ? ` Reason: ${data.reason}` : '';
      return `${eventName} has been cancelled.${reason}`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Events',
      params: {
        screen: 'EventDetail',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'event_cancelled',
      eventId: data.eventId,
      eventName: data.eventName,
      reason: data.reason,
    }),
  },

  /**
   * DD Assigned - Sent when user is assigned as DD for an event
   * Priority: High (requires awareness and action)
   */
  dd_assigned: {
    type: 'dd_assigned',
    priority: 'high',
    sound: 'default',
    buildTitle: (data: NotificationData) => '🚗 You\'re Assigned as DD',
    buildBody: (data: NotificationData) => {
      const eventName = data.eventName || 'an event';
      return `You've been assigned as a designated driver for ${eventName}. Remember to start your session when ready.`;
    },
    buildData: (data: NotificationData) => ({
      screen: 'Events',
      params: {
        screen: 'EventDetail',
        params: {
          eventId: data.eventId,
        },
      },
      type: 'dd_assigned',
      eventId: data.eventId,
      eventName: data.eventName,
      userId: data.userId,
    }),
  },
};

/**
 * Get notification template by type
 */
export function getNotificationTemplate(type: string): NotificationTemplate | null {
  return NOTIFICATION_TEMPLATES[type] || null;
}

/**
 * Build complete notification from template and data
 */
export function buildNotification(
  type: string,
  data: NotificationData
): {
  title: string;
  body: string;
  data: NotificationData;
  priority: NotificationPriority;
  sound: NotificationSound;
} | null {
  const template = getNotificationTemplate(type);
  
  if (!template) {
    console.error(`No template found for notification type: ${type}`);
    return null;
  }

  return {
    title: template.buildTitle(data),
    body: template.buildBody(data),
    data: template.buildData(data),
    priority: template.priority,
    sound: template.sound,
  };
}

/**
 * Check if a notification type is critical (cannot be disabled)
 */
export function isCriticalNotification(type: string): boolean {
  const criticalTypes = ['sep_failure', 'dd_revoked'];
  return criticalTypes.includes(type);
}

/**
 * Check if a notification type requires DD status
 */
export function requiresDDStatus(type: string): boolean {
  const ddTypes = [
    'ride_request',
    'dd_session_started',
    'dd_session_reminder',
    'dd_assigned',
  ];
  return ddTypes.includes(type);
}

/**
 * Check if a notification type requires admin status
 */
export function requiresAdminStatus(type: string): boolean {
  const adminTypes = ['sep_failure'];
  return adminTypes.includes(type);
}

/**
 * Get Android notification channel ID based on priority
 */
export function getAndroidChannelId(priority: NotificationPriority): string {
  switch (priority) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'normal':
      return 'default';
    case 'low':
      return 'default';
    default:
      return 'default';
  }
}
