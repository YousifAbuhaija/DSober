import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DDSession, Event, RideRequest, User } from '../types/database.types';
import { mapDDSession, mapEvent, mapRideRequest, mapUser } from '../utils/mappers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type NavigationProp = StackNavigationProp<any>;

interface RidesData {
  activeSession: DDSession | null;
  activeEvent: Event | null;
  pendingCount: number;
  myRequest: RideRequest | null;
  myDD: User | null;
}

const RIDE_STATUS_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  pending:   { icon: 'time-outline',          color: colors.ui.warning, label: 'Waiting for driver' },
  accepted:  { icon: 'checkmark-circle-outline', color: colors.ui.success, label: 'Driver accepted' },
  picked_up: { icon: 'car-outline',           color: colors.ui.info,    label: 'En route' },
};

export default function RidesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const [data, setData] = useState<RidesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      let activeSession: DDSession | null = null;
      let activeEvent: Event | null = null;
      let pendingCount = 0;

      if (user.isDD) {
        const { data: sd } = await supabase
          .from('dd_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sd) {
          activeSession = mapDDSession(sd);
          const { data: ed } = await supabase
            .from('events').select('*').eq('id', sd.event_id).single();
          if (ed) activeEvent = mapEvent(ed);
          const { count } = await supabase
            .from('ride_requests')
            .select('*', { count: 'exact', head: true })
            .eq('dd_user_id', user.id)
            .eq('event_id', sd.event_id)
            .eq('status', 'pending');
          pendingCount = count ?? 0;
        }
      }

      const { data: rd } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_user_id', user.id)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let myRequest: RideRequest | null = rd ? mapRideRequest(rd) : null;
      let myDD: User | null = null;

      if (rd) {
        const { data: dd } = await supabase.from('users').select('*').eq('id', rd.dd_user_id).single();
        if (dd) myDD = mapUser(dd);
      }

      setData({ activeSession, activeEvent, pendingCount, myRequest, myDD });
    } catch {
      // silent — user can pull-to-refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [user?.id]));

  if (loading && !data) return <LoadingScreen message="Loading rides…" />;

  const { activeSession, activeEvent, pendingCount, myRequest, myDD } = data ?? {
    activeSession: null, activeEvent: null, pendingCount: 0, myRequest: null, myDD: null,
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchData(); }}
          tintColor={colors.brand.primary}
        />
      }
    >
      {/* Active ride request (member view) */}
      {myRequest && myDD && (
        <Section title="Your Ride">
          <ActiveRideCard request={myRequest} dd={myDD} onPress={() => navigation.navigate('RideStatus', { eventId: myRequest.eventId })} />
        </Section>
      )}

      {/* DD views */}
      {user?.ddStatus === 'revoked' && (
        <Section>
          <Card style={styles.warningCard}>
            <View style={styles.iconRow}>
              <Ionicons name="warning-outline" size={32} color={colors.ui.warning} />
            </View>
            <Text style={styles.warningTitle}>DD Status Revoked</Text>
            <Text style={styles.warningBody}>
              Your DD status has been revoked. Contact an admin for more information.
            </Text>
          </Card>
        </Section>
      )}

      {user?.isDD && user.ddStatus !== 'revoked' && (
        activeSession && activeEvent ? (
          <Section>
            <View style={styles.activeBadge}>
              <View style={styles.activeDot} />
              <Text style={styles.activeBadgeText}>ACTIVE DD SESSION</Text>
            </View>
            <Card elevated>
              <Text style={styles.eventName}>{activeEvent.name}</Text>
              <View style={styles.metaRow}>
                <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
                <Text style={styles.metaText}>{activeEvent.locationText}</Text>
              </View>
              {pendingCount > 0 && (
                <View style={styles.pendingBadge}>
                  <Ionicons name="notifications" size={14} color={colors.ui.warning} />
                  <Text style={styles.pendingText}>
                    {pendingCount} pending {pendingCount === 1 ? 'request' : 'requests'}
                  </Text>
                </View>
              )}
              <Button
                label="View Ride Queue"
                onPress={() => navigation.navigate('DDRideQueue', { sessionId: activeSession.id, eventId: activeSession.eventId })}
                fullWidth
                style={styles.queueBtn}
              />
            </Card>
          </Section>
        ) : (
          <Section>
            <EmptyState
              icon="car-outline"
              title="No Active Session"
              subtitle="Start a DD session from an event to begin receiving ride requests."
              action={{
                label: 'Go to Events',
                onPress: () => navigation.getParent()?.navigate('Events'),
              }}
            />
          </Section>
        )
      )}

      {/* Non-DD CTA */}
      {!user?.isDD && !myRequest && (
        <Section>
          <Card style={styles.ctaCard} elevated>
            <View style={styles.ctaIconWrap}>
              <Ionicons name="car-outline" size={36} color={colors.brand.primary} />
            </View>
            <Text style={styles.ctaTitle}>Become a Designated Driver</Text>
            <Text style={styles.ctaBody}>
              Help your chapter stay safe by volunteering as a DD during events.
            </Text>
            <Button
              label="Get Started"
              onPress={() => navigation.navigate('DDUpgrade', { screen: 'DriverInfo', params: { mode: 'upgrade' } })}
              fullWidth
              style={styles.ctaBtn}
            />
          </Card>
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

function ActiveRideCard({ request, dd, onPress }: { request: RideRequest; dd: User; onPress: () => void }) {
  const meta = RIDE_STATUS_META[request.status] ?? RIDE_STATUS_META.pending;
  return (
    <Card style={[styles.rideCard, { borderLeftColor: meta.color }]} onPress={onPress} elevated>
      <View style={styles.rideStatusRow}>
        <Ionicons name={meta.icon} size={18} color={meta.color} />
        <Text style={[styles.rideStatus, { color: meta.color }]}>{meta.label}</Text>
        <StatusPill status={request.status as any} />
      </View>
      <View style={styles.driverRow}>
        <Avatar uri={dd.profilePhotoUrl} name={dd.name} size={40} />
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{dd.name}</Text>
          {dd.carMake && dd.carModel ? (
            <Text style={styles.carText}>{dd.carMake} {dd.carModel}</Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </View>
      <View style={styles.pickupRow}>
        <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
        <Text style={styles.pickupText} numberOfLines={1}>{request.pickupLocationText}</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: spacing['3xl'] },
  section: { padding: spacing.xl, paddingBottom: 0 },
  sectionTitle: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.md },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: '#0A2010',
    borderWidth: 1,
    borderColor: colors.ui.success,
    marginBottom: spacing.md,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ui.success },
  activeBadgeText: { ...typography.label, color: colors.ui.success },
  eventName: { ...typography.title3, color: colors.text.primary, marginBottom: spacing.xs },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  metaText: { ...typography.caption, color: colors.text.tertiary },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#1A1200',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.ui.warning,
    marginBottom: spacing.md,
  },
  pendingText: { ...typography.caption, color: colors.ui.warning, fontWeight: '600' },
  queueBtn: {},
  warningCard: { alignItems: 'center', gap: spacing.sm, borderWidth: 1.5, borderColor: colors.ui.warning },
  iconRow: { marginBottom: spacing.xs },
  warningTitle: { ...typography.bodyBold, color: colors.ui.warning, textAlign: 'center' },
  warningBody: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  ctaCard: { alignItems: 'center', borderWidth: 1, borderColor: colors.brand.faint },
  ctaIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.brand.faint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  ctaTitle: { ...typography.title3, color: colors.text.primary, textAlign: 'center', marginBottom: spacing.sm },
  ctaBody: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: spacing.xl },
  ctaBtn: {},
  rideCard: { borderLeftWidth: 3 },
  rideStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  rideStatus: { ...typography.caption, fontWeight: '600', flex: 1 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  driverInfo: { flex: 1 },
  driverName: { ...typography.bodyBold, color: colors.text.primary },
  carText: { ...typography.caption, color: colors.text.tertiary },
  pickupRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  pickupText: { ...typography.caption, color: colors.text.secondary, flex: 1 },
});
