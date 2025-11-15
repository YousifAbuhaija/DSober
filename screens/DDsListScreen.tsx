import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Image,
  Linking,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event, DDSession, User } from '../types/database.types';
import { calculateDistance, getCurrentLocation } from '../utils/location';
import { updateEventStatusesToActive } from '../utils/eventStatus';

type DDsStackParamList = {
  DDsList: undefined;
  DDDetail: { ddUserId: string; eventId?: string };
};

type NavigationProp = StackNavigationProp<DDsStackParamList, 'DDsList'>;

interface ActiveDD {
  userId: string;
  name: string;
  carMake?: string;
  carModel?: string;
  carPlate?: string;
  phoneNumber?: string;
  distance?: number;
  sessionId: string;
  profilePhotoUrl?: string;
}

export default function DDsListScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [activeDDs, setActiveDDs] = useState<ActiveDD[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Fetch active events for the user's group
  const fetchEvents = async () => {
    if (!user?.groupId) return;

    try {
      // First, auto-update any upcoming events that should now be active
      await updateEventStatusesToActive(user.groupId);

      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', user.groupId)
        .in('status', ['upcoming', 'active'])
        .order('date_time', { ascending: true });

      if (error) throw error;

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

      setEvents(mappedEvents);

      // Auto-select first event if none selected
      if (mappedEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(mappedEvents[0].id);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  // Request location permission and get current location
  const requestLocation = async () => {
    try {
      const location = await getCurrentLocation();
      setUserLocation(location);
      setLocationError(null);
    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Location permission denied. Distance will not be shown.');
    }
  };

  // Fetch active DDs for the selected event
  const fetchActiveDDs = async () => {
    if (!selectedEventId) {
      setActiveDDs([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Query DDSession records where isActive=true for selected event
      const { data: sessions, error: sessionsError } = await supabase
        .from('dd_sessions')
        .select('id, user_id, is_active')
        .eq('event_id', selectedEventId)
        .eq('is_active', true);

      if (sessionsError) throw sessionsError;

      if (!sessions || sessions.length === 0) {
        setActiveDDs([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get user IDs from sessions
      const userIds = sessions.map((s) => s.user_id);

      // Fetch user details for all active DDs including profile photos and phone numbers
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, car_make, car_model, car_plate, phone_number, profile_photo_url')
        .in('id', userIds);

      if (usersError) throw usersError;

      // Map sessions to ActiveDD objects with distance calculation
      const dds: ActiveDD[] = (users || []).map((u) => {
        const session = sessions.find((s) => s.user_id === u.id);
        
        // Calculate distance if user location is available
        // Note: For MVP, we're using a placeholder location since we don't store DD location
        // In a real implementation, DDs would update their location periodically
        let distance: number | undefined;
        if (userLocation) {
          // Using event location as placeholder - in production, use actual DD location
          distance = 0; // Placeholder - would calculate from DD's actual location
        }

        return {
          userId: u.id,
          name: u.name,
          carMake: u.car_make,
          carModel: u.car_model,
          carPlate: u.car_plate,
          phoneNumber: u.phone_number,
          distance,
          sessionId: session?.id || '',
          profilePhotoUrl: u.profile_photo_url,
        };
      });

      setActiveDDs(dds);
    } catch (error) {
      console.error('Error fetching active DDs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    const initialize = async () => {
      await requestLocation();
      await fetchEvents();
    };
    initialize();
  }, [user?.groupId]);

  // Fetch active DDs when event selection changes
  useEffect(() => {
    if (selectedEventId) {
      setLoading(true);
      fetchActiveDDs();
    }
  }, [selectedEventId, userLocation]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refreshUser();
      fetchActiveDDs();
    }, [selectedEventId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchActiveDDs();
  };

  const handleDDPress = (ddUserId: string) => {
    navigation.navigate('DDDetail', { ddUserId, eventId: selectedEventId });
  };

  const handleCallDriver = async (phoneNumber: string | undefined, driverName: string) => {
    if (!phoneNumber) {
      Alert.alert(
        'Phone Number Not Available',
        `${driverName} has not provided a phone number.`,
        [{ text: 'OK' }]
      );
      return;
    }

    // Format phone number for tel: URL (remove non-numeric characters)
    const formattedNumber = phoneNumber.replace(/[^0-9]/g, '');
    const phoneUrl = `tel:${formattedNumber}`;

    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert(
          'Cannot Make Call',
          'Your device does not support phone calls.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error opening phone dialer:', error);
      Alert.alert(
        'Error',
        'Failed to open phone dialer. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const renderDDCard = ({ item }: { item: ActiveDD }) => (
    <View style={styles.ddCard}>
      <TouchableOpacity
        style={styles.ddCardTouchable}
        onPress={() => handleDDPress(item.userId)}
      >
        <View style={styles.ddHeader}>
          {item.profilePhotoUrl ? (
            <Image
              source={{ uri: item.profilePhotoUrl }}
              style={styles.avatar}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.ddInfo}>
            <Text style={styles.ddName}>{item.name}</Text>
            {item.carMake && item.carModel && (
              <Text style={styles.carInfo}>
                🚗 {item.carMake} {item.carModel}
              </Text>
            )}
            {item.carPlate && (
              <Text style={styles.carPlate}>Plate: {item.carPlate}</Text>
            )}
          </View>
          {item.distance !== undefined && (
            <View style={styles.distanceContainer}>
              <Text style={styles.distanceText}>{item.distance.toFixed(1)}</Text>
              <Text style={styles.distanceUnit}>mi</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
      
      {/* Call Button */}
      <TouchableOpacity
        style={[
          styles.callButtonSmall,
          !item.phoneNumber && styles.callButtonSmallDisabled,
        ]}
        onPress={() => handleCallDriver(item.phoneNumber, item.name)}
      >
        <Text style={styles.callButtonSmallIcon}>📞</Text>
        <Text style={styles.callButtonSmallText}>
          {item.phoneNumber ? item.phoneNumber : 'No phone'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No active DDs</Text>
      <Text style={styles.emptySubtext}>
        {selectedEventId
          ? 'No designated drivers are currently active for this event'
          : 'Select an event to see active DDs'}
      </Text>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Event Selector */}
      <View style={styles.selectorContainer}>
        <Text style={styles.selectorLabel}>Select Event:</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.eventScroll}
        >
          {events.length === 0 ? (
            <View style={styles.eventChip}>
              <Text style={styles.eventChipText}>No active events</Text>
            </View>
          ) : (
            events.map((event) => (
              <TouchableOpacity
                key={event.id}
                style={[
                  styles.eventChip,
                  selectedEventId === event.id && styles.eventChipSelected,
                ]}
                onPress={() => setSelectedEventId(event.id)}
              >
                <Text
                  style={[
                    styles.eventChipText,
                    selectedEventId === event.id && styles.eventChipTextSelected,
                  ]}
                >
                  {event.name}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </View>

      {/* Location Error Message */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{locationError}</Text>
        </View>
      )}

      {/* Active DDs List */}
      <FlatList
        data={activeDDs}
        renderItem={renderDDCard}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={activeDDs.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  selectorContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  selectorLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  eventScroll: {
    flexGrow: 0,
  },
  eventChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F2F2F7',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  eventChipSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  eventChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  eventChipTextSelected: {
    color: '#fff',
  },
  errorBanner: {
    backgroundColor: '#FFE5E5',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#FFCCCC',
  },
  errorText: {
    fontSize: 12,
    color: '#D32F2F',
    textAlign: 'center',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  ddCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  ddCardTouchable: {
    padding: 16,
  },
  ddHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
  },
  ddInfo: {
    flex: 1,
  },
  ddName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  carPlate: {
    fontSize: 14,
    color: '#666',
  },
  distanceContainer: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  distanceText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
  },
  distanceUnit: {
    fontSize: 12,
    color: '#8E8E93',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
  },
  callButtonSmall: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  callButtonSmallDisabled: {
    backgroundColor: '#F2F2F7',
  },
  callButtonSmallIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  callButtonSmallText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
