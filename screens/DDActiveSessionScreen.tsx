import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DDSession, Event } from '../types/database.types';

type DDActiveSessionRouteParams = {
  eventId: string;
};

export default function DDActiveSessionScreen() {
  const navigation = useNavigation<StackNavigationProp<any>>();
  const route = useRoute<RouteProp<{ params: DDActiveSessionRouteParams }, 'params'>>();
  const { user } = useAuth();
  const { eventId } = route.params || {};

  const [session, setSession] = useState<DDSession | null>(null);
  const [event, setEvent] = useState<Event | null>(null);
  const [elapsedTime, setElapsedTime] = useState<string>('00:00:00');
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);

  useEffect(() => {
    if (!eventId) {
      Alert.alert('Error', 'Event ID is missing');
      navigation.goBack();
      return;
    }
    fetchSession();
  }, [eventId]);

  useEffect(() => {
    if (!session || !session.isActive) return;

    // Update elapsed time every second
    const interval = setInterval(() => {
      updateElapsedTime();
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const fetchSession = async () => {
    try {
      setLoading(true);

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      // Fetch active DD session
      const { data: sessionData, error: sessionError } = await supabase
        .from('dd_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('event_id', eventId)
        .eq('is_active', true)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      if (sessionError || !sessionData) {
        throw new Error('No active DD session found');
      }

      const mappedSession: DDSession = {
        id: sessionData.id,
        userId: sessionData.user_id,
        eventId: sessionData.event_id,
        startedAt: new Date(sessionData.started_at),
        endedAt: sessionData.ended_at ? new Date(sessionData.ended_at) : undefined,
        isActive: sessionData.is_active,
      };

      setSession(mappedSession);

      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError || !eventData) {
        throw new Error('Event not found');
      }

      const mappedEvent: Event = {
        id: eventData.id,
        groupId: eventData.group_id,
        name: eventData.name,
        description: eventData.description,
        dateTime: new Date(eventData.date_time),
        locationText: eventData.location_text,
        status: eventData.status,
        createdByUserId: eventData.created_by_user_id,
        createdAt: new Date(eventData.created_at),
      };

      setEvent(mappedEvent);
    } catch (error: any) {
      console.error('Error fetching session:', error);
      Alert.alert('Error', error.message || 'Failed to load DD session');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateElapsedTime = () => {
    if (!session) return;

    const now = new Date();
    const start = session.startedAt;
    const diffMs = now.getTime() - start.getTime();

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

    const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    setElapsedTime(formatted);
  };

  const endSession = async () => {
    if (!session) return;

    Alert.alert(
      'End DD Session',
      'Are you sure you want to end your DD session?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: async () => {
            try {
              setEnding(true);

              const { error } = await supabase
                .from('dd_sessions')
                .update({
                  ended_at: new Date().toISOString(),
                  is_active: false,
                })
                .eq('id', session.id);

              if (error) throw error;

              Alert.alert('Success', 'DD session ended successfully');
              navigation.navigate('EventDetail', { eventId });
            } catch (error: any) {
              console.error('Error ending session:', error);
              Alert.alert('Error', 'Failed to end DD session');
            } finally {
              setEnding(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading session...</Text>
      </View>
    );
  }

  if (!session || !event) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Active Status Badge */}
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeText}>ACTIVE DD SESSION</Text>
        </View>

        {/* Event Info */}
        <View style={styles.eventCard}>
          <Text style={styles.eventLabel}>Event</Text>
          <Text style={styles.eventName}>{event.name}</Text>
          <View style={styles.eventDetailRow}>
            <Text style={styles.eventIcon}>📍</Text>
            <Text style={styles.eventDetail}>{event.locationText}</Text>
          </View>
        </View>

        {/* Timer */}
        <View style={styles.timerCard}>
          <Text style={styles.timerLabel}>Session Duration</Text>
          <Text style={styles.timerValue}>{elapsedTime}</Text>
          <Text style={styles.timerSubtext}>
            Started at {session.startedAt.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>ℹ️</Text>
          <Text style={styles.infoText}>
            You are now visible to members looking for a DD. Stay safe and drive responsibly!
          </Text>
        </View>

        {/* View Ride Queue Button */}
        <TouchableOpacity
          style={styles.rideQueueButton}
          onPress={() => navigation.navigate('DDRideQueue', { sessionId: session.id, eventId })}
        >
          <Text style={styles.rideQueueButtonIcon}>🚗</Text>
          <Text style={styles.rideQueueButtonText}>View Ride Queue</Text>
        </TouchableOpacity>

        {/* End Session Button */}
        <TouchableOpacity
          style={styles.endButton}
          onPress={endSession}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.endButtonText}>End DD Session</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5E9',
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 24,
    alignSelf: 'center',
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginRight: 8,
  },
  activeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2E7D32',
    letterSpacing: 1,
  },
  eventCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  eventDetail: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  timerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  timerValue: {
    fontSize: 56,
    fontWeight: '700',
    color: '#007AFF',
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  timerSubtext: {
    fontSize: 14,
    color: '#8E8E93',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  endButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  endButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  rideQueueButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginBottom: 16,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  rideQueueButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  rideQueueButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
