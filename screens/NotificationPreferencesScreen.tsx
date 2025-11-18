import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { theme } from '../theme/colors';

interface NotificationPreferences {
  rideRequests: boolean;
  rideStatusUpdates: boolean;
  eventUpdates: boolean;
  ddRequestUpdates: boolean;
  ddSessionReminders: boolean;
  sepFailureAlerts: boolean;
  ddRevocationAlerts: boolean;
}

interface PreferenceItem {
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  critical?: boolean;
  criticalFor?: 'dd' | 'admin' | 'both';
}

const PREFERENCE_ITEMS: PreferenceItem[] = [
  {
    key: 'rideRequests',
    label: 'Ride Requests',
    description: 'Get notified when someone requests a ride from you',
  },
  {
    key: 'rideStatusUpdates',
    label: 'Ride Status Updates',
    description: 'Get notified about your ride status changes',
  },
  {
    key: 'eventUpdates',
    label: 'Event Updates',
    description: 'Get notified about event status changes and DD assignments',
  },
  {
    key: 'ddRequestUpdates',
    label: 'DD Request Updates',
    description: 'Get notified about your DD request status',
  },
  {
    key: 'ddSessionReminders',
    label: 'DD Session Reminders',
    description: 'Get reminders during active DD sessions',
  },
  {
    key: 'sepFailureAlerts',
    label: 'SEP Failure Alerts',
    description: 'Critical safety alerts when DDs fail sobriety checks',
    critical: true,
    criticalFor: 'both',
  },
  {
    key: 'ddRevocationAlerts',
    label: 'DD Revocation Alerts',
    description: 'Critical alerts when your DD status is revoked',
    critical: true,
    criticalFor: 'dd',
  },
];

export default function NotificationPreferencesScreen() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Fetch user's current notification preferences
  useEffect(() => {
    fetchPreferences();
  }, [user?.id]);

  const fetchPreferences = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Error fetching notification preferences:', error);
        Alert.alert('Error', 'Failed to load notification preferences');
        return;
      }

      if (data) {
        setPreferences({
          rideRequests: data.ride_requests,
          rideStatusUpdates: data.ride_status_updates,
          eventUpdates: data.event_updates,
          ddRequestUpdates: data.dd_request_updates,
          ddSessionReminders: data.dd_session_reminders,
          sepFailureAlerts: data.sep_failure_alerts,
          ddRevocationAlerts: data.dd_revocation_alerts,
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id || !preferences) return;

    // Check if this is a critical notification that cannot be disabled
    const item = PREFERENCE_ITEMS.find(p => p.key === key);
    if (item?.critical) {
      const isDD = user.isDD;
      const isAdmin = user.role === 'admin';
      
      if (item.criticalFor === 'both' && (isDD || isAdmin)) {
        if (!value) {
          Alert.alert(
            'Cannot Disable',
            'This is a critical safety notification that cannot be disabled for DDs and admins.'
          );
          return;
        }
      } else if (item.criticalFor === 'dd' && isDD) {
        if (!value) {
          Alert.alert(
            'Cannot Disable',
            'This is a critical notification that cannot be disabled for DDs.'
          );
          return;
        }
      } else if (item.criticalFor === 'admin' && isAdmin) {
        if (!value) {
          Alert.alert(
            'Cannot Disable',
            'This is a critical notification that cannot be disabled for admins.'
          );
          return;
        }
      }
    }

    // Optimistically update UI
    const updatedPreferences = { ...preferences, [key]: value };
    setPreferences(updatedPreferences);

    setUpdating(true);
    try {
      // Convert camelCase to snake_case for database
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [dbKey]: value })
        .eq('user_id', user.id);

      if (error) {
        console.error('Error updating notification preferences:', error);
        // Revert optimistic update
        setPreferences(preferences);
        Alert.alert('Error', 'Failed to update notification preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      // Revert optimistic update
      setPreferences(preferences);
      Alert.alert('Error', 'Failed to update notification preferences');
    } finally {
      setUpdating(false);
    }
  };

  const isPreferenceDisabled = (item: PreferenceItem): boolean => {
    if (!item.critical || !user) return false;

    const isDD = user.isDD;
    const isAdmin = user.role === 'admin';

    if (item.criticalFor === 'both') {
      return isDD || isAdmin;
    } else if (item.criticalFor === 'dd') {
      return isDD;
    } else if (item.criticalFor === 'admin') {
      return isAdmin;
    }

    return false;
  };

  if (loading || !preferences) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <Text style={styles.headerDescription}>
          Manage which notifications you receive. Critical safety notifications cannot be disabled.
        </Text>
      </View>

      <View style={styles.section}>
        {PREFERENCE_ITEMS.map((item) => {
          const disabled = isPreferenceDisabled(item);
          const value = preferences[item.key];

          return (
            <View key={item.key} style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <View style={styles.labelContainer}>
                  <Text style={[
                    styles.preferenceLabel,
                    disabled && styles.disabledLabel
                  ]}>
                    {item.label}
                  </Text>
                  {item.critical && (
                    <View style={styles.criticalBadge}>
                      <Text style={styles.criticalBadgeText}>Critical</Text>
                    </View>
                  )}
                </View>
                <Text style={[
                  styles.preferenceDescription,
                  disabled && styles.disabledDescription
                ]}>
                  {item.description}
                </Text>
                {disabled && (
                  <Text style={styles.disabledNote}>
                    Required for your role
                  </Text>
                )}
              </View>
              <Switch
                value={value}
                onValueChange={(newValue) => updatePreferences(item.key, newValue)}
                disabled={disabled || updating}
                trackColor={{
                  false: theme.colors.state.inactive,
                  true: theme.colors.primary.main,
                }}
                thumbColor={value ? theme.colors.primary.light : theme.colors.background.elevated}
              />
            </View>
          );
        })}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          💡 You can change these settings at any time from your profile.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    lineHeight: 22,
  },
  section: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  preferenceInfo: {
    flex: 1,
    marginRight: 16,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginRight: 8,
  },
  disabledLabel: {
    color: theme.colors.text.secondary,
  },
  criticalBadge: {
    backgroundColor: theme.colors.functional.error,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  criticalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.onPrimary,
    textTransform: 'uppercase',
  },
  preferenceDescription: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
  },
  disabledDescription: {
    color: theme.colors.text.tertiary,
  },
  disabledNote: {
    fontSize: 12,
    color: theme.colors.functional.info,
    marginTop: 4,
    fontStyle: 'italic',
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
  },
  footerText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    lineHeight: 20,
    textAlign: 'center',
  },
});
