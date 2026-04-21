import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, RouteProp, useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { User, SEPBaseline, RideRequest } from '../types/database.types';
import { useAuth } from '../contexts/AuthContext';
import { getCurrentLocation } from '../utils/location';
import { colors, spacing, typography } from '../theme';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import SheetModal from '../components/ui/SheetModal';
import LoadingScreen from '../components/ui/LoadingScreen';

type DDsStackParamList = {
  DDsList: undefined;
  DDDetail: { ddUserId: string; eventId?: string };
  RideStatus: { eventId: string };
};
type DDDetailRouteProp = RouteProp<DDsStackParamList, 'DDDetail'>;
type NavigationProp = StackNavigationProp<DDsStackParamList, 'DDDetail'>;

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

const STATUS_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending:   'time-outline',
  accepted:  'checkmark-circle',
  picked_up: 'car',
};
const STATUS_COLOR: Record<string, string> = {
  pending:   colors.ui.warning,
  accepted:  colors.ui.success,
  picked_up: colors.brand.primary,
};
const STATUS_LABEL: Record<string, string> = {
  pending:   'Request pending — waiting for driver',
  accepted:  'Request accepted — driver heading your way',
  picked_up: 'Driver picked you up',
};

export default function DDDetailScreen() {
  const route = useRoute<DDDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { ddUserId, eventId } = route.params;
  const { user } = useAuth();

  const [ddUser, setDDUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [existingRequest, setExistingRequest] = useState<RideRequest | null>(null);
  const [requestSheetVisible, setRequestSheetVisible] = useState(false);
  const [pickupLocation, setPickupLocation] = useState('');
  const [pickupError, setPickupError] = useState('');
  const [requestingRide, setRequestingRide] = useState(false);

  useEffect(() => { fetchDDDetails(); }, [ddUserId]);

  useFocusEffect(useCallback(() => {
    if (eventId && user) checkExistingRequest();
  }, [eventId, user]));

  useEffect(() => {
    const unsub = navigation.addListener('state', () => {
      if (eventId && user) setTimeout(() => checkExistingRequest(), 100);
    });
    return unsub;
  }, [navigation, eventId, user]);

  const fetchDDDetails = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('users').select('*').eq('id', ddUserId).single();
      if (error) throw error;
      if (data) {
        setDDUser({
          id: data.id, email: data.email, name: data.name,
          birthday: new Date(data.birthday), age: data.age, gender: data.gender,
          groupId: data.group_id, role: data.role, isDD: data.is_dd, ddStatus: data.dd_status,
          carMake: data.car_make, carModel: data.car_model, carPlate: data.car_plate,
          phoneNumber: data.phone_number, licensePhotoUrl: data.license_photo_url,
          profilePhotoUrl: data.profile_photo_url,
          createdAt: new Date(data.created_at), updatedAt: new Date(data.updated_at),
        });
      }
    } catch {
      Alert.alert('Error', 'Failed to load driver details');
    } finally {
      setLoading(false);
    }
  };

  const checkExistingRequest = async () => {
    if (!user || !eventId) return;
    try {
      const { data, error } = await supabase
        .from('ride_requests').select('*')
        .eq('rider_user_id', user.id).eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up']).maybeSingle();
      if (error && error.code !== 'PGRST116') return;
      if (data) {
        setExistingRequest({
          id: data.id, ddUserId: data.dd_user_id, riderUserId: data.rider_user_id,
          eventId: data.event_id, pickupLocationText: data.pickup_location_text,
          pickupLatitude: data.pickup_latitude, pickupLongitude: data.pickup_longitude,
          status: data.status, createdAt: new Date(data.created_at),
          acceptedAt: data.accepted_at ? new Date(data.accepted_at) : undefined,
          pickedUpAt: data.picked_up_at ? new Date(data.picked_up_at) : undefined,
          completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
        });
      } else {
        setExistingRequest(null);
      }
    } catch {}
  };

  const handleCallDriver = async () => {
    if (!ddUser?.phoneNumber) {
      Alert.alert('No Phone Number', 'This driver has not provided a phone number.');
      return;
    }
    const url = `tel:${ddUser.phoneNumber.replace(/[^0-9]/g, '')}`;
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url);
      else Alert.alert('Cannot Call', 'Your device does not support phone calls.');
    } catch {
      Alert.alert('Error', 'Failed to open phone dialer.');
    }
  };

  const handleRequestRide = async () => {
    if (!pickupLocation.trim()) { setPickupError('Please enter a pickup location.'); return; }
    if (!user || !eventId) return;

    setRequestingRide(true);
    try {
      let userLocation: { latitude: number; longitude: number } | null = null;
      try { userLocation = await getCurrentLocation(); } catch {}

      const payload: any = {
        dd_user_id: ddUserId, rider_user_id: user.id,
        event_id: eventId, pickup_location_text: pickupLocation.trim(), status: 'pending',
      };
      if (userLocation) {
        payload.pickup_latitude = userLocation.latitude;
        payload.pickup_longitude = userLocation.longitude;
      }

      const { data, error } = await supabase.from('ride_requests').insert(payload).select().single();
      if (error) throw error;

      if (data) {
        setExistingRequest({
          id: data.id, ddUserId: data.dd_user_id, riderUserId: data.rider_user_id,
          eventId: data.event_id, pickupLocationText: data.pickup_location_text,
          pickupLatitude: data.pickup_latitude, pickupLongitude: data.pickup_longitude,
          status: data.status, createdAt: new Date(data.created_at),
        });
      }

      setRequestSheetVisible(false);
      setPickupLocation('');
      Alert.alert('Ride Requested', `Your request has been sent to ${ddUser?.name}.`, [
        { text: 'View Status', onPress: () => eventId && navigation.navigate('RideStatus', { eventId }) },
        { text: 'OK' },
      ]);
    } catch (err: any) {
      setPickupError(err.message || 'Failed to request ride. Please try again.');
    } finally {
      setRequestingRide(false);
    }
  };

  if (loading) return <LoadingScreen />;
  if (!ddUser) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Driver not found</Text>
      </View>
    );
  }

  const canRequestRide = eventId && user && ddUserId !== user.id;

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Avatar uri={ddUser.profilePhotoUrl} name={ddUser.name} size={80} />
          <Text style={styles.name}>{ddUser.name}</Text>
          <View style={styles.verifiedRow}>
            <Ionicons name="shield-checkmark" size={14} color={colors.brand.primary} />
            <Text style={styles.verifiedText}>Verified Designated Driver</Text>
          </View>
        </View>

        {/* Vehicle */}
        {(ddUser.carMake || ddUser.carModel || ddUser.carPlate) && (
          <>
            <SectionLabel title="Vehicle" />
            <View style={styles.section}>
              {ddUser.carMake && ddUser.carModel && (
                <>
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <Ionicons name="car-outline" size={20} color={colors.text.secondary} style={styles.rowIcon} />
                      <Text style={styles.rowLabel}>Vehicle</Text>
                    </View>
                    <Text style={styles.rowValue}>{ddUser.carMake} {ddUser.carModel}</Text>
                  </View>
                  {ddUser.carPlate && <Divider />}
                </>
              )}
              {ddUser.carPlate && (
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <Ionicons name="card-outline" size={20} color={colors.text.secondary} style={styles.rowIcon} />
                    <Text style={styles.rowLabel}>License Plate</Text>
                  </View>
                  <Text style={styles.rowValue}>{ddUser.carPlate}</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* Contact */}
        <SectionLabel title="Contact" />
        <View style={styles.section}>
          {ddUser.phoneNumber ? (
            <>
              <TouchableOpacity style={styles.row} onPress={handleCallDriver} activeOpacity={0.7}>
                <View style={styles.rowLeft}>
                  <Ionicons name="call-outline" size={20} color={colors.ui.success} style={styles.rowIcon} />
                  <Text style={[styles.rowLabel, { color: colors.ui.success }]}>Call Driver</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowValue}>{ddUser.phoneNumber}</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
              <Divider />
            </>
          ) : null}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Ionicons name="mail-outline" size={20} color={colors.text.secondary} style={styles.rowIcon} />
              <Text style={styles.rowLabel}>Email</Text>
            </View>
            <Text style={styles.rowValue} numberOfLines={1}>{ddUser.email}</Text>
          </View>
        </View>

        {/* Ride Request */}
        {canRequestRide && (
          <>
            <SectionLabel title="Ride" />
            <View style={styles.section}>
              {existingRequest ? (
                <>
                  <View style={[styles.statusBanner, { borderLeftColor: STATUS_COLOR[existingRequest.status] ?? colors.brand.primary }]}>
                    <Ionicons
                      name={STATUS_ICON[existingRequest.status] ?? 'time-outline'}
                      size={18}
                      color={STATUS_COLOR[existingRequest.status] ?? colors.brand.primary}
                      style={{ marginRight: spacing.sm }}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.statusBannerText}>{STATUS_LABEL[existingRequest.status]}</Text>
                      <Text style={styles.statusBannerSub}>{existingRequest.pickupLocationText}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => navigation.navigate('RideStatus', { eventId: eventId! })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.rowLeft}>
                      <Ionicons name="navigate-outline" size={20} color={colors.brand.primary} style={styles.rowIcon} />
                      <Text style={[styles.rowLabel, { color: colors.brand.primary }]}>View Ride Status</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
                  </TouchableOpacity>
                </>
              ) : (
                <Button
                  label="Request a Ride"
                  onPress={() => { setPickupError(''); setRequestSheetVisible(true); }}
                  fullWidth
                />
              )}
            </View>
          </>
        )}

        {/* Safety notice */}
        <View style={styles.notice}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.text.tertiary} style={{ marginRight: spacing.sm }} />
          <Text style={styles.noticeText}>SEP-verified and authorized to drive for this event</Text>
        </View>

      </ScrollView>

      {/* Request Ride Sheet */}
      <SheetModal
        visible={requestSheetVisible}
        onClose={() => setRequestSheetVisible(false)}
        title={`Ride with ${ddUser.name}`}
      >
        <Text style={styles.sheetSubtitle}>Where should they pick you up?</Text>
        <Input
          label="Pickup Location"
          placeholder="e.g. Main entrance, Room 204"
          value={pickupLocation}
          onChangeText={(t) => { setPickupLocation(t); setPickupError(''); }}
          error={pickupError}
          autoFocus
        />
        <View style={styles.sheetActions}>
          <Button variant="secondary" label="Cancel" onPress={() => setRequestSheetVisible(false)} style={styles.halfBtn} />
          <Button label="Request" onPress={handleRequestRide} loading={requestingRide} style={styles.halfBtn} />
        </View>
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { paddingBottom: 48 },

  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg.canvas },
  errorText: { fontSize: 16, color: colors.ui.error },

  // Header
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.md,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  verifiedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  verifiedText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.brand.primary,
  },

  // Section labels
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

  // Flat rows
  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.base,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 20 + 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 52,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowIcon: { marginRight: spacing.md, width: 20 },
  rowLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  rowValue: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: spacing.sm,
  },

  // Status banner
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderLeftWidth: 3,
    paddingLeft: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusBannerText: { fontSize: 15, fontWeight: '500', color: colors.text.primary, lineHeight: 22 },
  statusBannerSub: { fontSize: 13, color: colors.text.secondary, marginTop: 2 },

  // Notice
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.base,
    marginTop: spacing.xl,
  },
  noticeText: { fontSize: 13, color: colors.text.tertiary, flex: 1 },

  // Sheet
  sheetSubtitle: { fontSize: 14, color: colors.text.secondary, marginBottom: spacing.md },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  halfBtn: { flex: 1 },
});
