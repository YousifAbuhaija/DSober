import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { User, SEPBaseline, RideRequest } from '../types/database.types';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentLocation } from '../utils/location';

type DDsStackParamList = {
  DDsList: undefined;
  DDDetail: { ddUserId: string; eventId?: string };
  RideStatus: { eventId: string };
};

type DDDetailRouteProp = RouteProp<DDsStackParamList, 'DDDetail'>;
type NavigationProp = StackNavigationProp<DDsStackParamList, 'DDDetail'>;

export default function DDDetailScreen() {
  const route = useRoute<DDDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { ddUserId, eventId } = route.params;
  const { user } = useAuth();
  const [ddUser, setDDUser] = useState<User | null>(null);
  const [sepBaseline, setSepBaseline] = useState<SEPBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingRequest, setExistingRequest] = useState<RideRequest | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [requestingRide, setRequestingRide] = useState(false);

  useEffect(() => {
    fetchDDDetails();
  }, [ddUserId]);

  // Check for existing request when screen comes into focus or when navigation state changes
  useFocusEffect(
    useCallback(() => {
      if (eventId && user) {
        checkExistingRequest();
      }
    }, [eventId, user])
  );

  // Listen for navigation state changes (when coming back from RideStatus)
  useEffect(() => {
    const unsubscribe = navigation.addListener('state', () => {
      if (eventId && user) {
        // Small delay to ensure the database has been updated
        setTimeout(() => {
          checkExistingRequest();
        }, 100);
      }
    });

    return unsubscribe;
  }, [navigation, eventId, user]);

  const fetchDDDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user details
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', ddUserId)
        .single();

      if (userError) throw userError;

      if (userData) {
        const mappedUser: User = {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          birthday: new Date(userData.birthday),
          age: userData.age,
          gender: userData.gender,
          groupId: userData.group_id,
          role: userData.role,
          isDD: userData.is_dd,
          ddStatus: userData.dd_status,
          carMake: userData.car_make,
          carModel: userData.car_model,
          carPlate: userData.car_plate,
          phoneNumber: userData.phone_number,
          licensePhotoUrl: userData.license_photo_url,
          profilePhotoUrl: userData.profile_photo_url,
          createdAt: new Date(userData.created_at),
          updatedAt: new Date(userData.updated_at),
        };
        setDDUser(mappedUser);
      }

      // Fetch SEP baseline for selfie
      const { data: baselineData, error: baselineError } = await supabase
        .from('sep_baselines')
        .select('*')
        .eq('user_id', ddUserId)
        .single();

      if (baselineError && baselineError.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which is acceptable
        console.error('Error fetching SEP baseline:', baselineError);
      }

      if (baselineData) {
        const mappedBaseline: SEPBaseline = {
          id: baselineData.id,
          userId: baselineData.user_id,
          reactionAvgMs: baselineData.reaction_avg_ms,
          phraseDurationSec: baselineData.phrase_duration_sec,
          selfieUrl: baselineData.selfie_url,
          createdAt: new Date(baselineData.created_at),
        };
        setSepBaseline(mappedBaseline);
      }
    } catch (err) {
      console.error('Error fetching DD details:', err);
      setError('Failed to load DD details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingRequest = async () => {
    if (!user || !eventId) return;

    try {
      const { data, error } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_user_id', user.id)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking existing request:', error);
        return;
      }

      if (data) {
        const mappedRequest: RideRequest = {
          id: data.id,
          ddUserId: data.dd_user_id,
          riderUserId: data.rider_user_id,
          eventId: data.event_id,
          pickupLocationText: data.pickup_location_text,
          pickupLatitude: data.pickup_latitude,
          pickupLongitude: data.pickup_longitude,
          status: data.status,
          createdAt: new Date(data.created_at),
          acceptedAt: data.accepted_at ? new Date(data.accepted_at) : undefined,
          pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
          completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        };
        setExistingRequest(mappedRequest);
      }
    } catch (err) {
      console.error('Error checking existing request:', err);
    }
  };

  const handleRequestRide = async () => {
    if (!user || !eventId || !pickupLocation.trim()) {
      Alert.alert('Error', 'Please enter a pickup location');
      return;
    }

    setRequestingRide(true);

    try {
      // Get current location for proximity sorting
      let userLocation: { latitude: number; longitude: number } | null = null;
      try {
        userLocation = await getCurrentLocation();
      } catch (locError) {
        console.log('Could not get location, continuing without coordinates');
      }

      // Create ride request
      const requestData: any = {
        dd_user_id: ddUserId,
        rider_user_id: user.id,
        event_id: eventId,
        pickup_location_text: pickupLocation.trim(),
        status: 'pending',
      };

      if (userLocation) {
        requestData.pickup_latitude = userLocation.latitude;
        requestData.pickup_longitude = userLocation.longitude;
      }

      const { data, error } = await supabase
        .from('ride_requests')
        .insert(requestData)
        .select()
        .single();

      if (error) throw error;

      // Map the response
      if (data) {
        const mappedRequest: RideRequest = {
          id: data.id,
          ddUserId: data.dd_user_id,
          riderUserId: data.rider_user_id,
          eventId: data.event_id,
          pickupLocationText: data.pickup_location_text,
          pickupLatitude: data.pickup_latitude,
          pickupLongitude: data.pickup_longitude,
          status: data.status,
          createdAt: new Date(data.created_at),
          acceptedAt: data.accepted_at ? new Date(data.accepted_at) : undefined,
          pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
          completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        };
        setExistingRequest(mappedRequest);
      }

      setShowRequestModal(false);
      setPickupLocation('');
      
      Alert.alert(
        'Ride Requested',
        `Your ride request has been sent to ${ddUser?.name}. They will be notified.`,
        [
          { 
            text: 'OK',
            onPress: () => {
              if (eventId) {
                navigation.navigate('RideStatus', { eventId });
              }
            }
          }
        ]
      );
    } catch (err: any) {
      console.error('Error requesting ride:', err);
      Alert.alert(
        'Error',
        err.message || 'Failed to request ride. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRequestingRide(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const handleCallDriver = async () => {
    if (!ddUser?.phoneNumber) {
      Alert.alert(
        'Phone Number Not Available',
        'This driver has not provided a phone number. Please use your chapter\'s communication channels to contact them.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Format phone number for tel: URL (remove non-numeric characters)
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
      Alert.alert(
        'Error',
        'Failed to open phone dialer. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  if (error || !ddUser) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || 'DD not found'}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Driver Photo Section */}
      <View style={styles.photoSection}>
        <Text style={styles.photoSectionTitle}>Driver Identification</Text>
        
        {/* Profile Photo */}
        <View style={styles.photoContainer}>
          <Text style={styles.photoLabel}>Driver Photo</Text>
          {ddUser.profilePhotoUrl ? (
            <Image
              source={{ uri: ddUser.profilePhotoUrl }}
              style={styles.photo}
              resizeMode="cover"
              onError={(error) => {
                console.error('Error loading DD detail photo:', error.nativeEvent.error);
                console.log('Failed URL:', ddUser.profilePhotoUrl);
              }}
            />
          ) : (
            <View style={styles.photo}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {ddUser.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
          )}
          {ddUser.profilePhotoUrl ? (
            <Text style={styles.photoCaption}>
              Profile photo for DD identification
            </Text>
          ) : (
            <Text style={styles.photoCaption}>
              No profile photo available
            </Text>
          )}
        </View>
      </View>

      {/* Driver Name */}
      <View style={styles.nameContainer}>
        <Text style={styles.name}>{ddUser.name}</Text>
        <Text style={styles.nameSubtitle}>Verified Designated Driver</Text>
      </View>

      {/* Vehicle Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Vehicle Information</Text>
        <View style={styles.infoCard}>
          {ddUser.carMake && ddUser.carModel && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle:</Text>
              <Text style={styles.infoValue}>
                {ddUser.carMake} {ddUser.carModel}
              </Text>
            </View>
          )}
          {ddUser.carPlate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>License Plate:</Text>
              <Text style={styles.infoValue}>{ddUser.carPlate}</Text>
            </View>
          )}
          {!ddUser.carMake && !ddUser.carModel && !ddUser.carPlate && (
            <Text style={styles.noInfoText}>No vehicle information available</Text>
          )}
        </View>
      </View>

      {/* Call Driver Button */}
      <View style={styles.section}>
        <TouchableOpacity
          style={[
            styles.callButton,
            !ddUser.phoneNumber && styles.callButtonDisabled,
          ]}
          onPress={handleCallDriver}
          disabled={!ddUser.phoneNumber}
        >
          <Text style={styles.callButtonIcon}>📞</Text>
          <Text style={styles.callButtonText}>
            {ddUser.phoneNumber ? 'Call Driver' : 'No Phone Number'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Contact Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Information</Text>
        <View style={styles.infoCard}>
          {ddUser.phoneNumber && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{ddUser.phoneNumber}</Text>
            </View>
          )}
          {ddUser.email && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{ddUser.email}</Text>
            </View>
          )}
          {!ddUser.phoneNumber && !ddUser.email && (
            <Text style={styles.noInfoText}>No contact information available</Text>
          )}
        </View>
      </View>

      {/* Request Ride Button */}
      {eventId && user && ddUserId !== user.id && (
        <View style={styles.section}>
          {existingRequest ? (
            <View>
              <View style={styles.requestStatusCard}>
                <Text style={styles.requestStatusTitle}>Ride Request Status</Text>
                <Text style={styles.requestStatusText}>
                  {existingRequest.status === 'pending' && '⏳ Your ride request is pending'}
                  {existingRequest.status === 'accepted' && '✅ Your ride request has been accepted'}
                  {existingRequest.status === 'picked_up' && '🚗 Driver is on the way'}
                </Text>
                <Text style={styles.requestStatusDetail}>
                  Pickup: {existingRequest.pickupLocationText}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.viewStatusButton}
                onPress={() => navigation.navigate('RideStatus', { eventId })}
              >
                <Text style={styles.viewStatusButtonText}>View Ride Status</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.requestRideButton}
              onPress={() => setShowRequestModal(true)}
            >
              <Text style={styles.requestRideButtonIcon}>🚗</Text>
              <Text style={styles.requestRideButtonText}>Request Ride</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Safety Notice */}
      <View style={styles.noticeContainer}>
        <Text style={styles.noticeText}>
          ⚠️ This driver has passed SEP verification and is authorized to drive for this event.
        </Text>
      </View>

      {/* Request Ride Modal */}
      <Modal
        visible={showRequestModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowRequestModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request a Ride</Text>
            <Text style={styles.modalSubtitle}>
              Where should {ddUser?.name} pick you up?
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter pickup location (e.g., Main entrance, Room 204)"
              value={pickupLocation}
              onChangeText={setPickupLocation}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowRequestModal(false);
                  setPickupLocation('');
                }}
              >
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalButtonConfirm,
                  (!pickupLocation.trim() || requestingRide) && styles.modalButtonDisabled,
                ]}
                onPress={handleRequestRide}
                disabled={!pickupLocation.trim() || requestingRide}
              >
                {requestingRide ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonTextConfirm}>Request Ride</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  contentContainer: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#D32F2F',
    textAlign: 'center',
  },
  photoSection: {
    backgroundColor: '#fff',
    paddingTop: 24,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
    textAlign: 'center',
  },
  photoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  photoLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  photo: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E5E5EA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#007AFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  photoCaption: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
  },
  avatarPlaceholder: {
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 80,
    fontWeight: '700',
    color: '#fff',
  },
  nameContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  nameSubtitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  noInfoText: {
    fontSize: 14,
    color: '#8E8E93',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  noticeContainer: {
    marginTop: 24,
    marginHorizontal: 16,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  noticeText: {
    fontSize: 14,
    color: '#1976D2',
    lineHeight: 20,
    textAlign: 'center',
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
  callButtonDisabled: {
    backgroundColor: '#E5E5EA',
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
  requestRideButton: {
    backgroundColor: '#007AFF',
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
  requestRideButtonIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  requestRideButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  requestStatusCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#90CAF9',
  },
  requestStatusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1976D2',
    marginBottom: 8,
  },
  requestStatusText: {
    fontSize: 16,
    color: '#1976D2',
    marginBottom: 4,
  },
  requestStatusDetail: {
    fontSize: 14,
    color: '#1976D2',
    fontStyle: 'italic',
  },
  viewStatusButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  viewStatusButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    minHeight: 80,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E5EA',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#F2F2F7',
  },
  modalButtonConfirm: {
    backgroundColor: '#007AFF',
  },
  modalButtonDisabled: {
    backgroundColor: '#E5E5EA',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  modalButtonTextConfirm: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
