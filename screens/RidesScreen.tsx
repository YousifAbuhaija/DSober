import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User, DDSession, Event } from '../types/database.types';
import { calculateDistance } from '../utils/location';
import { theme } from '../theme/colors';

type RidesStackParamList = {
  RidesMain: undefined;
  DDRideQueue: { sessionId: string; eventId: string };
  RideStatus: { eventId: string };
  EventDetail: { eventId: string };
};

type NavigationProp = StackNavigationProp<RidesStackParamList, 'RidesMain'>;

interface RideRequestWithRider extends RideRequest {
  riderName: string;
  distance?: number;
}

export default function RidesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSession, setActiveSession] = useState<DDSession | null>(null);
  const [activeEvent, setActiveEvent] = useState<Event | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [myRideRequest, setMyRideRequest] = useState<RideRequest | null>(null);
  const [myRideDD, setMyRideDD] = useState<User | null>(null);
  const [migrationError, setMigrationError] = useState(false);

  // Fetch data when screen comes into focus
  // Note: We don't need to call refreshUser() here because AuthContext
  // has a real-time subscription that automatically updates user data
  useFocusEffect(
    React.useCallback(() => {
      fetchData();
    }, [user?.id])
  );

  const fetchData = async () => {
    if (!user) return;

    try {
      // Check if user has an active DD session
      if (user.isDD) {
        const { data: sessionData, error: sessionError } = await supabase
          .from('dd_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (sessionError && sessionError.code !== 'PGRST116') {
          console.error('Error fetching session:', sessionError);
        }

        if (sessionData) {
          const mappedSession: DDSession = {
            id: sessionData.id,
            userId: sessionData.user_id,
            eventId: sessionData.event_id,
            startedAt: new Date(sessionData.started_at),
            endedAt: sessionData.ended_at ? new Date(sessionData.ended_at) : undefined,
            isActive: sessionData.is_active,
          };
          setActiveSession(mappedSession);

          // Fetch event details
          const { data: eventData } = await supabase
            .from('events')
            .select('*')
            .eq('id', sessionData.event_id)
            .single();

          if (eventData) {
            setActiveEvent({
              id: eventData.id,
              groupId: eventData.group_id,
              name: eventData.name,
              description: eventData.description,
              dateTime: new Date(eventData.date_time),
              locationText: eventData.location_text,
              status: eventData.status,
              createdByUserId: eventData.created_by_user_id,
              createdAt: new Date(eventData.created_at),
            });
          }

          // Count pending ride requests
          const { count } = await supabase
            .from('ride_requests')
            .select('*', { count: 'exact', head: true })
            .eq('dd_user_id', user.id)
            .eq('event_id', sessionData.event_id)
            .eq('status', 'pending');

          setPendingRequestsCount(count || 0);
        } else {
          setActiveSession(null);
          setActiveEvent(null);
          setPendingRequestsCount(0);
        }
      }

      // Check if user has an active ride request (as a rider)
      const { data: requestData, error: requestError } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_user_id', user.id)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (requestError) {
        if (requestError.code === 'PGRST205') {
          // Table doesn't exist - migration not run
          console.error('ride_requests table not found - migration needed');
          setMigrationError(true);
          setLoading(false);
          setRefreshing(false);
          return;
        } else if (requestError.code !== 'PGRST116') {
          console.error('Error fetching ride request:', requestError);
        }
      }

      if (requestData) {
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
        setMyRideRequest(mappedRequest);

        // Fetch DD details
        const { data: ddData } = await supabase
          .from('users')
          .select('*')
          .eq('id', requestData.dd_user_id)
          .single();

        if (ddData) {
          setMyRideDD({
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
          });
        }
      } else {
        setMyRideRequest(null);
        setMyRideDD(null);
      }
    } catch (err) {
      console.error('Error fetching rides data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const renderActiveDDView = () => {
    if (!activeSession || !activeEvent) return null;

    return (
      <View style={styles.section}>
        <View style={styles.activeBadge}>
          <View style={styles.activeDot} />
          <Text style={styles.activeBadgeText}>ACTIVE DD SESSION</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{activeEvent.name}</Text>
          <Text style={styles.cardSubtitle}>📍 {activeEvent.locationText}</Text>
          
          {pendingRequestsCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationText}>
                {pendingRequestsCount} pending {pendingRequestsCount === 1 ? 'request' : 'requests'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('DDRideQueue', { 
              sessionId: activeSession.id, 
              eventId: activeSession.eventId 
            })}
          >
            <Text style={styles.primaryButtonText}>View Ride Queue</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderInactiveDDView = () => {
    if (!user?.isDD || activeSession) return null;

    return (
      <View style={styles.section}>
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🚗</Text>
          <Text style={styles.emptyTitle}>No Active DD Session</Text>
          <Text style={styles.emptyText}>
            Start a DD session from an event to begin receiving ride requests
          </Text>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('EventDetail' as any, { eventId: '' })}
          >
            <Text style={styles.secondaryButtonText}>Go to Events</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRevokedDDView = () => {
    if (!user?.isDD || user.ddStatus !== 'revoked') return null;

    return (
      <View style={styles.section}>
        <View style={styles.warningCard}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningTitle}>DD Status Revoked</Text>
          <Text style={styles.warningText}>
            Your DD status has been revoked. Please contact an admin for more information.
          </Text>
        </View>
      </View>
    );
  };

  const renderMyRideRequestView = () => {
    if (!myRideRequest || !myRideDD) return null;

    const getStatusInfo = () => {
      switch (myRideRequest.status) {
        case 'pending':
          return { icon: '⏳', text: 'Waiting for driver', color: '#FF9500' };
        case 'accepted':
          return { icon: '✅', text: 'Driver accepted', color: '#34C759' };
        case 'picked_up':
          return { icon: '🚗', text: 'On the way', color: '#007AFF' };
        default:
          return { icon: '❓', text: 'Unknown', color: '#8E8E93' };
      }
    };

    const statusInfo = getStatusInfo();

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Your Ride Request</Text>
        <View style={[styles.card, { borderLeftWidth: 4, borderLeftColor: statusInfo.color }]}>
          <View style={styles.statusRow}>
            <Text style={styles.statusIcon}>{statusInfo.icon}</Text>
            <Text style={styles.statusText}>{statusInfo.text}</Text>
          </View>
          
          <Text style={styles.driverName}>Driver: {myRideDD.name}</Text>
          {myRideDD.carMake && myRideDD.carModel && (
            <Text style={styles.carInfo}>
              🚗 {myRideDD.carMake} {myRideDD.carModel}
            </Text>
          )}
          <Text style={styles.pickupInfo}>
            📍 {myRideRequest.pickupLocationText}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('RideStatus', { eventId: myRideRequest.eventId })}
          >
            <Text style={styles.primaryButtonText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderNonDDView = () => {
    if (user?.isDD) return null;

    return (
      <View style={styles.section}>
        <View style={styles.ctaCard}>
          <Text style={styles.ctaIcon}>🚗</Text>
          <Text style={styles.ctaTitle}>Become a Designated Driver</Text>
          <Text style={styles.ctaText}>
            Help your chapter by becoming a verified DD. You'll be able to give rides during events and help keep everyone safe.
          </Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              Alert.alert(
                'Become a DD',
                'To become a DD, please contact your chapter admin. They can update your account and you\'ll need to provide vehicle information.',
                [{ text: 'OK' }]
              );
            }}
          >
            <Text style={styles.primaryButtonText}>Learn More</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
      </View>
    );
  }

  if (migrationError) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Rides</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.errorCard}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Database Setup Required</Text>
            <Text style={styles.errorText}>
              The ride requests feature requires a database migration to be run.
            </Text>
            <Text style={styles.errorInstructions}>
              Please run the SQL migration in your Supabase SQL Editor:
            </Text>
            <View style={styles.codeBlock}>
              <Text style={styles.codeText}>
                File: supabase/migrations/013_add_ride_requests.sql
              </Text>
            </View>
            <Text style={styles.errorInstructions}>
              See MIGRATION_INSTRUCTIONS.md for detailed steps.
            </Text>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => {
                Alert.alert(
                  'Migration Instructions',
                  '1. Go to Supabase Dashboard\n2. Open SQL Editor\n3. Run migration file:\n   013_add_ride_requests.sql\n\nSee MIGRATION_INSTRUCTIONS.md for full details.',
                  [{ text: 'OK' }]
                );
              }}
            >
              <Text style={styles.secondaryButtonText}>View Instructions</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rides</Text>
        <Text style={styles.headerSubtitle}>
          {user?.isDD ? 'Manage your ride requests' : 'Request rides from DDs'}
        </Text>
      </View>

      {/* Show active ride request first if exists */}
      {renderMyRideRequestView()}

      {/* Show DD-specific views */}
      {user?.ddStatus === 'revoked' && renderRevokedDDView()}
      {user?.isDD && user.ddStatus !== 'revoked' && (
        <>
          {renderActiveDDView()}
          {renderInactiveDDView()}
        </>
      )}

      {/* Show non-DD call to action */}
      {!myRideRequest && renderNonDDView()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.primary,
  },
  content: {
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.background.primary,
  },
  header: {
    backgroundColor: theme.colors.background.elevated,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.default,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 12,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background.elevated,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignSelf: 'flex-start',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.colors.functional.success,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.functional.success,
    marginRight: 8,
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.functional.success,
    letterSpacing: 1,
  },
  card: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  notificationBadge: {
    backgroundColor: theme.colors.functional.warning,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text.onSecondary,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: theme.colors.primary.main,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.onPrimary,
  },
  secondaryButton: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.primary.main,
  },
  emptyCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.functional.warning,
  },
  warningIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.functional.warning,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  ctaCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.primary.light,
  },
  ctaIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  ctaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  ctaText: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 4,
  },
  carInfo: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 4,
  },
  pickupInfo: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: theme.colors.background.elevated,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.colors.functional.error,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.functional.error,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  errorInstructions: {
    fontSize: 14,
    color: theme.colors.text.tertiary,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 20,
  },
  codeBlock: {
    backgroundColor: theme.colors.background.input,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  codeText: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
