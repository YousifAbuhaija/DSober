import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types/database.types';
import { updateEventStatusesToActive, getEventStatusDisplay, getEventStatusColor } from '../utils/eventStatus';
import { theme } from '../theme/colors';

type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
};

type NavigationProp = StackNavigationProp<EventsStackParamList, 'EventsList'>;

export default function EventsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchEvents = async () => {
    console.log('fetchEvents called, user.groupId:', user?.groupId);
    
    if (!user?.groupId) {
      console.log('No groupId, skipping fetch');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // First, auto-update any upcoming events that should now be active
      await updateEventStatusesToActive(user.groupId);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', user.groupId)
        .order('date_time', { ascending: true });

      if (error) throw error;

      console.log('Fetched events:', data?.length || 0);

      // Map snake_case to camelCase
      const mappedEvents: Event[] = (data || []).map((event) => ({
        id: event.id,
        groupId: event.group_id,
        name: event.name,
        description: event.description,
        dateTime: new Date(event.date_time),
        locationText: event.location_text,
        status: event.status,
        createdByUserId: event.created_by_user_id,
        createdAt: new Date(event.created_at),
      }));

      console.log('Mapped events with IDs:', mappedEvents.map(e => e.id));
      setEvents(mappedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [user?.groupId]);

  // Refresh events and user data when screen comes into focus
  // Fetch events when screen comes into focus
  // Note: We don't need to call refreshUser() here because AuthContext
  // has a real-time subscription that automatically updates user data
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [user?.groupId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchEvents();
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return theme.colors.primary.main;
      case 'active':
        return theme.colors.functional.success;
      case 'completed':
        return theme.colors.text.tertiary;
      default:
        return theme.colors.text.tertiary;
    }
  };

  const renderEventCard = ({ item }: { item: Event }) => (
    <TouchableOpacity
      style={styles.eventCard}
      onPress={() => {
        if (!item.id) {
          console.error('Event has no ID:', item);
          return;
        }
        console.log('Navigating to event:', item.id);
        navigation.navigate('EventDetail', { eventId: item.id });
      }}
    >
      <View style={styles.eventHeader}>
        <Text style={styles.eventName}>{item.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      <Text style={styles.eventDateTime}>📅 {formatDateTime(item.dateTime)}</Text>
      <Text style={styles.eventLocation}>📍 {item.locationText}</Text>
      {item.description && (
        <Text style={styles.eventDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No events yet</Text>
      {user?.role === 'admin' && (
        <Text style={styles.emptySubtext}>Tap the + button to create an event</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        renderItem={renderEventCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={events.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
      {user?.role === 'admin' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreateEvent')}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  eventCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.colors.text.onPrimary,
  },
  eventDateTime: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  eventLocation: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    lineHeight: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.text.secondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary.main,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: theme.colors.text.onPrimary,
    fontWeight: '300',
  },
});
