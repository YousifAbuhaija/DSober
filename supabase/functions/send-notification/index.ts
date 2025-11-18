/**
 * Supabase Edge Function: send-notification
 * 
 * Handles sending push notifications via Expo Push API
 * Called by database triggers when notification-worthy events occur
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Types
interface NotificationRequest {
  type: string;
  userId?: string; // Single recipient
  groupId?: string; // All admins in group
  data: Record<string, any>;
}

interface UserDevice {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_name?: string;
  device_os: 'ios' | 'android';
  app_version: string;
  is_active: boolean;
}

interface NotificationPreferences {
  user_id: string;
  ride_requests: boolean;
  ride_status_updates: boolean;
  event_updates: boolean;
  dd_request_updates: boolean;
  dd_session_reminders: boolean;
  sep_failure_alerts: boolean;
  dd_revocation_alerts: boolean;
}

interface Recipient {
  userId: string;
  tokens: string[];
}

interface ExpoPushMessage {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: 'default' | 'normal' | 'high';
  sound?: 'default' | string | null;
  badge?: number;
  channelId?: string;
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: {
    error?: 'DeviceNotRegistered' | 'InvalidCredentials' | 'MessageTooBig' | 'MessageRateExceeded';
  };
}

interface ExpoPushResponse {
  data: ExpoPushTicket[];
}

interface NotificationTemplate {
  type: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  sound: string | null;
  buildTitle: (data: any) => string;
  buildBody: (data: any) => string;
  buildData: (data: any) => Record<string, any>;
}

/**
 * Get recipients for the notification
 * Either a single user or all admins in a group
 */
async function getRecipients(
  supabase: any,
  request: NotificationRequest
): Promise<string[]> {
  // Single user recipient
  if (request.userId) {
    return [request.userId];
  }

  // Group admins recipients
  if (request.groupId) {
    const { data: admins, error } = await supabase
      .from('users')
      .select('id')
      .eq('group_id', request.groupId)
      .eq('role', 'admin');

    if (error) {
      console.error('Error fetching group admins:', error);
      throw new Error(`Failed to fetch group admins: ${error.message}`);
    }

    return admins?.map((admin: any) => admin.id) || [];
  }

  throw new Error('Either userId or groupId must be provided');
}

/**
 * Fetch active Expo push tokens for given user IDs
 */
async function getDeviceTokens(
  supabase: any,
  userIds: string[]
): Promise<Map<string, string[]>> {
  const { data: devices, error } = await supabase
    .from('user_devices')
    .select('user_id, expo_push_token')
    .in('user_id', userIds)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching device tokens:', error);
    throw new Error(`Failed to fetch device tokens: ${error.message}`);
  }

  // Group tokens by user ID
  const tokensByUser = new Map<string, string[]>();
  
  for (const device of devices || []) {
    const tokens = tokensByUser.get(device.user_id) || [];
    tokens.push(device.expo_push_token);
    tokensByUser.set(device.user_id, tokens);
  }

  return tokensByUser;
}

/**
 * Map notification types to preference column names
 */
function getPreferenceColumn(notificationType: string): string | null {
  const preferenceMap: Record<string, string> = {
    'ride_request': 'ride_requests',
    'ride_accepted': 'ride_status_updates',
    'ride_picked_up': 'ride_status_updates',
    'ride_cancelled': 'ride_status_updates',
    'sep_failure': 'sep_failure_alerts',
    'dd_revoked': 'dd_revocation_alerts',
    'dd_session_started': 'dd_session_reminders',
    'dd_session_reminder': 'dd_session_reminders',
    'dd_request_approved': 'dd_request_updates',
    'dd_request_rejected': 'dd_request_updates',
    'event_active': 'event_updates',
    'event_cancelled': 'event_updates',
    'dd_assigned': 'event_updates',
  };

  return preferenceMap[notificationType] || null;
}

/**
 * Check if notification type is critical (cannot be disabled)
 */
function isCriticalNotification(notificationType: string): boolean {
  const criticalTypes = ['sep_failure', 'dd_revoked'];
  return criticalTypes.includes(notificationType);
}

