import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User } from '../types/database.types';
import { mapRideRequest, mapUser } from '../utils/mappers';
import { useRealtime } from '../hooks/useRealtime';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type RouteParams = { eventId: string };
type NavigationProp = StackNavigationProp<any>;

interface StatusMeta {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
}

const STATUS_META: Record<string, StatusMeta> = {
  pending: {
    icon: 'time-outline',
    color: colors.ui.warning,
    title: 'Request Pending',
    body: 'Waiting for your driver to accept. You can cancel anytime before they accept.',
  },
  accepted: {
    icon: 'checkmark-circle-outline',
    color: colors.ui.success,
    title: 'Request Accepted',
    body: 'Your driver is on their way. Please be ready at your pickup location.',
  },
  picked_up: {
    icon: 'car-outline',
    color: colors.ui.info,
    title: 'En Route',
    body: 'Enjoy your ride! Your driver will mark the trip complete when you arrive.',
  },
};

export default function RideStatusScreen() {
  const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { eventId } = route.params;

  const [request, setRequest] = useState<RideRequest | null>(null);
  const [ddUser, setDDUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const fetchStatus = async () => {
    if (!user) return;
    try {
      const { data: rd } = await supabase
        .from('ride_requests')
        .select('*')
        .eq('rider_user_id', user.id)
        .eq('event_id', eventId)
        .in('status', ['pending', 'accepted', 'picked_up'])
        .maybeSingle();

      if (!rd) {
        if (navigation.canGoBack()) navigation.goBack();
        return;
      }

      const mapped = mapRideRequest(rd);
      setRequest(mapped);

      if (mapped.status !== 'pending') {
        const { data: dd } = await supabase.from('users').select('*').eq('id', mapped.ddUserId).single();
        if (dd) setDDUser(mapUser(dd));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [eventId]);

  useRealtime(
    'ride_requests',
    () => { fetchStatus(); },
    { event: 'UPDATE', filter: `rider_user_id=eq.${user?.id}` },
    [user?.id]
  );

  const handleCancel = () => {
    if (!request) return;
    Alert.alert('Cancel Ride', 'Cancel your ride request?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await supabase.from('ride_requests').update({ status: 'cancelled' }).eq('id', request.id);
            if (navigation.canGoBack()) navigation.goBack();
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);
  };

  const handleCallDD = async () => {
    const phone = ddUser?.phoneNumber;
    if (!phone) return;
    const url = `tel:${phone.replace(/\D/g, '')}`;
    const ok = await Linking.canOpenURL(url);
    if (ok) Linking.openURL(url);
  };

  if (loading) return <LoadingScreen message="Loading ride status…" />;
  if (!request) return null;

  const meta = STATUS_META[request.status] ?? STATUS_META.pending;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Status hero */}
      <Card style={[styles.statusCard, { borderLeftColor: meta.color }]} elevated>
        <View style={styles.statusIconWrap}>
          <Ionicons name={meta.icon} size={48} color={meta.color} />
        </View>
        <Text style={[styles.statusTitle, { color: meta.color }]}>{meta.title}</Text>
        <Text style={styles.statusBody}>{meta.body}</Text>
      </Card>

      {/* Pickup */}
      <Card elevated style={styles.section}>
        <Text style={styles.sectionLabel}>PICKUP LOCATION</Text>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={16} color={colors.text.tertiary} />
          <Text style={styles.locationText}>{request.pickupLocationText}</Text>
        </View>
      </Card>

      {/* Driver info */}
      {ddUser && request.status !== 'pending' && (
        <Card elevated style={styles.section}>
          <Text style={styles.sectionLabel}>YOUR DRIVER</Text>
          <View style={styles.driverRow}>
            <Avatar uri={ddUser.profilePhotoUrl} name={ddUser.name} size={52} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{ddUser.name}</Text>
              {ddUser.carMake && ddUser.carModel ? (
                <View style={styles.carRow}>
                  <Ionicons name="car-outline" size={13} color={colors.text.tertiary} />
                  <Text style={styles.carText}>{ddUser.carMake} {ddUser.carModel}</Text>
                </View>
              ) : null}
              {ddUser.carPlate ? (
                <Text style={styles.plateText}>{ddUser.carPlate}</Text>
              ) : null}
            </View>
          </View>
          {ddUser.phoneNumber ? (
            <Button
              variant="success"
              leftIcon={<Ionicons name="call-outline" size={16} color="#fff" />}
              label="Call Driver"
              onPress={handleCallDD}
              fullWidth
              style={styles.callBtn}
            />
          ) : null}
        </Card>
      )}

      {/* Cancel (pending only) */}
      {request.status === 'pending' && (
        <Button
          variant="danger"
          label="Cancel Request"
          onPress={handleCancel}
          loading={cancelling}
          fullWidth
          style={styles.cancelBtn}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  statusCard: { alignItems: 'center', marginBottom: spacing.xl, borderLeftWidth: 4 },
  statusIconWrap: { marginBottom: spacing.md },
  statusTitle: { ...typography.title2, textAlign: 'center', marginBottom: spacing.sm },
  statusBody: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  section: { marginBottom: spacing.xl },
  sectionLabel: { ...typography.label, color: colors.text.tertiary, marginBottom: spacing.sm },
  locationRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  locationText: { ...typography.body, color: colors.text.primary, flex: 1 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.base },
  driverInfo: { flex: 1 },
  driverName: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.xs },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  carText: { ...typography.caption, color: colors.text.tertiary },
  plateText: {
    ...typography.caption,
    color: colors.text.secondary,
    backgroundColor: colors.bg.muted,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.sm,
    fontWeight: '600',
    alignSelf: 'flex-start',
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  callBtn: {},
  cancelBtn: {},
});
