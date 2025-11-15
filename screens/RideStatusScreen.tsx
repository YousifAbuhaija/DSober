import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User } from '../types/database.types';

type EventsStackParamList = {
  EventDetail: { eventId: string };
  RideStatus: { eventId: string };
};

type RideStatusRouteProp = RouteProp<EventsStackParamList, 'RideStatus'>;
type NavigationProp = StackNavigationProp<EventsStackParamList, 'RideStatus'>;

export default function RideStatusScreen() {
  const route = useRoute<RideStatusRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { eventId } = route.params;
  const { user } = useAuth();
  const [rideRequest, setRideRequest] = useState<RideRequest | null>(null);
  const [ddUser, setDDUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchRideStatus();

    // Set up real-time subscription
    const subscription = supabase
      .channel('ride_status_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ride_requests',
          filter: `rider_user_id=eq.${user?.id}`,
        },
        () => {
          fetchRideStatus();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [eventId, user]);

  const fetchRideStatus = async () => {
    if (!user) return;

    try {
      // Fetch active ride request for this user and event
      const { data: requestData, error: requestError } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_user_id', user.id)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .maybeSingle();

      if (requestError && requestError.code !== 'PGRST116') {
        throw requestError;
      }

      if (!requestData) {
        // No active request, go back if possible
        Alert.alert(
          'No Active Request', 
          'You don\'t have an active ride request.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (navigation.canGoBack()) {
                  navigation.goBack();
                }
              }
            }
          ]
        );
        return;
      }

      const mappedRequest: RideRequest = {
        id: requestData.id,
        ddUserId: requestData.dd_user_id,
        riderUserId: requestData.rider_user_id,
        eventId: requestData.event_id,
        pickupLocationText: requestData.pickup_location_text,
        pickupLatitude: requestData.pickup_latitude,
        pickupLongitude: requestData.pickup_longitude,
        status: requestData.status,
        createdAt: new Date(requestData.created_at),
        acceptedAt: requestData.accepted_at ? new Date(requestData.accepted_at) : undefined,
        pickedUpAt: requestData.picked_up_at ? new Date(requestData.picked_up_at) : undefined,
        completedAt: requestData.completed_at ? new Date(requestData.completed_at) : undefined,
      };
      setRideRequest(mappedRequest);

      // Fetch DD details if request is accepted or picked up
      if (mappedRequest.status !== 'pending') {
        const { data: ddData, error: ddError } = await supabase
          .from('users')
          .select('*')
          .eq('id', mappedRequest.ddUserId)
          .single();

        if (ddError) throw ddError;

        if (ddData) {
          const mappedDD: User = {
            id: ddData.id,
            email: ddData.email,
            name: ddData.name,
            birthday: new Date(ddData.birthday),
            age: ddData.age,
            gender: ddData.gender,
            groupId: ddData.group_id,
            role: ddData.role,
            isDD: ddData.is_dd,
            ddStatus: ddData.dd_status,
            carMake: ddData.car_make,
            carModel: ddData.car_model,
            carPlate: ddData.car_plate,
            phoneNumber: ddData.phone_number,
            licensePhotoUrl: ddData.license_photo_url,
            profilePhotoUrl: ddData.profile_photo_url,
            createdAt: new Date(ddData.created_at),
            updatedAt: new Date(ddData.updated_at),
          };
          setDDUser(mappedDD);
        }
      }
    } catch (err) {
      console.error('Error fetching ride status:', err);
      Alert.alert('Error', 'Failed to load ride status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!rideRequest) return;

    Alert.alert(
      'Cancel Ride Request',
      'Are you sure you want to cancel your ride request?',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelling(true);

              const { error } = await supabase
                .from('ride_requests')
                .update({
                  status: 'cancelled',
                })
                .eq('id', rideRequest.id);

              if (error) throw error;

              Alert.alert(
                'Request Cancelled', 
                'Your ride request has been cancelled.',
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Try to go back, but if there's no screen to go back to,
                      // the navigation will handle it gracefully
                      if (navigation.canGoBack()) {
                        navigation.goBack();
                      }
                    }
                  }
                ]
              );
            } catch (err) {
              console.error('Error cancelling request:', err);
              Alert.alert('Error', 'Failed to cancel request. Please try again.');
            } finally {
              setCancelling(false);
            }
          },
        },
      ]
    );
  };

  const handleCallDriver = async () => {
    if (!ddUser?.phoneNumber) {
      Alert.alert(
        'Phone Number Not Available',
        'This driver has not provided a phone number.',
        [{ text: 'OK' }]
      );
      return;
    }

    const phoneNumber = ddUser.phoneNumber.replace(/[^0-9]/g, '');
    const phoneUrl = `tel:${phoneNumber}`;

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!rideRequest) {
    return null;
  }

  const getStatusInfo = () => {
    switch (rideRequest.status) {
      case 'pending':
        return {
          icon: '⏳',
          title: 'Request Pending',
          message: 'Your ride request is waiting for the driver to accept.',
          color: '#FF9500',
        };
      case 'accepted':
        return {
          icon: '✅',
          title: 'Request Accepted',
          message: 'Your driver has accepted your request and will pick you up soon.',
          color: '#34C759',
        };
      case 'picked_up':
        return {
          icon: '🚗',
          title: 'On the Way',
          message: 'Your driver has picked you up and is taking you to your destination.',
          color: '#007AFF',
        };
      default:
        return {
          icon: '❓',
          title: 'Unknown Status',
          message: 'Unable to determine ride status.',
          color: '#8E8E93',
        };
    }
  };

  const statusInfo = getStatusInfo();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Status Card */}
      <View style={[styles.statusCard, { borderLeftColor: statusInfo.color }]}>
        <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
        <Text style={styles.statusTitle}>{statusInfo.title}</Text>
        <Text style={styles.statusMessage}>{statusInfo.message}</Text>
      </View>

      {/* Pickup Location */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pickup Location</Text>
        <View style={styles.infoCard}>
          <Text style={styles.pickupIcon}>📍</Text>
          <Text style={styles.pickupText}>{rideRequest.pickupLocationText}</Text>
        </View>
      </View>

      {/* Driver Info (if accepted or picked up) */}
      {ddUser && rideRequest.status !== 'pending' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Driver</Text>
          <View style={styles.driverCard}>
            {ddUser.profilePhotoUrl ? (
              <Image
                source={{ uri: ddUser.profilePhotoUrl }}
                style={styles.driverPhoto}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.driverPhoto}>
                <Text style={styles.driverPhotoText}>
                  {ddUser.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ddUser.name}</Text>
              {ddUser.carMake && ddUser.carModel && (
                <Text style={styles.carInfo}>
                  🚗 {ddUser.carMake} {ddUser.carModel}
                </Text>
              )}
              {ddUser.carPlate && (
                <Text style={styles.carPlate}>Plate: {ddUser.carPlate}</Text>
              )}
            </View>
          </View>

          {/* Call Driver Button */}
          {ddUser.phoneNumber && (
            <TouchableOpacity
              style={styles.callButton}
              onPress={handleCallDriver}
            >
              <Text style={styles.callButtonIcon}>📞</Text>
              <Text style={styles.callButtonText}>Call Driver</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Cancel Button (only for pending requests) */}
      {rideRequest.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancelRequest}
          disabled={cancelling}
        >
          {cancelling ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.cancelButtonText}>Cancel Request</Text>
          )}
        </TouchableOpacity>
      )}

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoIcon}>ℹ️</Text>
        <Text style={styles.infoText}>
          {rideRequest.status === 'pending' && 
            'The driver will be notified of your request. You can cancel anytime before they accept.'}
          {rideRequest.status === 'accepted' && 
            'Your driver is preparing to pick you up. Please be ready at your pickup location.'}
          {rideRequest.status === 'picked_up' && 
            'Enjoy your ride! Your driver will mark the ride as complete when you arrive.'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  statusMessage: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pickupIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  pickupText: {
    fontSize: 16,
    color: '#000',
    flex: 1,
  },
  driverCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  driverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  driverPhotoText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#fff',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
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
  callButton: {
    backgroundColor: '#34C759',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  callButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  callButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
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
});
