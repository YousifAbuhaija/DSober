import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  RefreshControl,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest } from '../types/database.types';
import { mapRideRequest } from '../utils/mappers';
import { useRealtime } from '../hooks/useRealtime';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography } from '../theme';

type RouteParams = { sessionId: string; eventId: string };

interface RideRequestWithRider extends RideRequest {
  riderName: string;
  riderPhoneNumber?: string;
  distance?: number;
}

const formatAge = (date: Date) => {
  const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  return `${Math.floor(diffMins / 60)}h ago`;
};

const QUEUE_STATUS: Record<string, { color: string; label: string }> = {
  pending:   { color: colors.ui.warning,  label: 'PENDING' },
  accepted:  { color: colors.ui.success,  label: 'ACCEPTED' },
  picked_up: { color: colors.brand.primary, label: 'EN ROUTE' },
};

export default function DDRideQueueScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { eventId } = route.params;
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
        return { ...mapRideRequest(r), riderName: rider?.name ?? 'Unknown', riderPhoneNumber: rider?.phone_number ?? undefined };
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

  const updateStatus = async (id: string, status: string, extra?: Record<string, string>) => {
    const { error } = await supabase.from('ride_requests').update({ status, ...extra }).eq('id', id);
    if (error) throw error;
    fetchRequests();
  };

  const handleAccept = (req: RideRequestWithRider) => {
    Alert.alert('Accept Ride', `Accept ${req.riderName}'s request?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Accept', onPress: () => updateStatus(req.id, 'accepted', { accepted_at: new Date().toISOString() }) },
    ]);
  };

  const handlePickUp = (req: RideRequestWithRider) => {
    updateStatus(req.id, 'picked_up', { picked_up_at: new Date().toISOString() });
  };

  const handleComplete = (req: RideRequestWithRider) => {
    Alert.alert('Complete Ride', `Mark ${req.riderName} as dropped off?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: () => updateStatus(req.id, 'completed', { completed_at: new Date().toISOString() }) },
    ]);
  };

  const handleCall = async (phone: string | undefined) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\D/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  if (loading) return <LoadingScreen message="Loading requests…" />;

  const pending  = requests.filter((r) => r.status === 'pending');
  const accepted = requests.filter((r) => r.status === 'accepted');
  const active   = requests.filter((r) => r.status === 'picked_up');
  const total    = requests.length;

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
      {/* Live indicator */}
      <View style={styles.liveRow}>
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
        <Text style={styles.countText}>
          {total === 0 ? 'No active requests' : `${total} active ${total === 1 ? 'request' : 'requests'}`}
        </Text>
      </View>

      {total === 0 && (
        <EmptyState
          icon="car-outline"
          title="No Ride Requests"
          subtitle="Requests will appear here when members need a ride."
        />
      )}

      {/* Current (picked up) */}
      {active.length > 0 && (
        <QueueBlock
          title="CURRENT RIDE"
          requests={active}
          onCall={handleCall}
          primaryLabel="Mark Dropped Off"
          onPrimary={handleComplete}
        />
      )}

      {/* Accepted */}
      {accepted.length > 0 && (
        <QueueBlock
          title="ACCEPTED"
          requests={accepted}
          onCall={handleCall}
          primaryLabel="Mark Picked Up"
          onPrimary={handlePickUp}
        />
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <QueueBlock
          title="PENDING REQUESTS"
          requests={pending}
          onCall={handleCall}
          primaryLabel="Accept Ride"
          onPrimary={handleAccept}
        />
      )}
    </ScrollView>
  );
}

function QueueBlock({
  title, requests, onCall, primaryLabel, onPrimary,
}: {
  title: string;
  requests: RideRequestWithRider[];
  onCall: (phone: string | undefined) => void;
  primaryLabel: string;
  onPrimary: (req: RideRequestWithRider) => void;
}) {
  return (
    <View style={styles.queueBlock}>
      <SectionHeader title={title} />
      <View style={styles.blockSurface}>
        {requests.map((req, index) => (
          <QueueRow
            key={req.id}
            req={req}
            isLast={index === requests.length - 1}
            primaryLabel={primaryLabel}
            onPrimary={() => onPrimary(req)}
            onCall={() => onCall(req.riderPhoneNumber)}
          />
        ))}
      </View>
    </View>
  );
}

function QueueRow({
  req, isLast, primaryLabel, onPrimary, onCall,
}: {
  req: RideRequestWithRider;
  isLast: boolean;
  primaryLabel: string;
  onPrimary: () => void;
  onCall: () => void;
}) {
  const status = QUEUE_STATUS[req.status] ?? QUEUE_STATUS.pending;

  return (
    <View style={[styles.queueRow, !isLast && styles.queueRowBorder]}>
      {/* 3px left color bar */}
      <View style={[styles.colorBar, { backgroundColor: status.color }]} />

      <View style={styles.queueRowContent}>
        {/* Status badge + age */}
        <View style={styles.badgeRow}>
          <View style={[styles.statusDot, { backgroundColor: status.color }]} />
          <Text style={[styles.statusLabel, { color: status.color }]}>{status.label}</Text>
          <Text style={styles.ageText}>{formatAge(req.createdAt)}</Text>
        </View>

        {/* Rider info */}
        <View style={styles.riderRow}>
          <Avatar name={req.riderName} size={36} />
          <View style={styles.riderInfo}>
            <Text style={styles.riderName}>{req.riderName}</Text>
            {req.distance !== undefined && (
              <Text style={styles.distText}>{req.distance.toFixed(1)} mi away</Text>
            )}
          </View>
        </View>

        {/* Pickup location */}
        <View style={styles.pickupRow}>
          <Ionicons name="location-outline" size={12} color={colors.text.tertiary} />
          <Text style={styles.pickupText} numberOfLines={2} ellipsizeMode="tail">
            {req.pickupLocationText}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {req.riderPhoneNumber ? (
            <TouchableOpacity style={styles.callBtn} onPress={onCall} activeOpacity={0.7}>
              <Ionicons name="call-outline" size={16} color={colors.text.primary} />
              <Text style={styles.callBtnText}>Call</Text>
            </TouchableOpacity>
          ) : null}
          <Button label={primaryLabel} onPress={onPrimary} style={styles.primaryBtn} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: 60 },

  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.ui.success,
  },
  liveText: {
    ...typography.label,
    color: colors.ui.success,
    letterSpacing: 1,
  },
  countText: {
    ...typography.caption,
    color: colors.text.tertiary,
    flex: 1,
  },

  queueBlock: { marginBottom: spacing.xl },

  blockSurface: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },

  queueRow: {
    flexDirection: 'row',
    minHeight: 64,
  },
  queueRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },

  colorBar: {
    width: 3,
    alignSelf: 'stretch',
  },

  queueRowContent: {
    flex: 1,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },

  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusLabel: {
    ...typography.label,
    flex: 1,
    letterSpacing: 0.5,
  },
  ageText: { ...typography.caption, color: colors.text.tertiary },

  riderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  riderInfo: { flex: 1 },
  riderName: { ...typography.bodyBold, color: colors.text.primary },
  distText: { ...typography.caption, color: colors.text.tertiary, marginTop: 2 },

  pickupRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.bg.muted,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pickupText: { ...typography.caption, color: colors.text.secondary, flex: 1, lineHeight: 18 },

  actions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  callBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bg.elevated,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 40,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  callBtnText: { ...typography.caption, color: colors.text.primary, fontWeight: '600' },
  primaryBtn: { flex: 1 },
});