/**
 * Filter recipients based on their notification preferences
 * Critical notifications (SEP failures, DD revocations) bypass preference checks
 */
async function filterByPreferences(
  supabase: any,
  userIds: string[],
  notificationType: string
): Promise<string[]> {
  // Critical notifications always go through
  if (isCriticalNotification(notificationType)) {
    console.log(`Notification type ${notificationType} is critical, skipping preference check`);
    return userIds;
  }

  // Get the preference column for this notification type
  const preferenceColumn = getPreferenceColumn(notificationType);
  
  if (!preferenceColumn) {
    console.warn(`No preference mapping found for notification type: ${notificationType}`);
    return userIds; // Send to all if no mapping found
  }

  // Fetch preferences for all users
  const { data: preferences, error } = await supabase
    .from('notification_preferences')
    .select(`user_id, ${preferenceColumn}`)
    .in('user_id', userIds);

  if (error) {
    console.error('Error fetching notification preferences:', error);
    // On error, send to all users (fail open for non-critical notifications)
    return userIds;
  }

  // Filter users who have this notification type enabled
  const filteredUserIds = preferences
    ?.filter((pref: any) => pref[preferenceColumn] === true)
    .map((pref: any) => pref.user_id) || [];

  // Include users who don't have preferences set (default to enabled)
  const usersWithPreferences = new Set(preferences?.map((p: any) => p.user_id) || []);
  const usersWithoutPreferences = userIds.filter(id => !usersWithPreferences.has(id));
  
  const finalUserIds = [...filteredUserIds, ...usersWithoutPreferences];

  console.log(`Filtered ${userIds.length} users to ${finalUserIds.length} based on preferences for ${notificationType}`);

  return finalUserIds;
}

/**
 * Get notification template for a given type
 * Templates define how to build title, body, and data for each notification type
 */
