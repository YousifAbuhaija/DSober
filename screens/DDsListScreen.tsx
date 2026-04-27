import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useRoute, useFocusEffect, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Event } from '../types/database.types';
import { getCurrentLocation } from '../utils/location';
import { updateEventStatusesToActive } from '../utils/eventStatus';
import { mapEvent } from '../utils/mappers';
import Avatar from '../components/ui/Avatar';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import SectionHeader from '../components/ui/SectionHeader';
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

  const loadAll = useCallback(async () => {
    if (!user?.groupId) { setLoading(false); return; }
    try {
      getCurrentLocation().catch(() => setLocationDenied(true));
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
      if (mapped.length > 0) setSelectedEventId((id: string) => id || mapped[0].id);
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

  useEffect(() => {
    if (selectedEventId) loadDDs(selectedEventId);
  }, [selectedEventId]);

  const handleCall = async (phone: string | undefined) => {
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
            <View style={styles.chip}>
              <Text style={styles.chipText}>No active events</Text>
            </View>
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
                  <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                    {ev.name}
                  </Text>
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
        contentContainerStyle={activeDDs.length === 0 ? styles.emptyList : undefined}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadAll(); }}
            tintColor={colors.brand.primary}
          />
        }
        ListHeaderComponent={
          activeDDs.length > 0
            ? <SectionHeader title={`AVAILABLE DRIVERS (${activeDDs.length})`} />
            : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="car-outline"
            title="No active DDs"
            subtitle={
              selectedEventId
                ? 'No designated drivers are on duty for this event.'
                : 'Select an event to see active DDs.'
            }
          />
        }
        renderItem={({ item, index }) => (
          <DDRow
            dd={item}
            isLast={index === activeDDs.length - 1}
            onPress={() => navigation.navigate('DDDetail', { ddUserId: item.userId, eventId: selectedEventId })}
            onCall={() => handleCall(item.phoneNumber)}
          />
        )}
        ListFooterComponent={activeDDs.length > 0 ? <View style={{ height: spacing['3xl'] }} /> : null}
      />
    </View>
  );
}

function DDRow({
  dd, isLast, onPress, onCall,
}: { dd: ActiveDD; isLast: boolean; onPress: () => void; onCall: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.row, !isLast && styles.rowBorder]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Avatar uri={dd.profilePhotoUrl} name={dd.name} size={40} />
      <View style={styles.rowInfo}>
        <Text style={styles.ddName} numberOfLines={1}>{dd.name}</Text>
        {dd.carMake && dd.carModel ? (
          <View style={styles.carRow}>
            <Ionicons name="car-outline" size={12} color={colors.text.tertiary} />
            <Text style={styles.carText} numberOfLines={1}>
              {dd.carMake} {dd.carModel}{dd.carPlate ? `  ·  ${dd.carPlate}` : ''}
            </Text>
          </View>
        ) : null}
      </View>
      {dd.phoneNumber ? (
        <TouchableOpacity
          onPress={(e) => { e.stopPropagation(); onCall(); }}
          style={styles.callButton}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="call-outline" size={18} color={colors.ui.success} />
        </TouchableOpacity>
      ) : null}
      <Ionicons name="chevron-forward" size={16} color={colors.text.tertiary} />
    </TouchableOpacity>
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
  chips: { paddingHorizontal: spacing.base, gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    height: 34,
    borderRadius: radii.sm,
    backgroundColor: colors.bg.input,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.brand.primary },
  chipText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600', fontSize: 13 },
  chipTextActive: { color: colors.text.primary },

  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    backgroundColor: `${colors.ui.warning}15`,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  locationBannerText: { ...typography.caption, color: colors.ui.warning },

  emptyList: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.surface,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    minHeight: 64,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  rowInfo: { flex: 1, minWidth: 0 },
  ddName: { ...typography.bodyBold, color: colors.text.primary, marginBottom: 3 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  carText: { ...typography.caption, color: colors.text.tertiary, flex: 1 },
  callButton: { paddingHorizontal: spacing.sm },
});
