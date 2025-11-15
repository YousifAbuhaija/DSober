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
import { DDRequest, Event, User, AdminAlert, SEPAttempt, SEPBaseline } from '../types/database.types';

interface DDRequestWithDetails extends DDRequest {
  user: User;
  event: Event;
}

interface AdminAlertWithDetails extends AdminAlert {
  user: User;
  event: Event;
  sepAttempt: SEPAttempt;
  sepBaseline?: SEPBaseline;
}

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<DDRequestWithDetails[]>([]);
  const [sepAlerts, setSepAlerts] = useState<AdminAlertWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [processingAlertId, setProcessingAlertId] = useState<string | null>(null);

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
          ddStatus: request.users.dd_status,
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

  const fetchSEPAlerts = async () => {
    if (!user?.groupId || user.role !== 'admin') {
      return;
    }

    try {
      // Fetch unresolved SEP fail alerts for events in the admin's group
      const { data: alertsData, error: alertsError } = await supabase
        .from('admin_alerts')
        .select(`
          *,
          users!admin_alerts_user_id_fkey (*),
          events!admin_alerts_event_id_fkey (*),
          sep_attempts!admin_alerts_sep_attempt_id_fkey (*)
        `)
        .eq('type', 'SEP_FAIL')
        .is('resolved_at', null)
        .eq('events.group_id', user.groupId)
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;

      // For each alert, fetch the user's SEP baseline
      const alertsWithBaseline = await Promise.all(
        (alertsData || []).map(async (alert) => {
          const { data: baselineData } = await supabase
            .from('sep_baselines')
            .select('*')
            .eq('user_id', alert.user_id)
            .single();

          return {
            id: alert.id,
            type: alert.type,
            userId: alert.user_id,
            eventId: alert.event_id,
            sepAttemptId: alert.sep_attempt_id,
            createdAt: new Date(alert.created_at),
            resolvedByAdminId: alert.resolved_by_admin_id,
            resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : undefined,
            user: {
              id: alert.users.id,
              email: alert.users.email,
              name: alert.users.name,
              birthday: new Date(alert.users.birthday),
              age: alert.users.age,
              gender: alert.users.gender,
              groupId: alert.users.group_id,
              role: alert.users.role,
              isDD: alert.users.is_dd,
              ddStatus: alert.users.dd_status,
              carMake: alert.users.car_make,
              carModel: alert.users.car_model,
              carPlate: alert.users.car_plate,
              licensePhotoUrl: alert.users.license_photo_url,
              createdAt: new Date(alert.users.created_at),
              updatedAt: new Date(alert.users.updated_at),
            },
            event: {
              id: alert.events.id,
              groupId: alert.events.group_id,
              name: alert.events.name,
              description: alert.events.description,
              dateTime: new Date(alert.events.date_time),
              locationText: alert.events.location_text,
              status: alert.events.status,
              createdByUserId: alert.events.created_by_user_id,
              createdAt: new Date(alert.events.created_at),
            },
            sepAttempt: {
              id: alert.sep_attempts.id,
              userId: alert.sep_attempts.user_id,
              eventId: alert.sep_attempts.event_id,
              reactionAvgMs: alert.sep_attempts.reaction_avg_ms,
              phraseDurationSec: alert.sep_attempts.phrase_duration_sec,
              selfieUrl: alert.sep_attempts.selfie_url,
              result: alert.sep_attempts.result,
              createdAt: new Date(alert.sep_attempts.created_at),
            },
            sepBaseline: baselineData ? {
              id: baselineData.id,
              userId: baselineData.user_id,
              reactionAvgMs: baselineData.reaction_avg_ms,
              phraseDurationSec: baselineData.phrase_duration_sec,
              selfieUrl: baselineData.selfie_url,
              createdAt: new Date(baselineData.created_at),
            } : undefined,
          };
        })
      );

      setSepAlerts(alertsWithBaseline);
    } catch (error) {
      console.error('Error fetching SEP alerts:', error);
      Alert.alert('Error', 'Failed to load SEP alerts');
    }
  };

  useEffect(() => {
    fetchPendingRequests();
    fetchSEPAlerts();
  }, [user?.groupId]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchPendingRequests();
      fetchSEPAlerts();
    }, [user?.groupId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchPendingRequests();
    fetchSEPAlerts();
  };

  const approveRequest = async (request: DDRequestWithDetails) => {
    setProcessingRequestId(request.id);

    try {
      // Check if user's DD status is revoked
      if (request.user.ddStatus === 'revoked') {
        Alert.alert(
          'Cannot Approve',
          `${request.user.name} has a revoked DD status and cannot be approved. Please reinstate them first if appropriate.`
        );
        
        // Auto-reject the request
        await supabase
          .from('dd_requests')
          .update({ status: 'rejected' })
          .eq('id', request.id);
        
        // Remove from local state
        setPendingRequests((prev) => prev.filter((r) => r.id !== request.id));
        return;
      }

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

  const reinstateDD = async (alert: AdminAlertWithDetails) => {
    if (!user?.id) return;
    
    setProcessingAlertId(alert.id);

    try {
      // 1. Update user's dd_status back to 'active'
      const { error: userUpdateError } = await supabase
        .from('users')
        .update({ dd_status: 'active' })
        .eq('id', alert.userId);

      if (userUpdateError) throw userUpdateError;

      // 2. Update DDAssignment status to 'assigned'
      const { error: assignmentError } = await supabase
        .from('dd_assignments')
        .update({ 
          status: 'assigned',
          updated_at: new Date().toISOString(),
        })
        .eq('event_id', alert.eventId)
        .eq('user_id', alert.userId);

      if (assignmentError) throw assignmentError;

      // 3. Resolve ALL unresolved alerts for this user (not just this event)
      const { error: alertError } = await supabase
        .from('admin_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by_admin_id: user.id,
        })
        .eq('user_id', alert.userId)
        .is('resolved_at', null);

      if (alertError) throw alertError;

      // Remove all alerts for this user from local state
      setSepAlerts((prev) => prev.filter((a) => a.userId !== alert.userId));

      Alert.alert('DD Reinstated', `${alert.user.name} has been fully reinstated as DD`);
    } catch (error) {
      console.error('Error reinstating DD:', error);
      Alert.alert('Error', 'Failed to reinstate DD. Please try again.');
    } finally {
      setProcessingAlertId(null);
    }
  };

  const keepRevoked = async (alert: AdminAlertWithDetails) => {
    if (!user?.id) return;
    
    setProcessingAlertId(alert.id);

    try {
      // Resolve ALL unresolved alerts for this user and event, keep DDAssignment status as 'revoked'
      const { error } = await supabase
        .from('admin_alerts')
        .update({
          resolved_at: new Date().toISOString(),
          resolved_by_admin_id: user.id,
        })
        .eq('user_id', alert.userId)
        .eq('event_id', alert.eventId)
        .is('resolved_at', null);

      if (error) throw error;

      // Remove all alerts for this user/event from local state
      setSepAlerts((prev) => prev.filter((a) => 
        !(a.userId === alert.userId && a.eventId === alert.eventId)
      ));

      Alert.alert('Alert Resolved', `${alert.user.name} will remain revoked for ${alert.event.name}`);
    } catch (error) {
      console.error('Error resolving alert:', error);
      Alert.alert('Error', 'Failed to resolve alert. Please try again.');
    } finally {
      setProcessingAlertId(null);
    }
  };

  const handleReinstate = (alert: AdminAlertWithDetails) => {
    Alert.alert(
      'Reinstate DD',
      `Reinstate ${alert.user.name} as DD for ${alert.event.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reinstate', onPress: () => reinstateDD(alert) },
      ]
    );
  };

  const handleKeepRevoked = (alert: AdminAlertWithDetails) => {
    Alert.alert(
      'Keep Revoked',
      `Keep ${alert.user.name} revoked for ${alert.event.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Keep Revoked', style: 'destructive', onPress: () => keepRevoked(alert) },
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

  const renderAlertCard = (alert: AdminAlertWithDetails) => {
    const isProcessing = processingAlertId === alert.id;
    const baseline = alert.sepBaseline;
    const attempt = alert.sepAttempt;

    return (
      <View key={alert.id} style={styles.alertCard}>
        <View style={styles.alertHeader}>
          <Text style={styles.alertTitle}>⚠️ SEP Verification Failed</Text>
          <Text style={styles.alertTime}>{formatDateTime(alert.createdAt)}</Text>
        </View>

        <View style={styles.alertInfo}>
          <Text style={styles.userName}>{alert.user.name}</Text>
          <Text style={styles.eventName}>📅 {alert.event.name}</Text>
          <Text style={styles.eventDateTime}>{formatDateTime(alert.event.dateTime)}</Text>
        </View>

        {baseline && (
          <View style={styles.metricsContainer}>
            <Text style={styles.metricsTitle}>Performance Comparison:</Text>
            
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Reaction Time:</Text>
              <View style={styles.metricValues}>
                <Text style={styles.baselineValue}>
                  Baseline: {baseline.reactionAvgMs}ms
                </Text>
                <Text style={[
                  styles.attemptValue,
                  attempt.reactionAvgMs > baseline.reactionAvgMs + 150 && styles.failedValue
                ]}>
                  Attempt: {attempt.reactionAvgMs}ms
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Phrase Duration:</Text>
              <View style={styles.metricValues}>
                <Text style={styles.baselineValue}>
                  Baseline: {baseline.phraseDurationSec.toFixed(1)}s
                </Text>
                <Text style={[
                  styles.attemptValue,
                  attempt.phraseDurationSec > baseline.phraseDurationSec + 2 && styles.failedValue
                ]}>
                  Attempt: {attempt.phraseDurationSec.toFixed(1)}s
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.button, styles.revokeButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleKeepRevoked(alert)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Keep Revoked</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.reinstateButton, isProcessing && styles.buttonDisabled]}
            onPress={() => handleReinstate(alert)}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Reinstate DD</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderAlertsEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>No SEP alerts</Text>
      <Text style={styles.emptySubtext}>Alerts will appear here when DDs fail verification</Text>
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
          {sepAlerts.length === 0 ? (
            renderAlertsEmptyState()
          ) : (
            sepAlerts.map(renderAlertCard)
          )}
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
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF9500',
  },
  alertTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  alertInfo: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  metricsContainer: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  metricsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  metricRow: {
    marginBottom: 8,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
    marginBottom: 4,
  },
  metricValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingLeft: 8,
  },
  baselineValue: {
    fontSize: 13,
    color: '#34C759',
  },
  attemptValue: {
    fontSize: 13,
    color: '#666',
  },
  failedValue: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  reinstateButton: {
    backgroundColor: '#007AFF',
  },
  revokeButton: {
    backgroundColor: '#8E8E93',
  },
});