function getNotificationTemplate(type: string): NotificationTemplate | null {
  const templates: Record<string, NotificationTemplate> = {
    ride_request: {
      type: 'ride_request',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '🚗 New Ride Request',
      buildBody: (data) => `${data.riderName || 'A rider'} needs a ride from ${data.pickupLocation || 'their location'}`,
      buildData: (data) => ({ ...data, screen: 'DDRideQueue' }),
    },
    ride_accepted: {
      type: 'ride_accepted',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '✅ Ride Accepted',
      buildBody: (data) => `${data.ddName || 'Your driver'} is on the way!${data.carInfo ? ` - ${data.carInfo}` : ''}`,
      buildData: (data) => ({ ...data, screen: 'RideStatus' }),
    },
    ride_picked_up: {
      type: 'ride_picked_up',
      priority: 'normal',
      sound: 'default',
      buildTitle: (data) => '🎉 Ride Started',
      buildBody: (data) => `${data.ddName || 'Your driver'} has picked you up. Have a safe trip!`,
      buildData: (data) => ({ ...data, screen: 'RideStatus' }),
    },
    ride_cancelled: {
      type: 'ride_cancelled',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '❌ Ride Cancelled',
      buildBody: (data) => `${data.ddName || 'Your driver'} cancelled your ride. Please request another ride.`,
      buildData: (data) => ({ ...data, screen: 'RideStatus' }),
    },
    sep_failure: {
      type: 'sep_failure',
      priority: 'critical',
      sound: 'critical_alert',
      buildTitle: (data) => '🚨 SEP Failure Alert',
      buildBody: (data) => `${data.userName || 'A user'} failed SEP verification at ${data.eventName || 'an event'}. Immediate action required.`,
      buildData: (data) => ({ ...data, screen: 'AdminDashboard' }),
    },
    dd_revoked: {
      type: 'dd_revoked',
      priority: 'critical',
      sound: 'critical_alert',
      buildTitle: (data) => '⚠️ DD Status Revoked',
      buildBody: (data) => `Your DD status has been revoked. Reason: ${data.reason || 'Policy violation'}. Contact an admin for details.`,
      buildData: (data) => ({ ...data, screen: 'Profile' }),
    },
    dd_session_started: {
      type: 'dd_session_started',
      priority: 'normal',
      sound: 'default',
      buildTitle: (data) => '🚦 DD Session Started',
      buildBody: (data) => `Your DD session for ${data.eventName || 'the event'} is now active. Stay safe!`,
      buildData: (data) => ({ ...data, screen: 'DDActiveSession' }),
    },
    dd_session_reminder: {
      type: 'dd_session_reminder',
      priority: 'normal',
      sound: 'default',
      buildTitle: (data) => '⏰ DD Session Reminder',
      buildBody: (data) => `You've been on duty for 4 hours at ${data.eventName || 'the event'}. Remember to take breaks and stay alert.`,
      buildData: (data) => ({ ...data, screen: 'DDActiveSession' }),
    },
    dd_request_approved: {
      type: 'dd_request_approved',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '🎉 DD Request Approved',
      buildBody: (data) => 'Congratulations! Your DD request has been approved. You can now start DD sessions.',
      buildData: (data) => ({ ...data, screen: 'DDUpgrade' }),
    },
    dd_request_rejected: {
      type: 'dd_request_rejected',
      priority: 'normal',
      sound: 'default',
      buildTitle: (data) => '❌ DD Request Not Approved',
      buildBody: (data) => `Your DD request was not approved. Reason: ${data.reason || 'Requirements not met'}. You can reapply after addressing the issues.`,
      buildData: (data) => ({ ...data, screen: 'DDUpgrade' }),
    },
    event_active: {
      type: 'event_active',
      priority: 'normal',
      sound: 'default',
      buildTitle: (data) => '🎊 Event Now Active',
      buildBody: (data) => `${data.eventName || 'Your event'} is now active! DDs are available for rides.`,
      buildData: (data) => ({ ...data, screen: 'EventDetail' }),
    },
    event_cancelled: {
      type: 'event_cancelled',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '🚫 Event Cancelled',
      buildBody: (data) => `${data.eventName || 'An event'} has been cancelled.${data.reason ? ` Reason: ${data.reason}` : ''}`,
      buildData: (data) => ({ ...data, screen: 'EventDetail' }),
    },
    dd_assigned: {
      type: 'dd_assigned',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '🚗 You\'re Assigned as DD',
      buildBody: (data) => `You've been assigned as a designated driver for ${data.eventName || 'an event'}. Remember to start your session when ready.`,
      buildData: (data) => ({ ...data, screen: 'EventDetail' }),
    },
    dd_request_created: {
      type: 'dd_request_created',
      priority: 'high',
      sound: 'default',
      buildTitle: (data) => '📋 New DD Request',
      buildBody: (data) => `${data.userName || 'A user'} wants to be a DD for ${data.eventName || 'an event'}. Review their request.`,
      buildData: (data) => ({ ...data, screen: 'EventDetail' }),
    },
  };

  return templates[type] || null;
}

/**
 * Build notification payload using template
 */
