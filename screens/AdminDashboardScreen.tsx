import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DDRequest, Event, User } from '../types/database.types';

interface DDRequestWithDetails extends DDRequest {
  user: User;
  event: Event;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<DDRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  const fetchPendingRequests = async () => {
    if (!user?.groupId || user.role !== 'admin') {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      // Fetch pending DD requests for events in the admin's group
      const { data: requestsData, error: requestsError } = await supabase
        .from('dd_requests')
        .select(`
          *,
          users!dd_requests_user_id_fkey (*),
          events!dd_requests_event_id_fkey (*)
        `)
        .eq('status', 'pending')
        .eq('events.group_id', user.groupId)
        .order('created_at', { ascending: false });

      if (requestsError) throw requestsError;

      // Map snake_case to camelCase
      const mappedRequests: DDRequestWithDetails[] = (requestsData || []).map((request) => ({
        id: request.id,
        eventId: request.event_id,
        userId: request.user_id,
        status: request.status,
        createdAt: new Date(request.created_at),
        user: {
          id: request.users.id,
          email: request.users.email,
          name: request.users.name,
          birthday: new Date(request.users.birthday),
          age: request.users.age,
          gender: request.users.gender,
          groupId: request.users.group_id,
          role: request.users.role,
          isDD: request.users.is_dd,
          carMake: request.users.car_make,
          carModel: request.users.car_model,
          carPlate: request.users.car_plate,
          licensePhotoUrl: request.users.license_photo_url,
          createdAt: new Date(request.users.created_at),
          updatedAt: new Date(request.users.updated_at),
        },
        event: {
          id: request.events.id,
          groupId: request.events.group_id,
          name: request.events.name,
          description: request.events.description,
          dateTime: new Date(request.events.date_time),
          locationText: request.events.location_text,
          status: request.events.status,
          createdByUserId: request.events.created_by_user_id,
          createdAt: new Date(request.events.created_at),
        },
      }));

      setPendingRequests(mappedRequests);
    } catch (error) {
      console.error('Error fetching pending requests:', error);
      Alert.alert('Error', 'Failed to load pending requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPendingRequests();
  }, [user?.groupId]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests();
    }, [user?.groupId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingRequests();
  };

  const approveRequest = async (request: DDRequestWithDetails) => {
    setProcessingRequestId(request.id);

    try {
      // Start a transaction-like operation
      // 1. Create or update DDAssignment with status 'assigned'
      const { error: assignmentError } = await supabase
        .from('dd_assignments')
        .upsert({
          event_id: request.eventId,
          user_id: request.userId,
          status: 'assigned',
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'event_id,user_id',
        });

      if (assignmentError) throw assignmentError;

      // 2. Update DDRequest status to 'approved'
      const { error: requestError } = await supabase
        .from('dd_requests')
        .update({ status: 'approved' })
        .eq('id', request.id);

      if (requestError) throw requestError;

      // Remove from local state
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));

      Alert.alert('Success', `${request.user.name} has been approved as DD for ${request.event.name}`);
    } catch (error) {
      console.error('Error approving request:', error);
      Alert.alert('Error', 'Failed to approve request. Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const rejectRequest = async (request: DDRequestWithDetails) => {
    setProcessingRequestId(request.id);

    try {
      // Update DDRequest status to 'rejected'
      const { error } = await supabase
        .from('dd_requests')
        .update({ status: 'rejected' })
        .eq('id', request.id);

      if (error) throw error;

      // Remove from local state
      setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));

      Alert.alert('Request Rejected', `${request.user.name}'s request has been rejected`);
    } catch (error) {
      console.error('Error rejecting request:', error);
      Alert.alert('Error', 'Failed to reject request. Please try again.');
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleApprove = (request: DDRequestWithDetails) => {
    Alert.alert(
      'Approve DD Request',
      `Approve ${request.user.name} as DD for ${request.event.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => approveRequest(request) },
      ]
    );
  };

  const handleReject = (request: DDRequestWithDetails) => {
    Alert.alert(
      'Reject DD Request',
      `Reject ${request.user.name}'s request for ${request.event.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reject', style: 'destructive', onPress: () => rejectRequest(request) },
      ]
    );
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderRequestCard = (request: DDRequestWithDetails) => {
    const isProcessing = processingRequestId === request.id;

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <Text style={styles.userName}>{request.user.name}</Text>
          <Text style={styles.requestTime}>{formatDateTime(request.createdAt)}</Text>
        </View>
        
        <Text style={styles.eventName}>📅 {request.event.name}</Text>
        <Text style={styles.eventDateTime}>{formatDateTime(request.event.dateTime)}</Text>
        
        {request.user.carMake && (
          <Text style={styles.carInfo}>
            🚗 {request.user.carMake} {request.user.carModel} • {request.user.carPlate}
          </Text>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.rejectButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleReject(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reject</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.approveButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleApprove(request)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Approve</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No pending DD requests</Text>
      <Text style={styles.emptySubtext}>Requests will appear here when members apply to be DDs</Text>
    </View>
  );

  if (user?.role !== 'admin') {
    return (
      <View style={styles.container}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Admin Access Required</Text>
          <Text style={styles.emptySubtext}>This section is only available to admins</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={pendingRequests.length === 0 ? styles.emptyScrollContent : styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pending DD Requests</Text>
          {pendingRequests.length === 0 ? (
            renderEmptyState()
          ) : (
            pendingRequests.map(renderRequestCard)
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SEP Alerts</Text>
          <View style={styles.comingSoonCard}>
            <Text style={styles.comingSoonText}>Coming soon...</Text>
          </View>
        </View>
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
  scrollContent: {
    padding: 16,
  },
  emptyScrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
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
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  requestTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  eventName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000',
    marginBottom: 4,
  },
  eventDateTime: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  carInfo: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  comingSoonCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comingSoonText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
