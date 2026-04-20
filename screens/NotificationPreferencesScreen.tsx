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
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { colors, spacing, typography } from '../theme';

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
  icon: keyof typeof Ionicons.glyphMap;
  critical?: boolean;
  criticalFor?: 'dd' | 'admin' | 'both';
}

const PREFERENCE_GROUPS: { title: string; items: PreferenceItem[] }[] = [
  {
    title: 'Rides',
    items: [
      {
        key: 'rideRequests',
        label: 'Ride Requests',
        description: 'When someone requests a ride from you',
        icon: 'car-outline',
      },
      {
        key: 'rideStatusUpdates',
        label: 'Ride Status Updates',
        description: 'Changes to your active ride status',
        icon: 'navigate-outline',
      },
    ],
  },
  {
    title: 'Events & DD',
    items: [
      {
        key: 'eventUpdates',
        label: 'Event Updates',
        description: 'Event status changes and DD assignments',
        icon: 'calendar-outline',
      },
      {
        key: 'ddRequestUpdates',
        label: 'DD Request Updates',
        description: 'Status updates on your DD requests',
        icon: 'person-outline',
      },
      {
        key: 'ddSessionReminders',
        label: 'Session Reminders',
        description: 'Reminders during active DD sessions',
        icon: 'alarm-outline',
      },
    ],
  },
  {
    title: 'Safety',
    items: [
      {
        key: 'sepFailureAlerts',
        label: 'SEP Failure Alerts',
        description: 'Critical alerts when a DD fails sobriety checks',
        icon: 'warning-outline',
        critical: true,
        criticalFor: 'both',
      },
      {
        key: 'ddRevocationAlerts',
        label: 'DD Revocation Alerts',
        description: 'Alerts when your DD status is revoked',
        icon: 'shield-outline',
        critical: true,
        criticalFor: 'dd',
      },
    ],
  },
];

function Divider() {
  return <View style={styles.divider} />;
}

export default function NotificationPreferencesScreen() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

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
    } catch {
      Alert.alert('Error', 'Failed to load notification preferences');
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = (item: PreferenceItem): boolean => {
    if (!item.critical || !user) return false;
    const isDD = user.isDD;
    const isAdmin = user.role === 'admin';
    if (item.criticalFor === 'both') return isDD || isAdmin;
    if (item.criticalFor === 'dd') return isDD;
    if (item.criticalFor === 'admin') return isAdmin;
    return false;
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!user?.id || !preferences) return;

    const item = PREFERENCE_GROUPS.flatMap(g => g.items).find(p => p.key === key);
    if (item && isDisabled(item) && !value) {
      Alert.alert('Cannot Disable', 'This is a critical safety notification required for your role.');
      return;
    }

    const prev = preferences;
    setPreferences({ ...preferences, [key]: value });
    setUpdating(true);
    try {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [dbKey]: value })
        .eq('user_id', user.id);

      if (error) {
        setPreferences(prev);
        Alert.alert('Error', 'Failed to update preferences');
      }
    } catch {
      setPreferences(prev);
      Alert.alert('Error', 'Failed to update preferences');
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !preferences) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.brand.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.headerDescription}>
        Critical safety notifications cannot be disabled.
      </Text>

      {PREFERENCE_GROUPS.map((group) => (
        <View key={group.title}>
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>{group.title}</Text>
          </View>

          <View style={styles.section}>
            {group.items.map((item, index) => {
              const disabled = isDisabled(item);
              const value = preferences[item.key];
              const isLast = index === group.items.length - 1;

              return (
                <View key={item.key}>
                  <View style={styles.row}>
                    <View style={styles.iconWrap}>
                      <Ionicons
                        name={item.icon}
                        size={20}
                        color={disabled ? colors.text.tertiary : colors.text.secondary}
                      />
                    </View>
                    <View style={styles.labelWrap}>
                      <View style={styles.labelRow}>
                        <Text style={[styles.label, disabled && styles.labelDisabled]}>
                          {item.label}
                        </Text>
                        {item.critical && (
                          <View style={styles.criticalBadge}>
                            <Text style={styles.criticalBadgeText}>Required</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.description, disabled && styles.descriptionDisabled]}>
                        {item.description}
                      </Text>
                    </View>
                    <Switch
                      value={value}
                      onValueChange={(v) => updatePreference(item.key, v)}
                      disabled={disabled || updating}
                      trackColor={{ false: colors.bg.muted, true: colors.brand.primary }}
                      thumbColor="#fff"
                    />
                  </View>
                  {!isLast && <Divider />}
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    paddingBottom: 48,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
  },
  headerDescription: {
    fontSize: 14,
    color: colors.text.tertiary,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabel: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    minHeight: 60,
  },
  iconWrap: {
    width: 32,
    alignItems: 'center',
    marginRight: spacing.md,
  },
  labelWrap: {
    flex: 1,
    marginRight: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 2,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  labelDisabled: {
    color: colors.text.secondary,
  },
  description: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text.secondary,
    lineHeight: 18,
  },
  descriptionDisabled: {
    color: colors.text.tertiary,
  },
  criticalBadge: {
    backgroundColor: `${colors.ui.error}22`,
    borderWidth: 1,
    borderColor: `${colors.ui.error}55`,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  criticalBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.ui.error,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: spacing.base + 32 + spacing.md,
  },
});
