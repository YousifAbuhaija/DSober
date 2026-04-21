import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp, RouteProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types/database.types';
import { getCurrentLocation } from '../utils/location';
import { updateEventStatusesToActive } from '../utils/eventStatus';
import { mapEvent } from '../utils/mappers';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type NavigationProp = StackNavigationProp<any>;
type RouteParams = { initialEventId?: string };

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
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const initialEventId = route.params?.initialEventId ?? '';
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState(initialEventId);
  const [activeDDs, setActiveDDs] = useState<ActiveDD[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const loadAll = useCallback(async () => {
    if (!user?.groupId) { setLoading(false); return; }
    try {
      getCurrentLocation()
        .then((loc) => setUserLocation(loc))
        .catch(() => setLocationDenied(true));

      await updateEventStatusesToActive(user.groupId);
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('group_id', user.groupId)
        .in('status', ['upcoming', 'active'])
        .order('date_time', { ascending: true });
      if (error) throw error;
      const mapped = (data || []).map(mapEvent);
      setEvents(mapped);
      if (mapped.length > 0) setSelectedEventId((id) => id || mapped[0].id);
    } catch {
      // silent — user can pull-to-refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.groupId]);

  const loadDDs = useCallback(async (eventId: string) => {
    if (!eventId) { setActiveDDs([]); return; }
    try {
      const { data: sessions } = await supabase
        .from('dd_sessions')
        .select('id, user_id')
        .eq('event_id', eventId)
        .eq('is_active', true);
      if (!sessions?.length) { setActiveDDs([]); return; }
      const userIds = sessions.map((s) => s.user_id);
      const { data: users } = await supabase
        .from('users')
        .select('id, name, car_make, car_model, car_plate, phone_number, profile_photo_url')
        .in('id', userIds);
      const dds: ActiveDD[] = (users || []).map((u) => ({
        userId: u.id,
        name: u.name,
        carMake: u.car_make ?? undefined,
        carModel: u.car_model ?? undefined,
        carPlate: u.car_plate ?? undefined,
        phoneNumber: u.phone_number ?? undefined,
        profilePhotoUrl: u.profile_photo_url ?? undefined,
        sessionId: sessions.find((s) => s.user_id === u.id)?.id ?? '',
      }));
      setActiveDDs(dds);
    } catch {
      setActiveDDs([]);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (initialEventId) setSelectedEventId(initialEventId);
    loadAll();
  }, [user?.groupId, initialEventId]));

  useFocusEffect(useCallback(() => {
    if (selectedEventId) loadDDs(selectedEventId);
  }, [selectedEventId]));

  const handleCall = async (phone: string | undefined, name: string) => {
    if (!phone) return;
    const url = `tel:${phone.replace(/\D/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  if (loading) return <LoadingScreen message="Finding DDs…" />;

  return (
    <View style={styles.container}>
      {/* Event selector */}
      <View style={styles.selectorBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {events.length === 0 ? (
            <View style={styles.chip}><Text style={styles.chipText}>No active events</Text></View>
          ) : (
            events.map((ev) => {
              const active = selectedEventId === ev.id;
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedEventId(ev.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{ev.name}</Text>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>

      {locationDenied && (
        <View style={styles.locationBanner}>
          <Ionicons name="location-outline" size={14} color={colors.ui.warning} />
          <Text style={styles.locationBannerText}>Location unavailable — distance hidden</Text>
        </View>
      )}

      <FlatList
        data={activeDDs}
        keyExtractor={(item) => item.userId}
        contentContainerStyle={activeDDs.length === 0 ? styles.emptyList : styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(); }}
            tintColor={colors.brand.primary}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No active DDs"
            subtitle={selectedEventId ? 'No designated drivers are on duty for this event.' : 'Select an event to see active DDs.'}
          />
        }
        renderItem={({ item }) => (
          <DDCard
            dd={item}
            onPress={() => navigation.navigate('DDDetail', { ddUserId: item.userId, eventId: selectedEventId })}
            onCall={() => handleCall(item.phoneNumber, item.name)}
          />
        )}
      />
    </View>
  );
}

function DDCard({ dd, onPress, onCall }: { dd: ActiveDD; onPress: () => void; onCall: () => void }) {
  return (
    <Card style={styles.ddCard} elevated>
      <TouchableOpacity style={styles.ddBody} onPress={onPress} activeOpacity={0.8}>
        <Avatar uri={dd.profilePhotoUrl} name={dd.name} size={48} />
        <View style={styles.ddInfo}>
          <Text style={styles.ddName}>{dd.name}</Text>
          {dd.carMake && dd.carModel ? (
            <View style={styles.carRow}>
              <Ionicons name="car-outline" size={13} color={colors.text.tertiary} />
              <Text style={styles.carText}>{dd.carMake} {dd.carModel}</Text>
              {dd.carPlate ? <Text style={styles.platePill}>{dd.carPlate}</Text> : null}
            </View>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.text.tertiary} />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.callBar, !dd.phoneNumber && styles.callBarDisabled]}
        onPress={onCall}
        disabled={!dd.phoneNumber}
        activeOpacity={0.8}
      >
        <Ionicons
          name="call-outline"
          size={16}
          color={dd.phoneNumber ? colors.ui.success : colors.text.tertiary}
        />
        <Text style={[styles.callText, !dd.phoneNumber && styles.callTextDisabled]}>
          {dd.phoneNumber ?? 'No phone number'}
        </Text>
      </TouchableOpacity>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  selectorBar: {
    backgroundColor: colors.bg.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingVertical: spacing.sm,
  },
  chips: { paddingHorizontal: spacing.xl, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radii.full,
    backgroundColor: colors.bg.muted,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  chipActive: {
    backgroundColor: colors.brand.faint,
    borderColor: colors.brand.primary,
  },
  chipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '500' },
  chipTextActive: { color: colors.brand.primary, fontWeight: '600' },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.ui.warning}15`,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  locationBannerText: { ...typography.caption, color: colors.ui.warning },
  list: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  emptyList: { flex: 1, padding: spacing.xl },
  ddCard: { marginBottom: spacing.md, padding: 0, overflow: 'hidden' },
  ddBody: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.md,
  },
  ddInfo: { flex: 1 },
  ddName: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.xs },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  carText: { ...typography.caption, color: colors.text.tertiary },
  platePill: {
    ...typography.caption,
    color: colors.text.secondary,
    backgroundColor: colors.bg.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    fontWeight: '600',
    overflow: 'hidden',
  },
  callBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.base,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.elevated,
  },
  callBarDisabled: { backgroundColor: colors.bg.surface },
  callText: { ...typography.callout, color: colors.ui.success, fontWeight: '600' },
  callTextDisabled: { color: colors.text.tertiary },
});
