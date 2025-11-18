import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { navigateFromNotification, NotificationData } from '../utils/notificationNavigation';
import type { NotificationPriority } from '../types/notifications';

interface NotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  initialize: () => Promise<void>;
  requestPermissions: () => Promise<boolean>;
  registerDevice: () => Promise<void>;
  unregisterDevice: () => Promise<void>;
  getBadgeCount: () => Promise<number>;
  setBadgeCount: (count: number) => Promise<void>;
  clearBadge: () => Promise<void>;
  handleNotificationReceived: (notification: Notifications.Notification) => Promise<void>;
  handleNotificationTapped: (response: Notifications.NotificationResponse) => Promise<void>;
  setNavigationRef: (ref: any) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Configure Android notification channels
 * Must be called before any notifications are sent
 */
async function setupNotificationChannels() {
  if (Platform.OS === 'android') {
    // Critical channel for SEP failures and DD revocations
    await Notifications.setNotificationChannelAsync('critical', {
      name: 'Critical Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF0000',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: true, // Override Do Not Disturb for critical notifications
    });

    // High priority channel for ride requests
    await Notifications.setNotificationChannelAsync('high', {
      name: 'Ride Requests',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false, // Respect Do Not Disturb
    });

    // Default channel for general notifications
    await Notifications.setNotificationChannelAsync('default', {
      name: 'General Notifications',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250],
      lightColor: '#FF6B35',
      sound: 'default',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      bypassDnd: false, // Respect Do Not Disturb
    });

    console.log('Android notification channels configured');
  }
}

