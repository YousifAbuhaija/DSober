import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event, DDAssignment, DDRequest } from '../types/database.types';

type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
};

type EventDetailRouteProp = RouteProp<EventsStackParamList, 'EventDetail'>;
type NavigationProp = StackNavigationProp<EventsStackParamList, 'EventDetail'>;

interface DDAssignmentWithUser extends DDAssignment {
  userName: string;
  userEmail: string;
}

export default function EventDetailScreen() {
  const route = useRoute<EventDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { eventId } = route.params;

  const [event, setEvent] = useState<Event | null>(null);
  const [ddAssignments, setDDAssignments] = useState<DDAssignmentWithUser[]>([]);
  const [userDDRequest, setUserDDRequest] = useState<DDRequest | null>(null);
  const [userDDAssignment, setUserDDAssignment] = useState<DDAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingDD, setRequestingDD] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  const fetchEventDetails = async () => {
    try {
      // Fetch event
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

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

      // Fetch DD assignments with user info
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('dd_assignments')
        .select(`
          *,
          users!dd_assignments_user_id_fkey (
            name,
            email
          )
        `)
        .eq('event_id', eventId);

      if (assignmentsError) throw assignmentsError;

      const mappedAssignments: DDAssignmentWithUser[] = (assignmentsData || []).map((assignment) => ({
        id: assignment.id,
        eventId: assignment.event_id,
        userId: assignment.user_id,
        status: assignment.status,
        updatedAt: new Date(assignment.updated_at),
        userName: assignment.users?.name || 'Unknown',
        userEmail: assignment.users?.email || '',
      }));

      setDDAssignments(mappedAssignments);

      // Check if current user has a DD request
      if (user?.id) {
        const { data: requestData } = await supabase
          .from('dd_requests')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (requestData) {
          setUserDDRequest({
            id: requestData.id,
            eventId: requestData.event_id,
            userId: requestData.user_id,
            status: requestData.status,
            createdAt: new Date(requestData.created_at),
          });
        }

        // Check if current user has a DD assignment
        const userAssignment = mappedAssignments.find((a) => a.userId === user.id);
        if (userAssignment) {
          setUserDDAssignment(userAssignment);
        }
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const requestToBeDD = async () => {
    if (!user?.id) return;

    setRequestingDD(true);
    try {
      const { error } = await supabase.from('dd_requests').insert({
        event_id: eventId,
        user_id: user.id,
        status: 'pending',
      });

      if (error) throw error;

      Alert.alert('Success', 'Your DD request has been submitted');
      fetchEventDetails();
    } catch (error) {
      console.error('Error requesting to be DD:', error);
      Alert.alert('Error', 'Failed to submit DD request');
    } finally {
      setRequestingDD(false);
    }
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#007AFF';
      case 'active':
        return '#34C759';
      case 'completed':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const renderDDStatusSection = () => {
    if (!user?.isDD) {
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You are not registered as a DD. To become a DD, update your profile settings.
          </Text>
        </View>
      );
    }

    // User has an assignment
    if (userDDAssignment) {
      if (userDDAssignment.status === 'assigned') {
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your DD Status</Text>
            <View style={[styles.statusBox, { backgroundColor: '#E8F5E9' }]}>
              <Text style={[styles.statusBoxText, { color: '#2E7D32' }]}>
                ✓ You are assigned as a DD for this event
              </Text>
            </View>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Start SEP Verification</Text>
            </TouchableOpacity>
          </View>
        );
      } else if (userDDAssignment.status === 'revoked') {
        return (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your DD Status</Text>
            <View style={[styles.statusBox, { backgroundColor: '#FFEBEE' }]}>
              <Text style={[styles.statusBoxText, { color: '#C62828' }]}>
                ✗ Your DD assignment has been revoked
              </Text>
            </View>
          </View>
        );
      }
    }

    // User has a pending request
    if (userDDRequest?.status === 'pending') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your DD Status</Text>
          <View style={[styles.statusBox, { backgroundColor: '#FFF3E0' }]}>
            <Text style={[styles.statusBoxText, { color: '#E65100' }]}>
              ⏳ Your DD request is pending admin approval
            </Text>
          </View>
        </View>
      );
    }

    // User has a rejected request
    if (userDDRequest?.status === 'rejected') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your DD Status</Text>
          <View style={[styles.statusBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statusBoxText, { color: '#C62828' }]}>
              ✗ Your DD request was not approved
            </Text>
          </View>
        </View>
      );
    }

    // User can request to be DD
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Become a DD</Text>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={requestToBeDD}
          disabled={requestingDD}
        >
          {requestingDD ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryButtonText}>Request to be DD</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Event not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Event Header */}
      <View style={styles.header}>
        <Text style={styles.eventName}>{event.name}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(event.status) }]}>
          <Text style={styles.statusText}>{event.status.toUpperCase()}</Text>
        </View>
      </View>

      {/* Event Details */}
      <View style={styles.section}>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📅</Text>
          <Text style={styles.detailText}>{formatDateTime(event.dateTime)}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailIcon}>📍</Text>
          <Text style={styles.detailText}>{event.locationText}</Text>
        </View>
        {event.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        )}
      </View>

      {/* DD Status Section */}
      {renderDDStatusSection()}

      {/* Assigned DDs */}
      {ddAssignments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Assigned DDs</Text>
          {ddAssignments.map((assignment) => (
            <View key={assignment.id} style={styles.ddCard}>
              <View style={styles.ddInfo}>
                <Text style={styles.ddName}>{assignment.userName}</Text>
                <View
                  style={[
                    styles.ddStatusBadge,
                    {
                      backgroundColor:
                        assignment.status === 'assigned' ? '#E8F5E9' : '#FFEBEE',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.ddStatusText,
                      {
                        color: assignment.status === 'assigned' ? '#2E7D32' : '#C62828',
                      },
                    ]}
                  >
                    {assignment.status.toUpperCase()}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Admin Actions */}
      {user?.role === 'admin' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Admin Actions</Text>
          <TouchableOpacity style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Assign DD</Text>
          </TouchableOpacity>
        </View>
      )}
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
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  detailIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  detailText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 14,
    color: '#1565C0',
    lineHeight: 20,
  },
  statusBox: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  statusBoxText: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  ddCard: {
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  ddInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ddName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  ddStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  ddStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
