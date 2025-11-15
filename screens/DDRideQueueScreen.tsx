import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { useRoute, RouteProp } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User } from '../types/database.types';
import { calculateDistance } from '../utils/location';

type EventsStackParamList = {
  DDActiveSession: { sessionId: string };
  DDRideQueue: { sessionId: string; eventId: string };
};

type DDRideQueueRouteProp = RouteProp<EventsStackParamList, 'DDRideQueue'>;

interface RideRequestWithRider extends RideRequest {
  riderName: string;
  riderPhoneNumber?: string;
  distance?: number;
}

export default function DDRideQueueScreen() {
  const route = useRoute<DDRideQueueRouteProp>();
  const { sessionId, eventId } = route.params;
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<RideRequestWithRider[]>([]);
  const [acceptedRequests, setAcceptedRequests] = useState<RideRequestWithRider[]>([]);
  const [activeRide, setActiveRide] = useState<RideRequestWithRider | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ddLocation, setDDLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    fetchRideRequests();
    // Set up real-time subscription
    const subscription = supabase
      .channel('ride_requests_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ride_requests',
          filter: `event_id=eq.${eventId}`,
        },
        () => {
          fetchRideRequests();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId]);

  const fetchRideRequests = async () => {
    if (!user) return;

    try {
      // Fetch all ride requests for this DD's active session
      const { data: requestsData, error: requestsError } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('dd_user_id', user.id)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .order('created_at', { ascending: true });

      if (requestsError) throw requestsError;

      if (!requestsData || requestsData.length === 0) {
        setPendingRequests([]);
        setAcceptedRequests([]);
        setActiveRide(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Fetch rider details including phone numbers
      const riderIds = requestsData.map((r) => r.rider_user_id);
      const { data: ridersData, error: ridersError } = await supabase
        .from('users')
        .select('id, name, phone_number')
        .in('id', riderIds);

      if (ridersError) throw ridersError;

      // Map requests with rider names and calculate distances
      const requestsWithRiders: RideRequestWithRider[] = requestsData.map((req) => {
        const rider = ridersData?.find((r) => r.id === req.rider_user_id);
        
        // Calculate distance if both DD and rider locations are available
        let distance: number | undefined;
        if (ddLocation && req.pickup_latitude && req.pickup_longitude) {
          distance = calculateDistance(
            ddLocation.latitude,
            ddLocation.longitude,
            req.pickup_latitude,
            req.pickup_longitude
          );
        }

        return {
          id: req.id,
          ddUserId: req.dd_user_id,
          riderUserId: req.rider_user_id,
          eventId: req.event_id,
          pickupLocationText: req.pickup_location_text,
          pickupLatitude: req.pickup_latitude,
          pickupLongitude: req.pickup_longitude,
          status: req.status,
          createdAt: new Date(req.created_at),
          acceptedAt: req.accepted_at ? new Date(req.accepted_at) : undefined,
          pickedUpAt: req.picked_up_at ? new Date(req.picked_up_at) : undefined,
          completedAt: req.completed_at ? new Date(req.completed_at) : undefined,
          riderName: rider?.name || 'Unknown',
          riderPhoneNumber: rider?.phone_number,
          distance,
        };
      });

      // Separate requests by status
      const pending = requestsWithRiders.filter((r) => r.status === 'pending');
      const accepted = requestsWithRiders.filter((r) => r.status === 'accepted');
      const pickedUp = requestsWithRiders.find((r) => r.status === 'picked_up');

      // Sort pending by distance (closest first) if distances are available
      pending.sort((a, b) => {
        if (a.distance !== undefined && b.distance !== undefined) {
          return a.distance - b.distance;
        }
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      setPendingRequests(pending);
      setAcceptedRequests(accepted);
      setActiveRide(pickedUp || null);
    } catch (err) {
      console.error('Error fetching ride requests:', err);
      Alert.alert('Error', 'Failed to load ride requests. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAcceptRequest = async (requestId: string, riderName: string) => {
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        'Ride Accepted',
        `You've accepted ${riderName}'s ride request. They will be notified.`,
        [{ text: 'OK' }]
      );

      // Refresh the list
      fetchRideRequests();
    } catch (err) {
      console.error('Error accepting ride request:', err);
      Alert.alert('Error', 'Failed to accept ride request. Please try again.');
    }
  };

  const handleMarkPickedUp = async (requestId: string, riderName: string) => {
    try {
      const { error } = await supabase
        .from('ride_requests')
        .update({
          status: 'picked_up',
          picked_up_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      Alert.alert(
        'Rider Picked Up',
        `You've marked ${riderName} as picked up.`,
        [{ text: 'OK' }]
      );

      // Refresh the list
      fetchRideRequests();
    } catch (err) {
      console.error('Error marking ride as picked up:', err);
      Alert.alert('Error', 'Failed to update ride status. Please try again.');
    }
  };

  const handleMarkCompleted = async (requestId: string, riderName: string) => {
    Alert.alert(
      'Complete Ride',
      `Mark ${riderName}'s ride as completed?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Complete',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ride_requests')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', requestId);

              if (error) throw error;

              Alert.alert(
                'Ride Completed',
                `${riderName}'s ride has been marked as completed.`,
                [{ text: 'OK' }]
              );

              // Refresh the list
              fetchRideRequests();
            } catch (err) {
              console.error('Error completing ride:', err);
              Alert.alert('Error', 'Failed to complete ride. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleCallRider = async (riderName: string, phoneNumber?: string) => {
    if (!phoneNumber) {
      Alert.alert(
        'Phone Number Not Available',
        `${riderName} has not provided a phone number.`,
        [{ text: 'OK' }]
      );
      return;
    }

    const digitsOnly = phoneNumber.replace(/\D/g, '');
    const phoneUrl = `tel:${digitsOnly}`;

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
      Alert.alert('Error', 'Failed to open phone dialer. Please try again.');
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchRideRequests();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const renderPendingCard = ({ item }: { item: RideRequestWithRider }) => (
    <View style={styles.requestCard}>
      <View style={styles.requestHeader}>
        <View style={styles.riderInfo}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {item.riderName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{item.riderName}</Text>
            <Text style={styles.requestTime}>{formatTime(item.createdAt)}</Text>
          </View>
        </View>
        {item.distance !== undefined && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
          </View>
        )}
      </View>

      <View style={styles.pickupInfo}>
        <Text style={styles.pickupLabel}>📍 Pickup Location:</Text>
        <Text style={styles.pickupText}>{item.pickupLocationText}</Text>
      </View>

      <View style={styles.actionButtons}>
        {item.riderPhoneNumber && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCallRider(item.riderName, item.riderPhoneNumber)}
          >
            <Text style={styles.callButtonText}>📞 Call</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.acceptButton, item.riderPhoneNumber && styles.acceptButtonFlex]}
          onPress={() => handleAcceptRequest(item.id, item.riderName)}
        >
          <Text style={styles.acceptButtonText}>Accept Ride</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAcceptedCard = ({ item }: { item: RideRequestWithRider }) => (
    <View style={[styles.requestCard, styles.acceptedCard]}>
      <View style={styles.statusBadge}>
        <Text style={styles.statusBadgeText}>✅ ACCEPTED</Text>
      </View>
      <View style={styles.requestHeader}>
        <View style={styles.riderInfo}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarSmallText}>
              {item.riderName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.riderDetails}>
            <Text style={styles.riderName}>{item.riderName}</Text>
            <Text style={styles.requestTime}>
              Accepted {item.acceptedAt ? formatTime(item.acceptedAt) : ''}
            </Text>
          </View>
        </View>
        {item.distance !== undefined && (
          <View style={styles.distanceBadge}>
            <Text style={styles.distanceText}>{item.distance.toFixed(1)} mi</Text>
          </View>
        )}
      </View>

      <View style={styles.pickupInfo}>
        <Text style={styles.pickupLabel}>📍 Pickup Location:</Text>
        <Text style={styles.pickupText}>{item.pickupLocationText}</Text>
      </View>

      <View style={styles.actionButtons}>
        {item.riderPhoneNumber && (
          <TouchableOpacity
            style={styles.callButton}
            onPress={() => handleCallRider(item.riderName, item.riderPhoneNumber)}
          >
            <Text style={styles.callButtonText}>📞 Call</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.pickupButton, item.riderPhoneNumber && styles.pickupButtonFlex]}
          onPress={() => handleMarkPickedUp(item.id, item.riderName)}
        >
          <Text style={styles.pickupButtonText}>Mark as Picked Up</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderActiveRide = () => {
    if (!activeRide) return null;

    return (
      <View style={[styles.requestCard, styles.activeRideCard]}>
        <View style={styles.activeRideBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeRideText}>ACTIVE RIDE</Text>
        </View>
        <View style={styles.requestHeader}>
          <View style={styles.riderInfo}>
            <View style={[styles.avatarSmall, styles.avatarActive]}>
              <Text style={styles.avatarSmallText}>
                {activeRide.riderName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.riderDetails}>
              <Text style={styles.riderName}>{activeRide.riderName}</Text>
              <Text style={styles.requestTime}>
                Picked up {activeRide.pickedUpAt ? formatTime(activeRide.pickedUpAt) : ''}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.pickupInfo}>
          <Text style={styles.pickupLabel}>📍 Pickup Location:</Text>
          <Text style={styles.pickupText}>{activeRide.pickupLocationText}</Text>
        </View>

        <View style={styles.actionButtons}>
          {activeRide.riderPhoneNumber && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={() => handleCallRider(activeRide.riderName, activeRide.riderPhoneNumber)}
            >
              <Text style={styles.callButtonText}>📞 Call</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.completeButton, activeRide.riderPhoneNumber && styles.completeButtonFlex]}
            onPress={() => handleMarkCompleted(activeRide.id, activeRide.riderName)}
          >
            <Text style={styles.completeButtonText}>Mark as Dropped Off</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🚗</Text>
      <Text style={styles.emptyText}>No Pending Ride Requests</Text>
      <Text style={styles.emptySubtext}>
        Ride requests will appear here when members need a ride
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const totalRequests = pendingRequests.length + acceptedRequests.length + (activeRide ? 1 : 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ride Queue</Text>
        <Text style={styles.headerSubtitle}>
          {totalRequests} {totalRequests === 1 ? 'request' : 'requests'}
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Active Ride Section */}
        {activeRide && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current Ride</Text>
            {renderActiveRide()}
          </View>
        )}

        {/* Accepted Rides Section */}
        {acceptedRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Accepted Rides</Text>
            {acceptedRequests.map((item) => (
              <View key={item.id}>{renderAcceptedCard({ item })}</View>
            ))}
          </View>
        )}

        {/* Pending Requests Section */}
        {pendingRequests.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Requests</Text>
            {pendingRequests.map((item) => (
              <View key={item.id}>{renderPendingCard({ item })}</View>
            ))}
          </View>
        )}

        {/* Empty State */}
        {totalRequests === 0 && renderEmptyState()}
      </ScrollView>
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
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  riderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarSmallText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  riderDetails: {
    flex: 1,
  },
  riderName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 2,
  },
  requestTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  distanceBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976D2',
  },
  pickupInfo: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pickupLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  pickupText: {
    fontSize: 16,
    color: '#000',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    minWidth: 80,
  },
  callButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  acceptButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  acceptButtonFlex: {
    flex: 1,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  acceptedCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#34C759',
  },
  activeRideCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    backgroundColor: '#E3F2FD',
  },
  statusBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D32',
  },
  activeRideBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    marginRight: 8,
  },
  activeRideText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#007AFF',
  },
  avatarActive: {
    backgroundColor: '#007AFF',
  },
  pickupButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  pickupButtonFlex: {
    flex: 1,
  },
  pickupButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  completeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  completeButtonFlex: {
    flex: 1,
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
