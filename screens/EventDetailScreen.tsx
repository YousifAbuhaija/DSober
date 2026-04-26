import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useRoute, useNavigation, RouteProp, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event, DDAssignment, DDRequest, User } from '../types/database.types';
import { markEventAsCompleted } from '../utils/eventStatus';
import { colors, spacing, typography, radii } from '../theme';
import Avatar from '../components/ui/Avatar';
import StatusPill from '../components/ui/StatusPill';
import Button from '../components/ui/Button';
import SheetModal from '../components/ui/SheetModal';
import LoadingScreen from '../components/ui/LoadingScreen';

type EventsStackParamList = {
  EventsList: undefined;
  EventDetail: { eventId: string };
  CreateEvent: undefined;
  SEPReaction: { mode: 'baseline' | 'attempt'; eventId?: string };
  SEPPhrase: { mode: 'baseline' | 'attempt'; reactionAvgMs: number; eventId?: string };
  SEPSelfie: { mode: 'baseline' | 'attempt'; reactionAvgMs: number; phraseDurationSec: number; audioUrl: string; eventId?: string };
  DDActiveSession: { eventId: string };
};

type EventDetailRouteProp = RouteProp<EventsStackParamList, 'EventDetail'>;
type NavigationProp = StackNavigationProp<EventsStackParamList, 'EventDetail'>;

interface DDAssignmentWithUser extends DDAssignment {
  userName: string;
  userEmail: string;
}