// Configure how notifications are handled when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const navigationRef = useRef<any>(null);

  /**
   * Request notification permissions from the device
   */
  const requestPermissions = async (): Promise<boolean> => {
    try {
      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return false;
      }

      // Get current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not already granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Notification permissions denied');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  };

  /**
   * Get Expo push token and store it in the database
   */
  const registerDevice = async (): Promise<void> => {
    try {
      console.log('[registerDevice] Starting device registration...');
      console.log('[registerDevice] User ID:', user?.id);
      console.log('[registerDevice] Session exists:', !!session);
      
      if (!user?.id || !session) {
        console.log('[registerDevice] Cannot register device: No authenticated user');
        return;
      }

      // Verify auth session is valid by checking if we can get the current session
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      console.log('[registerDevice] Current session check:', { hasSession: !!currentSession, error: sessionError });
      
      if (sessionError || !currentSession) {
        console.log('[registerDevice] Cannot register device: Invalid session');
        return;
      }

      // Check if we're on a physical device
      if (!Device.isDevice) {
        console.log('Cannot register device: Not a physical device');
        return;
      }

      // Request permissions first
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        console.log('Cannot register device: Permissions not granted');
        return;
      }

      // Get Expo push token
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas?.projectId,
      });
      const token = tokenData.data;
      
      console.log('Expo push token obtained:', token);
      setExpoPushToken(token);

      // Get device information
      const deviceName = Device.deviceName || 'Unknown Device';
      const deviceOS = Platform.OS as 'ios' | 'android';
      const appVersion = Constants.expoConfig?.version || '1.0.0';

      // Store token in database
      console.log('[registerDevice] Attempting to insert device record...');
      console.log('[registerDevice] Data:', { user_id: user.id, token, deviceName, deviceOS, appVersion });
      
      // Try INSERT first
      const { error: insertError } = await supabase
        .from('user_devices')
        .insert({
          user_id: user.id,
          expo_push_token: token,
          device_name: deviceName,
          device_os: deviceOS,
          app_version: appVersion,
          is_active: true,
          last_used_at: new Date().toISOString(),
        });

      // If INSERT failed due to duplicate, try UPDATE
      if (insertError) {
        console.log('[registerDevice] Insert failed:', insertError);
        
        if (insertError.code === '23505') {
          // Duplicate key - update existing record
          console.log('[registerDevice] Duplicate key detected, attempting update...');
          
          const { error: updateError } = await supabase
            .from('user_devices')
            .update({
              user_id: user.id,
              device_name: deviceName,
              device_os: deviceOS,
              app_version: appVersion,
              is_active: true,
              last_used_at: new Date().toISOString(),
            })
            .eq('expo_push_token', token);

          if (updateError) {
            console.error('[registerDevice] Error updating device token:', updateError);
            throw updateError;
          }
          
          console.log('[registerDevice] Device updated successfully');
        } else {
          console.error('[registerDevice] Error inserting device token:', insertError);
          throw insertError;
        }
      } else {
        console.log('[registerDevice] Device inserted successfully');
      }

      console.log('[registerDevice] Device registration complete');
    } catch (error) {
      console.error('[registerDevice] Fatal error:', error);
      throw error;
    }
  };

  /**
   * Remove device token from database on logout
   */
  const unregisterDevice = async (): Promise<void> => {
    try {
      if (!expoPushToken) {
        console.log('No token to unregister');
        return;
      }

      // Mark token as inactive instead of deleting
      const { error } = await supabase
        .from('user_devices')
        .update({ is_active: false })
        .eq('expo_push_token', expoPushToken);

      if (error) {
        console.error('Error unregistering device:', error);
        throw error;
      }

      console.log('Device unregistered successfully');
      setExpoPushToken(null);
    } catch (error) {
      console.error('Error unregistering device:', error);
      throw error;
    }
  };

  /**
   * Get current badge count
   */
  const getBadgeCount = async (): Promise<number> => {
    try {
      const count = await Notifications.getBadgeCountAsync();
      return count;
    } catch (error) {
      console.error('Error getting badge count:', error);
      return 0;
    }
  };

  /**
   * Set badge count
   */
  const setBadgeCount = async (count: number): Promise<void> => {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  };

  /**
   * Clear badge count
   */
  const clearBadge = async (): Promise<void> => {
    try {
      await Notifications.setBadgeCountAsync(0);
    } catch (error) {
      console.error('Error clearing badge:', error);
    }
  };

  /**
   * Set navigation reference for routing from notifications
   */
  const setNavigationRef = (ref: any) => {
    navigationRef.current = ref;
  };

  /**
   * Handle notification received while app is in foreground
   */
  const handleNotificationReceived = async (notification: Notifications.Notification): Promise<void> => {
    try {
      console.log('Handling foreground notification:', notification);
      
      // Update state
      setNotification(notification);
      
      // Increment badge count
      const currentBadge = await getBadgeCount();
      await setBadgeCount(currentBadge + 1);
      
      // Show in-app alert for foreground notifications
      const { title, body } = notification.request.content;
      Alert.alert(
        title || 'Notification',
        body || '',
        [
          {
            text: 'Dismiss',
            style: 'cancel',
          },
          {
            text: 'View',
            onPress: () => {
              // Navigate to the appropriate screen
              const data = notification.request.content.data as NotificationData;
              if (navigationRef.current) {
                navigateFromNotification(data, navigationRef.current);
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error handling notification received:', error);
    }
  };

  /**
   * Handle notification tap (user tapped on notification)
   */
  const handleNotificationTapped = async (response: Notifications.NotificationResponse): Promise<void> => {
    try {
      console.log('Handling notification tap:', response);
      
      const data = response.notification.request.content.data as NotificationData;
      
      // Decrement badge count
      const currentBadge = await getBadgeCount();
      if (currentBadge > 0) {
        await setBadgeCount(currentBadge - 1);
      }
      
      // Navigate to the appropriate screen using navigation utility
      if (navigationRef.current) {
        navigateFromNotification(data, navigationRef.current);
      }
    } catch (error) {
      console.error('Error handling notification tap:', error);
    }
  };

  /**
   * Initialize notification system
   */
  const initialize = async (): Promise<void> => {
    try {
      console.log('Initializing notification system...');
      
      // Register device and get token
      await registerDevice();
      
      console.log('Notification system initialized');
    } catch (error) {
      console.error('Error initializing notification system:', error);
    }
  };

  // Set up notification listeners on mount
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      handleNotificationReceived(notification);
    });

    // Listener for when user taps on a notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      handleNotificationTapped(response);
    });

    return () => {
      // Only cleanup if removeNotificationSubscription exists (not in Expo Go)
      if (notificationListener.current && Notifications.removeNotificationSubscription) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current && Notifications.removeNotificationSubscription) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // Handle token refresh when user changes
  useEffect(() => {
    if (user?.id && session) {
      // Check if we need to register/update token
      if (!expoPushToken) {
        registerDevice().catch(error => {
          console.error('Failed to register device on user change:', error);
        });
      }
    }
  }, [user?.id, session]);

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        notification,
        initialize,
        requestPermissions,
        registerDevice,
        unregisterDevice,
        getBadgeCount,
        setBadgeCount,
        clearBadge,
        handleNotificationReceived,
        handleNotificationTapped,
        setNavigationRef,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