function buildNotificationPayload(
  notificationType: string,
  data: Record<string, any>
): { title: string; body: string; data: Record<string, any>; priority: string; sound: string | null } | null {
  const template = getNotificationTemplate(notificationType);
  
  if (!template) {
    console.error(`No template found for notification type: ${notificationType}`);
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
 * Get Android channel ID based on priority
 */
function getAndroidChannelId(priority: string): string {
  switch (priority) {
    case 'critical':
      return 'critical';
    case 'high':
      return 'high';
    case 'normal':
    case 'low':
    default:
      return 'default';
  }
}

/**
 * Send notifications to Expo Push API with retry logic
 * Batches messages in groups of 100 as per Expo recommendations
 * Retries failed requests up to 3 times with exponential backoff
 */
async function sendToExpoPush(
  tokens: string[],
  payload: { title: string; body: string; data: Record<string, any>; priority: string; sound: string | null },
  retryCount: number = 0
): Promise<{ token: string; ticket: ExpoPushTicket }[]> {
  const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
  const BATCH_SIZE = 100;
  const MAX_RETRIES = 3;
  const results: { token: string; ticket: ExpoPushTicket }[] = [];

  // Convert priority to Expo format
  const expoPriority = payload.priority === 'critical' || payload.priority === 'high' 
    ? 'high' 
    : payload.priority === 'low' 
    ? 'default' 
    : 'normal';

  // Process tokens in batches
  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    
    // Build messages for this batch
    const messages: ExpoPushMessage[] = batch.map(token => ({
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: expoPriority as 'default' | 'normal' | 'high',
      sound: payload.sound,
      channelId: getAndroidChannelId(payload.priority),
    }));

    let batchSuccess = false;
    let lastError: Error | null = null;

    // Retry logic for this batch
    for (let attempt = 0; attempt <= MAX_RETRIES && !batchSuccess; attempt++) {
      try {
        // Exponential backoff: wait 1s, 2s, 4s before retries
        if (attempt > 0) {
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying batch after ${backoffMs}ms (attempt ${attempt}/${MAX_RETRIES})`);
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }

        const response = await fetch(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        if (!response.ok) {
          throw new Error(`Expo Push API error: ${response.status} ${response.statusText}`);
        }

        const responseData: ExpoPushResponse = await response.json();
        
        // Map tickets back to tokens
        batch.forEach((token, index) => {
          results.push({
            token,
            ticket: responseData.data[index],
          });
        });

        batchSuccess = true;
        console.log(`Sent batch of ${batch.length} notifications (attempt ${attempt + 1})`);
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.error(`Error sending batch (attempt ${attempt + 1}/${MAX_RETRIES + 1}):`, lastError.message);
      }
    }

    // If all retries failed, mark tokens as failed
    if (!batchSuccess) {
      console.error(`Failed to send batch after ${MAX_RETRIES + 1} attempts`);
      batch.forEach(token => {
        results.push({
          token,
          ticket: {
            status: 'error',
            message: lastError?.message || 'Unknown error after retries',
          },
        });
      });
    }
  }

  return results;
}

/**
 * Log notifications to database
 */
async function logNotifications(
  supabase: any,
  userIds: string[],
  notificationType: string,
  payload: { title: string; body: string; data: Record<string, any>; priority: string; sound: string | null },
  results: { token: string; ticket: ExpoPushTicket }[],
  tokensByUser: Map<string, string[]>
): Promise<void> {
  const notifications = [];
  const now = new Date().toISOString();

  // Create a reverse map: token -> userId
  const tokenToUser = new Map<string, string>();
  for (const [userId, tokens] of tokensByUser.entries()) {
    for (const token of tokens) {
      tokenToUser.set(token, userId);
    }
  }

  // Group results by user
  const resultsByUser = new Map<string, { token: string; ticket: ExpoPushTicket }[]>();
  for (const result of results) {
    const userId = tokenToUser.get(result.token);
    if (userId) {
      const userResults = resultsByUser.get(userId) || [];
      userResults.push(result);
      resultsByUser.set(userId, userResults);
    }
  }

  // Create notification records for each user
  for (const userId of userIds) {
    const userResults = resultsByUser.get(userId) || [];
    const hasSuccess = userResults.some(r => r.ticket.status === 'ok');
    const hasFailure = userResults.some(r => r.ticket.status === 'error');
    
    // Determine overall status
    let sentAt = null;
    let deliveredAt = null;
    let failedAt = null;
    let failureReason = null;

    if (hasSuccess) {
      sentAt = now;
      deliveredAt = now; // Assume immediate delivery for successful sends
    }
    
    if (hasFailure && !hasSuccess) {
      failedAt = now;
      const errorResult = userResults.find(r => r.ticket.status === 'error');
      failureReason = errorResult?.ticket.message || 'Unknown error';
    }

    notifications.push({
      user_id: userId,
      type: notificationType,
      title: payload.title,
      body: payload.body,
      data: payload.data,
      priority: payload.priority,
      read: false,
      sent_at: sentAt,
      delivered_at: deliveredAt,
      failed_at: failedAt,
      failure_reason: failureReason,
      retry_count: 0,
      created_at: now,
    });
  }

  // Insert notification records
  if (notifications.length > 0) {
    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error logging notifications:', error);
    } else {
      console.log(`Logged ${notifications.length} notification records`);
    }
  }
}

/**
 * Handle failed deliveries
 * - Mark tokens as inactive if DeviceNotRegistered error
 * - Log failures for potential retry
 */
async function handleFailures(
  supabase: any,
  results: { token: string; ticket: ExpoPushTicket }[]
): Promise<void> {
  const tokensToDeactivate: string[] = [];

  for (const result of results) {
    if (result.ticket.status === 'error') {
      const errorType = result.ticket.details?.error;
      
      // DeviceNotRegistered means the app was uninstalled or token is invalid
      if (errorType === 'DeviceNotRegistered') {
        tokensToDeactivate.push(result.token);
        console.log(`Marking token as inactive: ${result.token.substring(0, 20)}...`);
      }
    }
  }

  // Deactivate invalid tokens
  if (tokensToDeactivate.length > 0) {
    const { error } = await supabase
      .from('user_devices')
      .update({ is_active: false })
      .in('expo_push_token', tokensToDeactivate);

    if (error) {
      console.error('Error deactivating tokens:', error);
    } else {
      console.log(`Deactivated ${tokensToDeactivate.length} invalid tokens`);
    }
  }
}

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const request: NotificationRequest = await req.json();

    // Validate request
    if (!request.type) {
      return new Response(
        JSON.stringify({ error: 'Notification type is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!request.userId && !request.groupId) {
      return new Response(
        JSON.stringify({ error: 'Either userId or groupId is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get recipients
    const recipientIds = await getRecipients(supabase, request);

    if (recipientIds.length === 0) {
      console.log('No recipients found for notification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No recipients found',
          sent: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Filter recipients based on notification preferences
    const filteredRecipientIds = await filterByPreferences(
      supabase,
      recipientIds,
      request.type
    );

    if (filteredRecipientIds.length === 0) {
      console.log('All recipients have disabled this notification type');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'All recipients have disabled this notification type',
          sent: 0 
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Build notification payload from template (do this before checking tokens)
    const payload = buildNotificationPayload(request.type, request.data);
    
    if (!payload) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid notification type',
          message: `No template found for type: ${request.type}`
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get device tokens for filtered recipients
    const tokensByUser = await getDeviceTokens(supabase, filteredRecipientIds);

    let sendResults: { token: string; ticket: ExpoPushTicket }[] = [];
    let successCount = 0;
    let failureCount = 0;

    if (tokensByUser.size === 0) {
      console.log('No active device tokens found for recipients');
      // Still log notifications to database even without active devices
      // Users can see them when they log back in
    } else {
      console.log(`Found ${tokensByUser.size} users with active devices`);

      // Collect all tokens
      const allTokens = Array.from(tokensByUser.values()).flat();

      // Send to Expo Push API
      console.log(`Sending ${allTokens.length} notifications via Expo Push API`);
      sendResults = await sendToExpoPush(allTokens, payload);

      // Count successes and failures
      successCount = sendResults.filter(r => r.ticket.status === 'ok').length;
      failureCount = sendResults.filter(r => r.ticket.status === 'error').length;

      console.log(`Sent ${successCount} notifications successfully, ${failureCount} failed`);

      // Handle failures (deactivate invalid tokens)
      await handleFailures(supabase, sendResults);
    }

    // ALWAYS log notifications to database, regardless of push delivery status
    // This ensures users can see notifications when they log back in
    await logNotifications(
      supabase,
      filteredRecipientIds,
      request.type,
      payload,
      sendResults,
      tokensByUser
    );

    // Return results
    return new Response(
      JSON.stringify({
        success: true,
        message: tokensByUser.size === 0 ? 'Notifications logged (no active devices)' : 'Notifications sent',
        recipients: filteredRecipientIds.length,
        sent: successCount,
        failed: failureCount,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in send-notification function:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
