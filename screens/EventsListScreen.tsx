import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types/database.types';
import { updateEventStatusesToActive } from '../utils/eventStatus';
import { mapEvent } from '../utils/mappers';
import { useAsync } from '../hooks/useAsync';
import Card from '../components/ui/Card';
import StatusPill from '../components/ui/StatusPill';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii, shadow } from '../theme';

type NavigationProp = StackNavigationProp<any>;

const formatDate = (date: Date) =>
  date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const formatTime = (date: Date) =>
  date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export default function EventsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const fetchEvents = useCallback(async (): Promise<Event[]> => {
    if (!user?.groupId) return [];
    await updateEventStatusesToActive(user.groupId);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('group_id', user.groupId)
      .order('date_time', { ascending: true });
    if (error) throw error;
    return (data || []).map(mapEvent);
  }, [user?.groupId]);

  const { data: events, loading, refetch } = useAsync(fetchEvents, [user?.groupId]);

  useFocusEffect(useCallback(() => { refetch(); }, [user?.groupId]));

  if (loading && !events) return <LoadingScreen message="Loading events…" />;

  const eventList = events ?? [];

  return (
    <View style={styles.container}>
      <FlatList
        data={eventList}
        renderItem={({ item }) => <EventCard event={item} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />}
        keyExtractor={(item) => item.id}
        contentContainerStyle={eventList.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No events yet"
            subtitle={user?.role === 'admin' ? 'Tap the + button to create your first event.' : 'Your chapter hasn\'t posted any events yet.'}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={loading && !!events}
            onRefresh={refetch}
            tintColor={colors.brand.primary}
          />
        }
      />

      {user?.role === 'admin' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateEvent')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const isCompleted = event.status === 'completed';

  return (
    <Card style={[styles.card, isCompleted && styles.cardDimmed]} onPress={onPress} elevated>
      <View style={styles.cardHeader}>
        <Text style={[styles.eventName, isCompleted && styles.textDimmed]} numberOfLines={1}>
          {event.name}
        </Text>
        <StatusPill status={event.status as any} />
      </View>

      <View style={styles.metaRow}>
        <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
        <Text style={styles.metaText}>{formatDate(event.dateTime)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Ionicons name="time-outline" size={14} color={colors.text.tertiary} />
        <Text style={styles.metaText}>{formatTime(event.dateTime)}</Text>
      </View>

      {event.locationText ? (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color={colors.text.tertiary} />
          <Text style={styles.metaText} numberOfLines={1}>{event.locationText}</Text>
        </View>
      ) : null}

      {event.description ? (
        <Text style={styles.description} numberOfLines={2}>{event.description}</Text>
      ) : null}

      <View style={styles.chevronRow}>
        <Text style={styles.viewDetail}>View details</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.brand.primary} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  list: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  emptyList: { flex: 1, padding: spacing.xl },
  card: { marginBottom: spacing.md },
  cardDimmed: { opacity: 0.55 },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  eventName: {
    ...typography.bodyBold,
    color: colors.text.primary,
    flex: 1,
  },
  textDimmed: { color: colors.text.tertiary },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  metaText: { ...typography.caption, color: colors.text.tertiary },
  metaDot: { ...typography.caption, color: colors.border.default },
  description: {
    ...typography.callout,
    color: colors.text.secondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  chevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  viewDetail: { ...typography.caption, color: colors.brand.primary, fontWeight: '600' },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.lg,
  },
});
