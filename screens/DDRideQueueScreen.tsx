import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest } from '../types/database.types';
import { calculateDistance } from '../utils/location';
import { mapRideRequest } from '../utils/mappers';
import { useRealtime } from '../hooks/useRealtime';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type RouteParams = { sessionId: string; eventId: string };

interface RideRequestWithRider extends RideRequest {
  riderName: string;
  riderPhoneNumber?: string;
  distance?: number;
}

const formatAge = (date: Date) => {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
};

export default function DDRideQueueScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { sessionId, eventId } = route.params;
  const { user } = useAuth();

  const [requests, setRequests] = useState<RideRequestWithRider[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('dd_user_id', user.id)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      const riderIds = (data || []).map((r) => r.rider_user_id);
      const { data: riders } = riderIds.length
        ? await supabase.from('users').select('id, name, phone_number').in('id', riderIds)
        : { data: [] };

      const enriched: RideRequestWithRider[] = (data || []).map((r) => {
        const rider = riders?.find((u) => u.id === r.rider_user_id);
        return {
          ...mapRideRequest(r),
          riderName: rider?.name ?? 'Unknown',
          riderPhoneNumber: rider?.phone_number ?? undefined,
        };
      });

      enriched.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) return a.distance - b.distance;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      setRequests(enriched);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, eventId]);

  useEffect(() => { fetchRequests(); }, [eventId]);

  useRealtime(
    'ride_requests',
    () => { fetchRequests(); },
    { filter: `event_id=eq.${eventId}` },
    [eventId]
  );

  const updateStatus = async (id: string, status: string, extraFields?: Record<string, string>) => {
    const { error } = await supabase
      .from('ride_requests')
      .update({ status, ...extraFields })
      .eq('id', id);
    if (error) throw error;
    fetchRequests();
  };

  const handleAccept = (req: RideRequestWithRider) => {
    Alert.alert('Accept Ride', `Accept ${req.riderName}'s request?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: () => updateStatus(req.id, 'accepted', { accepted_at: new Date().toISOString() }),
      },
    ]);
  };

  const handlePickUp = (req: RideRequestWithRider) => {
    updateStatus(req.id, 'picked_up', { picked_up_at: new Date().toISOString() });
  };

  const handleComplete = (req: RideRequestWithRider) => {
    Alert.alert('Complete Ride', `Mark ${req.riderName} as dropped off?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Complete',
        onPress: () => updateStatus(req.id, 'completed', { completed_at: new Date().toISOString() }),
      },
    ]);
  };

  const handleCall = async (phone: string | undefined) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\D/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  if (loading) return <LoadingScreen message="Loading requests…" />;

  const pending   = requests.filter((r) => r.status === 'pending');
  const accepted  = requests.filter((r) => r.status === 'accepted');
  const active    = requests.filter((r) => r.status === 'picked_up');
  const total     = requests.length;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchRequests(); }}
          tintColor={colors.brand.primary}
        />
      }
    >
      <View style={styles.countRow}>
        <Text style={styles.countText}>{total} active {total === 1 ? 'request' : 'requests'}</Text>
        <View style={styles.realtimeDot} />
      </View>

      {/* Active / Picked Up */}
      {active.length > 0 && (
        <QueueSection title="Current Ride" accent={colors.brand.primary}>
          {active.map((r) => (
            <RideCard
              key={r.id}
              req={r}
              onCall={() => handleCall(r.riderPhoneNumber)}
              primaryLabel="Mark Dropped Off"
              onPrimary={() => handleComplete(r)}
              accentColor={colors.brand.primary}
              badge={{ icon: 'car', label: 'EN ROUTE', color: colors.brand.primary }}
            />
          ))}
        </QueueSection>
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <QueueSection title="Accepted" accent={colors.ui.success}>
          {accepted.map((r) => (
            <RideCard
              key={r.id}
              req={r}
              onCall={() => handleCall(r.riderPhoneNumber)}
              primaryLabel="Mark Picked Up"
              onPrimary={() => handlePickUp(r)}
              accentColor={colors.ui.success}
              badge={{ icon: 'checkmark-circle', label: 'ACCEPTED', color: colors.ui.success }}
            />
          ))}
        </QueueSection>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <QueueSection title="Pending Requests" accent={colors.ui.warning}>
          {pending.map((r) => (
            <RideCard
              key={r.id}
              req={r}
              onCall={() => handleCall(r.riderPhoneNumber)}
              primaryLabel="Accept Ride"
              onPrimary={() => handleAccept(r)}
              accentColor={colors.ui.warning}
              badge={{ icon: 'time-outline', label: 'PENDING', color: colors.ui.warning }}
            />
          ))}
        </QueueSection>
      )}

      {total === 0 && (
        <EmptyState
          icon="car-outline"
          title="No Ride Requests"
          subtitle="Requests will appear here when members need a ride."
        />
      )}
    </ScrollView>
  );
}

function QueueSection({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <SectionHeader title={title} />
      {children}
    </View>
  );
}

function RideCard({
  req, onCall, primaryLabel, onPrimary, accentColor,
  badge,
}: {
  req: RideRequestWithRider;
  onCall: () => void;
  primaryLabel: string;
  onPrimary: () => void;
  accentColor: string;
  badge: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string };
}) {
  return (
    <Card style={[styles.rideCard, { borderLeftColor: accentColor }]} elevated>
      <View style={styles.badgeRow}>
        <Ionicons name={badge.icon} size={12} color={badge.color} />
        <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        <Text style={styles.ageText}>{formatAge(req.createdAt)}</Text>
      </View>

      <View style={styles.riderRow}>
        <Avatar name={req.riderName} size={40} />
        <View style={styles.riderInfo}>
          <Text style={styles.riderName}>{req.riderName}</Text>
          {req.distance !== undefined ? (
            <Text style={styles.distText}>{req.distance.toFixed(1)} mi away</Text>
          ) : null}
        </View>
      </View>

      <View style={styles.pickupBlock}>
        <Ionicons name="location-outline" size={13} color={colors.text.tertiary} />
        <Text style={styles.pickupText} numberOfLines={2}>{req.pickupLocationText}</Text>
      </View>

      <View style={styles.actions}>
        {req.riderPhoneNumber ? (
          <Button
            variant="secondary"
            leftIcon={<Ionicons name="call-outline" size={16} color={colors.text.primary} />}
            label="Call"
            onPress={onCall}
            style={styles.callBtn}
          />
        ) : null}
        <Button
          label={primaryLabel}
          onPress={onPrimary}
          style={styles.mainBtn}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  countText: { ...typography.callout, color: colors.text.secondary },
  realtimeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.ui.success,
  },
  section: { marginBottom: spacing.xl },
  rideCard: { marginBottom: spacing.md, borderLeftWidth: 3 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  badgeText: { ...typography.label, flex: 1 },
  ageText: { ...typography.caption, color: colors.text.tertiary },
  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  riderInfo: { flex: 1 },
  riderName: { ...typography.bodyBold, color: colors.text.primary },
  distText: { ...typography.caption, color: colors.text.tertiary },
  pickupBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.bg.muted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  pickupText: { ...typography.callout, color: colors.text.secondary, flex: 1, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: spacing.sm },
  callBtn: { width: 90 },
  mainBtn: { flex: 1 },
});