function SectionLabel({ title }: { title: string }) {
  return (
    <View style={styles.sectionLabel}>
      <Text style={styles.sectionLabelText}>{title}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
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
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [groupMembers, setGroupMembers] = useState<User[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigningDD, setAssigningDD] = useState(false);
  const [activeSession, setActiveSession] = useState<any>(null);
  const [markingCompleted, setMarkingCompleted] = useState(false);

  useEffect(() => { fetchEventDetails(); }, [eventId]);

  useFocusEffect(React.useCallback(() => { fetchEventDetails(); }, [eventId]));

  const fetchEventDetails = async () => {
    try {
      if (!eventId || eventId === '') {
        Alert.alert('Error', 'Invalid event ID.');
        navigation.goBack();
        return;
      }

      setUserDDRequest(null);
      setUserDDAssignment(null);
      setActiveSession(null);

      const { data: eventData, error: eventError } = await supabase
        .from('events').select('*').eq('id', eventId).single();
      if (eventError) throw eventError;

      setEvent({
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

      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('dd_assignments')
        .select('*, users!dd_assignments_user_id_fkey (name, email)')
        .eq('event_id', eventId);
      if (assignmentsError) throw assignmentsError;

      const mappedAssignments: DDAssignmentWithUser[] = (assignmentsData || []).map((a) => ({
        id: a.id, eventId: a.event_id, userId: a.user_id,
        status: a.status, updatedAt: new Date(a.updated_at),
        userName: a.users?.name || 'Unknown', userEmail: a.users?.email || '',
      }));
      setDDAssignments(mappedAssignments);

      if (user?.id) {
        const { data: requestData } = await supabase
          .from('dd_requests').select('*')
          .eq('event_id', eventId).eq('user_id', user.id)
          .in('status', ['pending', 'approved', 'rejected'])
          .order('created_at', { ascending: false }).limit(1).single();
        if (requestData) {
          setUserDDRequest({ id: requestData.id, eventId: requestData.event_id, userId: requestData.user_id, status: requestData.status, createdAt: new Date(requestData.created_at) });
        }

        const userAssignment = mappedAssignments.find((a) => a.userId === user.id);
        if (userAssignment) setUserDDAssignment(userAssignment);

        const { data: sessionData } = await supabase
          .from('dd_sessions').select('*')
          .eq('user_id', user.id).eq('event_id', eventId).eq('is_active', true)
          .order('started_at', { ascending: false }).limit(1).single();
        if (sessionData) setActiveSession(sessionData);
      }
    } catch {
      Alert.alert('Error', 'Failed to load event details');
    } finally {
      setLoading(false);
    }
  };

  const requestToBeDD = async () => {
    if (!user?.id) return;
    setRequestingDD(true);
    try {
      const { data: existing } = await supabase
        .from('dd_requests').select('id, status').eq('event_id', eventId).eq('user_id', user.id).single();
      if (existing) {
        await supabase.from('dd_requests').update({ status: 'pending' }).eq('id', existing.id);
      } else {
        await supabase.from('dd_requests').insert({ event_id: eventId, user_id: user.id, status: 'pending' });
      }
      Alert.alert('Request Sent', 'Your DD request has been submitted to the admin.');
      fetchEventDetails();
    } catch {
      Alert.alert('Error', 'Failed to submit DD request');
    } finally {
      setRequestingDD(false);
    }
  };

  const openAssignModal = async () => {
    setAssignModalVisible(true);
    setLoadingMembers(true);
    try {
      const { data: userData, error } = await supabase.from('users').select('*').eq('group_id', user?.groupId).eq('is_dd', true);
      if (error) throw error;
      setGroupMembers((userData || []).map((u) => ({
        id: u.id, email: u.email, name: u.name, birthday: new Date(u.birthday),
        age: u.age, gender: u.gender, groupId: u.group_id, role: u.role, isDD: u.is_dd,
        ddStatus: u.dd_status, carMake: u.car_make, carModel: u.car_model, carPlate: u.car_plate,
        phoneNumber: u.phone_number, licensePhotoUrl: u.license_photo_url,
        profilePhotoUrl: u.profile_photo_url, createdAt: new Date(u.created_at), updatedAt: new Date(u.updated_at),
      })));
    } catch {
      Alert.alert('Error', 'Failed to load members');
      setAssignModalVisible(false);
    } finally {
      setLoadingMembers(false);
    }
  };

  const assignDD = async (selectedUserId: string) => {
    setAssigningDD(true);
    try {
      const { data: existing } = await supabase
        .from('dd_assignments').select('*').eq('event_id', eventId).eq('user_id', selectedUserId).single();
      if (existing) {
        await supabase.from('dd_assignments').update({ status: 'assigned', updated_at: new Date().toISOString() }).eq('id', existing.id);
      } else {
        await supabase.from('dd_assignments').insert({ event_id: eventId, user_id: selectedUserId, status: 'assigned' });
      }
      Alert.alert('Assigned', 'DD assigned successfully.');
      setAssignModalVisible(false);
      fetchEventDetails();
    } catch {
      Alert.alert('Error', 'Failed to assign DD');
    } finally {
      setAssigningDD(false);
    }
  };

  const handleMarkAsCompleted = () => {
    Alert.alert('Mark as Completed', 'This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Completed', style: 'destructive',
        onPress: async () => {
          setMarkingCompleted(true);
          try {
            const result = await markEventAsCompleted(eventId);
            if (result.success) { Alert.alert('Done', 'Event marked as completed'); fetchEventDetails(); }
            else Alert.alert('Error', result.error || 'Failed');
          } catch { Alert.alert('Error', 'Failed to mark as completed'); }
          finally { setMarkingCompleted(false); }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!event) return <LoadingScreen />;

  const formatDateTime = (date: Date) =>
    date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) +
    ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const renderDDStatus = () => {
    if (user?.ddStatus === 'revoked') {
      return <StatusBanner icon="close-circle" color={colors.ui.error} text="Your DD privileges have been revoked" subtitle="An admin must reinstate you." />;
    }
    if (!user?.isDD) {
      return <StatusBanner icon="information-circle-outline" color={colors.text.tertiary} text="Not registered as a DD" subtitle="Update your profile to become a DD." />;
    }
    if (activeSession) {
      return (
        <View>
          <StatusBanner icon="flash" color={colors.ui.success} text="You have an active DD session" />
          <Button label="Go to Active Session" onPress={() => navigation.navigate('DDActiveSession', { eventId })} style={styles.actionBtn} fullWidth />
        </View>
      );
    }
    if (userDDAssignment?.status === 'assigned') {
      return (
        <View>
          <StatusBanner icon="checkmark-circle" color={colors.ui.success} text="You are assigned as DD for this event" />
          <Button label="Start SEP Verification" onPress={() => navigation.navigate('SEPReaction', { mode: 'attempt', eventId })} style={styles.actionBtn} fullWidth />
        </View>
      );
    }
    if (userDDAssignment?.status === 'revoked') {
      return <StatusBanner icon="close-circle" color={colors.ui.error} text="Your DD assignment has been revoked" />;
    }
    if (userDDRequest?.status === 'pending') {
      return <StatusBanner icon="time-outline" color={colors.ui.warning} text="DD request pending admin approval" />;
    }
    if (userDDRequest?.status === 'rejected') {
      return <StatusBanner icon="close-circle-outline" color={colors.ui.error} text="DD request was not approved" />;
    }
    if (event.status === 'completed') {
      return <StatusBanner icon="checkmark-done-outline" color={colors.text.tertiary} text="Event completed — DD requests closed" />;
    }
    if (user?.role === 'admin') {
      return <StatusBanner icon="information-circle-outline" color={colors.text.tertiary} text="Use 'Assign DD' below to assign yourself" />;
    }
    return (
      <Button
        label="Request to be DD"
        onPress={requestToBeDD}
        loading={requestingDD}
        style={styles.actionBtn}
        fullWidth
      />
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.eventName}>{event.name}</Text>
          <StatusPill status={event.status as any} />
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={15} color={colors.text.tertiary} />
          <Text style={styles.metaText}>{formatDateTime(event.dateTime)}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={15} color={colors.text.tertiary} />
          <Text style={styles.metaText}>{event.locationText}</Text>
        </View>
      </View>

      {/* Description */}
      {event.description ? (
        <>
          <SectionLabel title="About" />
          <View style={styles.section}>
            <Text style={styles.descriptionText}>{event.description}</Text>
          </View>
        </>
      ) : null}

      {/* Find DDs shortcut */}
      {event.status !== 'completed' && (
        <>
          <SectionLabel title="Designated Drivers" />
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.adminRow}
              onPress={() => navigation.navigate('DDs' as any, { screen: 'DDsList', params: { initialEventId: event.id } })}
              activeOpacity={0.7}
            >
              <View style={styles.adminRowLeft}>
                <Ionicons name="car-outline" size={20} color={colors.text.secondary} style={styles.adminIcon} />
                <View>
                  <Text style={styles.adminRowText}>Find a DD for this event</Text>
                  <Text style={styles.adminRowSub}>See who's on duty and request a ride</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* DD Status */}
      <SectionLabel title="Your DD Status" />
      <View style={styles.section}>
        {renderDDStatus()}
      </View>

      {/* Assigned DDs */}
      {ddAssignments.length > 0 && (
        <>
          <SectionLabel title="Assigned DDs" />
          <View style={styles.section}>
            {ddAssignments.map((a, i) => (
              <View key={a.id}>
                <View style={styles.ddRow}>
                  <Avatar name={a.userName} size={36} />
                  <View style={styles.ddInfo}>
                    <Text style={styles.ddName}>{a.userName}</Text>
                    <Text style={styles.ddEmail}>{a.userEmail}</Text>
                  </View>
                  <StatusPill status={a.status === 'assigned' ? 'active' : 'revoked' as any} label={a.status === 'assigned' ? 'Assigned' : 'Revoked'} />
                </View>
                {i < ddAssignments.length - 1 && <Divider />}
              </View>
            ))}
          </View>
        </>
      )}

      {/* Admin Actions */}
      {user?.role === 'admin' && (
        <>
          <SectionLabel title="Admin" />
          <View style={styles.section}>
            <TouchableOpacity style={styles.adminRow} onPress={openAssignModal} activeOpacity={0.7}>
              <View style={styles.adminRowLeft}>
                <Ionicons name="person-add-outline" size={20} color={colors.text.secondary} style={styles.adminIcon} />
                <Text style={styles.adminRowText}>Assign DD</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
            </TouchableOpacity>

            {event.status !== 'completed' && (
              <>
                <Divider />
                <TouchableOpacity
                  style={[styles.adminRow, markingCompleted && { opacity: 0.5 }]}
                  onPress={handleMarkAsCompleted}
                  disabled={markingCompleted}
                  activeOpacity={0.7}
                >
                  <View style={styles.adminRowLeft}>
                    {markingCompleted
                      ? <ActivityIndicator size="small" color={colors.text.tertiary} style={styles.adminIcon} />
                      : <Ionicons name="checkmark-done-outline" size={20} color={colors.text.tertiary} style={styles.adminIcon} />
                    }
                    <Text style={[styles.adminRowText, { color: colors.text.secondary }]}>Mark as Completed</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}

      {/* Assign DD Sheet */}
      <SheetModal visible={assignModalVisible} onClose={() => setAssignModalVisible(false)} title="Assign DD">
        {loadingMembers ? (
          <View style={styles.sheetLoading}>
            <ActivityIndicator color={colors.brand.primary} />
          </View>
        ) : (
          <FlatList
            data={groupMembers}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const isAssigned = ddAssignments.some(a => a.userId === item.id && a.status === 'assigned');
              return (
                <TouchableOpacity
                  style={[styles.memberRow, isAssigned && styles.memberRowAssigned]}
                  onPress={() => assignDD(item.id)}
                  disabled={assigningDD}
                  activeOpacity={0.7}
                >
                  <Avatar name={item.name} size={36} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberSub}>{item.isDD ? 'Registered DD' : 'Member'}</Text>
                  </View>
                  {isAssigned
                    ? <Ionicons name="checkmark-circle" size={20} color={colors.ui.success} />
                    : <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
                  }
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.emptyText}>No registered DDs in your chapter yet</Text>}
          />
        )}
      </SheetModal>
    </ScrollView>
  );
}

function StatusBanner({ icon, color, text, subtitle }: { icon: keyof typeof Ionicons.glyphMap; color: string; text: string; subtitle?: string }) {
  return (
    <View style={[styles.statusBanner, { borderLeftColor: color }]}>
      <Ionicons name={icon} size={18} color={color} style={styles.statusBannerIcon} />
      <View style={{ flex: 1 }}>
        <Text style={styles.statusBannerText}>{text}</Text>
        {subtitle ? <Text style={styles.statusBannerSub}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: 48 },

  // Header
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  eventName: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    flex: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 14,
    color: colors.text.secondary,
    flex: 1,
    lineHeight: 20,
  },

  // Sections
  sectionLabel: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },

  // Description
  descriptionText: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: 2,
    marginBottom: spacing.sm,
  },
  statusBannerIcon: { marginRight: spacing.sm, marginTop: 1 },
  statusBannerText: { fontSize: 15, fontWeight: '500', color: colors.text.primary, lineHeight: 22 },
  statusBannerSub: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },

  actionBtn: { marginTop: spacing.md },

  // Assigned DDs
  ddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  ddInfo: { flex: 1, marginLeft: spacing.md },
  ddName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  ddEmail: { fontSize: 13, color: colors.text.secondary, marginTop: 1 },

  // Admin rows
  adminRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  adminRowLeft: { flexDirection: 'row', alignItems: 'center' },
  adminIcon: { marginRight: spacing.md },
  adminRowText: { fontSize: 16, fontWeight: '600', color: colors.text.primary },
  adminRowSub: { fontSize: 13, color: colors.text.secondary, marginTop: 1 },

  // Sheet modal
  sheetLoading: { padding: 40, alignItems: 'center' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  memberRowAssigned: { opacity: 0.7 },
  memberInfo: { flex: 1, marginLeft: spacing.md },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.text.primary },
  memberSub: { fontSize: 13, color: colors.text.secondary, marginTop: 1 },
  emptyText: { textAlign: 'center', color: colors.text.secondary, padding: 24 },
});
