/**
 * Notification Navigation Utilities
 * 
 * Maps notification types to screen navigation routes
 */

export type NotificationType =
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

export interface NotificationData {
  screen?: string;
  params?: Record<string, any>;
  type?: NotificationType;
  rideRequestId?: string;
  eventId?: string;
  sessionId?: string;
  alertId?: string;
  [key: string]: any;
}

export interface NavigationRoute {
  screen: string;
  params?: Record<string, any>;
}

/**
 * Parse notification data and determine navigation route
 */
export function navigateFromNotification(
  data: NotificationData,
  navigationRef: any
): void {
  if (!navigationRef) {
    console.warn('Navigation ref not available');
    return;
  }

  // Prefer the typed mapping: it uses nested routes, which reach screens
  // inside tab stacks that aren't mounted yet. The flat `screen` hint sent
  // by the server can't, so it's only a fallback for unmapped types.
  const route = getNavigationRoute(data);
  if (route) {
    console.log('Navigating to:', route.screen, route.params);
    navigationRef.navigate(route.screen, route.params || {});
    return;
  }

  if (data.screen) {
    console.log('Navigating to specified screen:', data.screen, data.params);
    navigationRef.navigate(data.screen, data.params || {});
    return;
  }

  console.warn('No navigation route found for notification data:', data);
}

/**
 * Map notification type to navigation route
 */
export function getNavigationRoute(data: NotificationData): NavigationRoute | null {
  const { type, eventId, rideRequestId, sessionId, alertId } = data;

  switch (type) {
    // Ride request notifications - navigate to ride queue
    case 'ride_request':
      return {
        screen: 'Rides',
        params: {
          screen: 'DDRideQueue',
          params: {
            sessionId,
            eventId,
          },
        },
      };

    // Ride status notifications - navigate to ride status
    case 'ride_accepted':
    case 'ride_picked_up':
    case 'ride_cancelled':
      return {
        screen: 'Rides',
        params: {
          screen: 'RideStatus',
          params: {
            eventId,
          },
        },
      };

    // SEP failure - navigate to admin dashboard
    case 'sep_failure':
      return {
        screen: 'Admin',
        params: {
          screen: 'AdminDashboard',
          params: {
            alertId,
          },
        },
      };

    // DD revoked - navigate to profile
    case 'dd_revoked':
      return {
        screen: 'Profile',
        params: {
          screen: 'ProfileMain',
        },
      };

    // DD session started - navigate to active session
    case 'dd_session_started':
    case 'dd_session_reminder':
      return {
        screen: 'Events',
        params: {
          screen: 'DDActiveSession',
          params: {
            sessionId,
            eventId,
          },
        },
      };

    // Approved: continue into the DD upgrade flow (driver info form)
    case 'dd_request_approved':
      return {
        screen: 'DDUpgrade',
      };

    // Rejected: show the event where the request status banner lives —
    // pushing a rejected user into the "Become a DD" form is wrong
    case 'dd_request_rejected':
      return eventId
        ? {
            screen: 'Events',
            params: {
              screen: 'EventDetail',
              params: { eventId },
            },
          }
        : { screen: 'Events' };

    // Event notifications - navigate to event detail
    case 'event_active':
    case 'event_cancelled':
    case 'dd_assigned':
      return {
        screen: 'Events',
        params: {
          screen: 'EventDetail',
          params: {
            eventId,
          },
        },
      };

    default:
      console.warn('Unknown notification type:', type);
      return null;
  }
}

/**
 * Build notification data for a specific notification type
 */
export function buildNotificationData(
  type: NotificationType,
  params: Record<string, any>
): NotificationData {
  return {
    type,
    ...params,
  };
}
