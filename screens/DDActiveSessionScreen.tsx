import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DDSession, Event } from '../types/database.types';
import { mapDDSession, mapEvent } from '../utils/mappers';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type RouteParams = { eventId: string };

const padTwo = (n: number) => String(n).padStart(2, '0');

const formatElapsed = (startedAt: Date) => {
  const diffMs = Date.now() - startedAt.getTime();
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  const s = Math.floor((diffMs % 60_000) / 1_000);
  return `${padTwo(h)}:${padTwo(m)}:${padTwo(s)}`;
};

export default function DDActiveSessionScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const { user } = useAuth();
  const { eventId } = route.params ?? {};

  const [session, setSession] = useState<DDSession | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [elapsed, setElapsed] = useState('00:00:00');
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!eventId) { navigation.goBack(); return; }
    (async () => {
      try {
        const { data: sd } = await supabase
          .from('dd_sessions')
          .select('*')
          .eq('user_id', user?.id)
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();
        if (!sd) { navigation.goBack(); return; }
        setSession(mapDDSession(sd));

        const { data: ed } = await supabase.from('events').select('*').eq('id', eventId).single();
        if (ed) setEvent(mapEvent(ed));
      } finally {
        setLoading(false);
      }
    })();
  }, [eventId]);

  useEffect(() => {
    if (!session?.isActive) return;
    const interval = setInterval(() => setElapsed(formatElapsed(session.startedAt)), 1000);
    setElapsed(formatElapsed(session.startedAt));
    return () => clearInterval(interval);
  }, [session?.startedAt, session?.isActive]);

  const endSession = useCallback(() => {
    if (!session) return;
    Alert.alert('End DD Session', 'Are you sure you want to end your session?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End Session',
        style: 'destructive',
        onPress: async () => {
          setEnding(true);
          try {
            await supabase.from('dd_sessions').update({
              ended_at: new Date().toISOString(),
              is_active: false,
            }).eq('id', session.id);
            navigation.navigate('EventDetail', { eventId });
          } finally {
            setEnding(false);
          }
        },
      },
    ]);
  }, [session, eventId]);

  if (loading) return <LoadingScreen message="Loading session…" />;
  if (!session || !event) return null;

  const startedAt = session.startedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Active badge */}
      <View style={styles.activeBadge}>
        <View style={styles.activeDot} />
        <Text style={styles.activeBadgeText}>ACTIVE DD SESSION</Text>
      </View>

      {/* Event card */}
      <Card elevated style={styles.eventCard}>
        <Text style={styles.sectionLabel}>EVENT</Text>
        <Text style={styles.eventName}>{event.name}</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.locationText}>{event.locationText}</Text>
        </View>
      </Card>

      {/* Timer */}
      <Card elevated style={styles.timerCard}>
        <Text style={styles.timerLabel}>SESSION DURATION</Text>
        <Text style={styles.timerValue}>{elapsed}</Text>
        <Text style={styles.timerSub}>Started at {startedAt}</Text>
      </Card>

      {/* Info */}
      <Card style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Ionicons name="information-circle-outline" size={18} color={colors.ui.info} />
          <Text style={styles.infoText}>
            You are visible to members looking for a DD. Stay safe and drive responsibly.
          </Text>
        </View>
      </Card>

      {/* Actions */}
      <View style={styles.actions}>
        <Button
          label="View Ride Queue"
          leftIcon={<Ionicons name="list-outline" size={18} color="#fff" />}
          onPress={() => navigation.navigate('DDRideQueue', { sessionId: session.id, eventId })}
          fullWidth
          size="lg"
          style={styles.queueBtn}
        />
        <Button
          variant="danger"
          label="End DD Session"
          onPress={endSession}
          loading={ending}
          fullWidth
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: '#0A2010',
    borderWidth: 1,
    borderColor: colors.ui.success,
    marginBottom: spacing.xl,
  },
  activeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.ui.success },
  activeBadgeText: { ...typography.label, color: colors.ui.success },
  eventCard: { marginBottom: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.sm },
  eventName: { ...typography.title2, color: colors.text.primary, marginBottom: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  locationText: { ...typography.callout, color: colors.text.secondary },
  timerCard: { alignItems: 'center', paddingVertical: spacing['2xl'], marginBottom: spacing.xl },
  timerLabel: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.md },
  timerValue: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.brand.primary,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.sm,
  },
  timerSub: { ...typography.callout, color: colors.text.tertiary },
  infoCard: { marginBottom: spacing.xl },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  infoText: { ...typography.callout, color: colors.text.secondary, flex: 1, lineHeight: 22 },
  actions: { gap: spacing.md },
  queueBtn: {},
});
