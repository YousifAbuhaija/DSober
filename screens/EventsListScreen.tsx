import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
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
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography } from '../theme';

type NavigationProp = StackNavigationProp<any>;

const STATUS_CONFIG = {
  active:    { icon: 'flash' as const,        color: colors.ui.success,   label: 'Active' },
  upcoming:  { icon: 'calendar-outline' as const, color: colors.brand.primary, label: 'Upcoming' },
  completed: { icon: 'checkmark-circle-outline' as const, color: colors.text.tertiary, label: 'Completed' },
};

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

  const sections = [
    { title: 'Active',    data: eventList.filter(e => e.status === 'active') },
    { title: 'Upcoming',  data: eventList.filter(e => e.status === 'upcoming') },
    { title: 'Completed', data: eventList.filter(e => e.status === 'completed') },
  ].filter(s => s.data.length > 0);

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index, section }) => {
          const isLast = index === section.data.length - 1;
          return <EventRow event={item} isLast={isLast} onPress={() => navigation.navigate('EventDetail', { eventId: item.id })} />;
        }}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionLabel}>
            <Text style={styles.sectionLabelText}>{section.title.toUpperCase()}</Text>
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No events yet"
            subtitle={user?.role === 'admin' ? 'Tap + to create your first event.' : 'Your chapter hasn\'t posted any events yet.'}
          />
        }
        contentContainerStyle={eventList.length === 0 ? styles.emptyList : styles.list}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
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

function EventRow({ event, isLast, onPress }: { event: Event; isLast: boolean; onPress: () => void }) {
  const cfg = STATUS_CONFIG[event.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.upcoming;
  const isCompleted = event.status === 'completed';

  return (
    <TouchableOpacity
      style={[styles.row, isCompleted && styles.rowDimmed]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconCircle, { backgroundColor: `${cfg.color}18` }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
      </View>

      <View style={styles.rowContent}>
        <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
        <Text style={styles.metaText}>
          {formatDate(event.dateTime)}  ·  {formatTime(event.dateTime)}
        </Text>
        {event.locationText ? (
          <Text style={styles.metaText} numberOfLines={1}>{event.locationText}</Text>
        ) : null}
      </View>

      <View style={styles.rowRight}>
        <View style={[styles.statusDot, { backgroundColor: cfg.color }]} />
        <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
      </View>

      {!isLast && <View style={styles.divider} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  list: { paddingBottom: 80 },
  emptyList: { flex: 1 },

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

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    backgroundColor: colors.bg.surface,
  },
  rowDimmed: { opacity: 0.5 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  rowRight: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  eventName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 3,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metaText: {
    fontSize: 13,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  divider: {
    position: 'absolute',
    bottom: 0,
    left: spacing.base + 44 + spacing.md,
    right: 0,
    height: 1,
    backgroundColor: colors.border.subtle,
  },

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
    shadowColor: colors.brand.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
});
