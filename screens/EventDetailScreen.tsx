import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event, DDAssignment, DDRequest, User } from '../types/database.types';
import { markEventAsCompleted } from '../utils/eventStatus';
import { colors, spacing, typography, radii } from '../theme';

type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
  SEPReaction: { mode: 'baseline' | 'attempt'; eventId?: string };
  SEPPhrase: {
    mode: 'baseline' | 'attempt';
    reactionAvgMs: number;
    eventId?: string;
  };
  SEPSelfie: {
    mode: 'baseline' | 'attempt';
    reactionAvgMs: number;
    phraseDurationSec: number;
    audioUrl: string;
    eventId?: string;
  };
  DDActiveSession: { eventId: string };
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
  const { user, refreshUser } = useAuth();
  const { eventId } = route.params;

  const [event, setEvent] = useState<Event | null>(null);
  const [ddAssignments, setDDAssignments] = useState<DDAssignmentWithUser[]>([]);
  const [userDDRequest, setUserDDRequest] = useState<DDRequest | null>(null);
  const [userDDAssignment, setUserDDAssignment] = useState<DDAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestingDD, setRequestingDD] = useState(false);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigningDD, setAssigningDD] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [markingCompleted, setMarkingCompleted] = useState(false);

  useEffect(() => {
    fetchEventDetails();
  }, [eventId]);

  // Refresh data when screen comes into focus (e.g., after SEP verification)
  // Fetch event details when screen comes into focus
  // Note: We don't need to call refreshUser() here because AuthContext
  // has a real-time subscription that automatically updates user data
  useFocusEffect(
    React.useCallback(() => {
      fetchEventDetails();
    }, [eventId])
  );

  const fetchEventDetails = async () => {
    try {
      
      // Validate eventId before making any queries
      if (!eventId || eventId === '') {
        Alert.alert('Error', 'Invalid event ID. Please try again.');
        navigation.goBack();
        return;
      }
      
      // Reset user-specific state before fetching
      setUserDDRequest(null);
      setUserDDAssignment(null);
      setActiveSession(null);

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

      // Check if current user has a DD request (only pending or approved, not rejected)
      if (user?.id) {
        const { data: requestData } = await supabase
          .from('dd_requests')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .in('status', ['pending', 'approved'])
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

        // Check if current user has an active DD session
        const { data: sessionData } = await supabase
          .from('dd_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('event_id', eventId)
          .eq('is_active', true)
          .order('started_at', { ascending: false })
          .limit(1)
          .single();

        if (sessionData) {
          setActiveSession(sessionData);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const requestToBeDD = async () => {
    if (!user?.id) return;

    setRequestingDD(true);
    try {
      // Check if a request already exists
      const { data: existingRequest } = await supabase
        .from('dd_requests')
        .select('id, status')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .single();

      if (existingRequest) {
        // Update existing request (e.g., resubmit after rejection)
        const { error } = await supabase
          .from('dd_requests')
          .update({
            status: 'pending',
          })
          .eq('id', existingRequest.id);

        if (error) throw error;
      } else {
        // Create new request (this will trigger the admin notification)
        const { error } = await supabase
          .from('dd_requests')
          .insert({
            event_id: eventId,
            user_id: user.id,
            status: 'pending',
          });

        if (error) throw error;
      }

      Alert.alert('Success', 'Your DD request has been submitted');
      fetchEventDetails();
    } catch (error) {
      Alert.alert('Error', 'Failed to submit DD request');
    } finally {
      setRequestingDD(false);
    }
  };

  const openAssignModal = async () => {
    setAssignModalVisible(true);
    setLoadingMembers(true);
    try {
      // Fetch all members in the user's group
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('group_id', user?.groupId);

      if (userError) throw userError;

      const mappedUsers: User[] = (userData || []).map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        birthday: new Date(u.birthday),
        age: u.age,
        gender: u.gender,
        groupId: u.group_id,
        role: u.role,
        isDD: u.is_dd,
        carMake: u.car_make,
        carModel: u.car_model,
        carPlate: u.car_plate,
        licensePhotoUrl: u.license_photo_url,
        createdAt: new Date(u.created_at),
        updatedAt: new Date(u.updated_at),
      }));

      setGroupMembers(mappedUsers);
    } catch (error) {
      Alert.alert('Error', 'Failed to load group members');
      setAssignModalVisible(false);
    } finally {
      setLoadingMembers(false);
    }
  };

  const assignDD = async (selectedUserId: string) => {
    setAssigningDD(true);
    try {
      // Check if assignment already exists
      const { data: existingAssignment } = await supabase
        .from('dd_assignments')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', selectedUserId)
        .single();

      if (existingAssignment) {
        // Update existing assignment
        const { error } = await supabase
          .from('dd_assignments')
          .update({
            status: 'assigned',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingAssignment.id);

        if (error) throw error;
      } else {
        // Create new assignment
        const { error } = await supabase.from('dd_assignments').insert({
          event_id: eventId,
          user_id: selectedUserId,
          status: 'assigned',
        });

        if (error) throw error;
      }

      Alert.alert('Success', 'DD assigned successfully');
      setAssignModalVisible(false);
      fetchEventDetails();
    } catch (error) {
      Alert.alert('Error', 'Failed to assign DD');
    } finally {
      setAssigningDD(false);
    }
  };

  const startSEPVerification = () => {
    // Navigate to SEP Reaction screen in 'attempt' mode with eventId
    navigation.navigate('SEPReaction', {
      mode: 'attempt',
      eventId: eventId,
    });
  };

  const goToActiveSession = () => {
    navigation.navigate('DDActiveSession', { eventId });
  };

  const renderMemberItem = ({ item }: { item: User }) => {
    const isAlreadyAssigned = ddAssignments.some(
      (assignment) => assignment.userId === item.id && assignment.status === 'assigned'
    );

    return (
      <TouchableOpacity
        style={[styles.memberItem, isAlreadyAssigned && styles.memberItemAssigned]}
        onPress={() => assignDD(item.id)}
        disabled={assigningDD}
      >
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
          {item.isDD && (
            <View style={styles.ddBadge}>
              <Text style={styles.ddBadgeText}>DD</Text>
            </View>
          )}
        </View>
        {isAlreadyAssigned && (
          <View style={styles.assignedIndicator}>
            <Text style={styles.assignedText}>✓ Assigned</Text>
          </View>
        )}
      </TouchableOpacity>
    );
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
        return colors.brand.primary;
      case 'active':
        return colors.ui.success;
      case 'completed':
        return colors.text.tertiary;
      default:
        return colors.text.tertiary;
    }
  };

  const handleMarkAsCompleted = async () => {
    Alert.alert(
      'Mark Event as Completed',
      'Are you sure you want to mark this event as completed? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Mark as Completed',
          style: 'destructive',
          onPress: async () => {
            setMarkingCompleted(true);
            try {
              const result = await markEventAsCompleted(eventId);
              
              if (result.success) {
                Alert.alert('Success', 'Event marked as completed');
                fetchEventDetails(); // Refresh to show updated status
              } else {
                Alert.alert('Error', result.error || 'Failed to mark event as completed');
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to mark event as completed');
            } finally {
              setMarkingCompleted(false);
            }
          },
        },
      ]
    );
  };

  const renderDDStatusSection = () => {
    
    // Check if user is globally revoked as a DD
    if (user?.ddStatus === 'revoked') {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your DD Status</Text>
          <View style={[styles.statusBox, { backgroundColor: '#FFEBEE' }]}>
            <Text style={[styles.statusBoxText, { color: '#C62828' }]}>
              ✗ Your DD privileges have been revoked
            </Text>
          </View>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              You failed SEP verification and can no longer serve as a DD. An admin must reinstate you to regain DD privileges.
            </Text>
          </View>
        </View>
      );
    }
    
    if (!user?.isDD) {
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            You are not registered as a DD. To become a DD, update your profile settings.
          </Text>
        </View>
      );
    }

    // User has an active session
    if (activeSession) {
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your DD Status</Text>
          <View style={[styles.statusBox, { backgroundColor: '#E8F5E9' }]}>
            <Text style={[styles.statusBoxText, { color: '#2E7D32' }]}>
              ✓ You have an active DD session
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={goToActiveSession}>
            <Text style={styles.primaryButtonText}>Go to Active Session</Text>
          </TouchableOpacity>
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
            <TouchableOpacity style={styles.primaryButton} onPress={startSEPVerification}>
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

    // Check if event is completed
    if (event.status === 'completed') {
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            This event has been completed. DD requests are no longer available.
          </Text>
        </View>
      );
    }

    // Admins should use "Assign DD" instead of requesting
    if (user?.role === 'admin') {
      return (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            As an admin, you can assign yourself as a DD using the "Assign DD" button below.
          </Text>
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
        <ActivityIndicator size="large" color={colors.brand.primary} />
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
          <TouchableOpacity style={styles.secondaryButton} onPress={openAssignModal}>
            <Text style={styles.secondaryButtonText}>Assign DD</Text>
          </TouchableOpacity>
          
          {event.status !== 'completed' && (
            <TouchableOpacity
              style={[styles.secondaryButton, styles.completeButton, markingCompleted && styles.buttonDisabled]}
              onPress={handleMarkAsCompleted}
              disabled={markingCompleted}
            >
              {markingCompleted ? (
                <ActivityIndicator color="#8E8E93" size="small" />
              ) : (
                <Text style={[styles.secondaryButtonText, styles.completeButtonText]}>
                  Mark as Completed
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Assign DD Modal */}
      <Modal
        visible={assignModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign DD</Text>
              <TouchableOpacity
                onPress={() => setAssignModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {loadingMembers ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="large" color={colors.brand.primary} />
              </View>
            ) : (
              <FlatList
                data={groupMembers}
                keyExtractor={(item) => item.id}
                renderItem={renderMemberItem}
                contentContainerStyle={styles.membersList}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No members found</Text>
                  </View>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg.canvas,
  },
  errorText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
  header: {
    backgroundColor: colors.bg.surface,
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
    color: colors.text.primary,
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
    backgroundColor: colors.bg.surface,
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
    color: colors.text.primary,
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
    color: colors.text.primary,
    flex: 1,
  },
  descriptionContainer: {
    marginTop: 8,
  },
  descriptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: 4,
  },
  descriptionText: {
    fontSize: 14,
    color: colors.text.primary,
    lineHeight: 20,
  },
  infoBox: {
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  infoText: {
    fontSize: 14,
    color: colors.text.secondary,
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
    backgroundColor: colors.brand.primary,
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
    backgroundColor: 'transparent',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.bg.elevated,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.bg.elevated,
  },
  completeButton: {
    borderColor: colors.text.tertiary,
  },
  completeButtonText: {
    color: colors.text.tertiary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  ddCard: {
    backgroundColor: colors.bg.input,
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
    color: colors.text.primary,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.bg.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.bg.input,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.text.secondary,
  },
  modalLoadingContainer: {
    padding: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersList: {
    padding: 16,
  },
  memberItem: {
    backgroundColor: colors.bg.input,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberItemAssigned: {
    backgroundColor: colors.bg.surface,
    borderWidth: 1,
    borderColor: colors.ui.success,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: 4,
  },
  memberEmail: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  ddBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.brand.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginTop: 4,
  },
  ddBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  assignedIndicator: {
    marginLeft: 12,
  },
  assignedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.ui.success,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: colors.text.secondary,
  },
});
