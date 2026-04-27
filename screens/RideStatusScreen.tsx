import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Linking, TouchableOpacity } from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RideRequest, User } from '../types/database.types';
import { mapRideRequest, mapUser } from '../utils/mappers';
import { useRealtime } from '../hooks/useRealtime';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
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
    color: colors.brand.primary,
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

      {/* Status hero — centered on canvas */}
      <View style={[styles.hero, { borderTopColor: meta.color }]}>
        <View style={[styles.heroIcon, { backgroundColor: `${meta.color}18` }]}>
          <Ionicons name={meta.icon} size={40} color={meta.color} />
        </View>
        <Text style={[styles.heroTitle, { color: meta.color }]}>{meta.title}</Text>
        <Text style={styles.heroBody}>{meta.body}</Text>
      </View>

      {/* Pickup location */}
      <SectionHeader title="PICKUP LOCATION" />
      <View style={styles.section}>
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={18} color={colors.text.tertiary} style={styles.rowIcon} />
          <Text style={styles.locationText}>{request.pickupLocationText}</Text>
        </View>
      </View>

      {/* Driver info — shown once accepted */}
      {ddUser && request.status !== 'pending' && (
        <>
          <SectionHeader title="YOUR DRIVER" />
          <View style={styles.section}>
            <View style={styles.driverRow}>
              <Avatar uri={ddUser.profilePhotoUrl} name={ddUser.name} size={48} />
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{ddUser.name}</Text>
                {ddUser.carMake && ddUser.carModel ? (
                  <View style={styles.carRow}>
                    <Ionicons name="car-outline" size={13} color={colors.text.tertiary} />
                    <Text style={styles.carText}>{ddUser.carMake} {ddUser.carModel}</Text>
                  </View>
                ) : null}
                {ddUser.carPlate ? (
                  <Text style={styles.platePill}>{ddUser.carPlate}</Text>
                ) : null}
              </View>
            </View>

            {ddUser.phoneNumber ? (
              <>
                <View style={styles.divider} />
                <TouchableOpacity style={styles.callRow} onPress={handleCallDD} activeOpacity={0.7}>
                  <View style={styles.callRowLeft}>
                    <Ionicons name="call-outline" size={18} color={colors.ui.success} style={styles.rowIcon} />
                    <Text style={[styles.rowLabel, { color: colors.ui.success }]}>Call Driver</Text>
                  </View>
                  <View style={styles.callRowRight}>
                    <Text style={styles.phoneText}>{ddUser.phoneNumber}</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.text.tertiary} />
                  </View>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </>
      )}

      {/* Cancel — pending only */}
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
  content: { paddingBottom: 60 },

  hero: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    marginHorizontal: spacing.base,
    marginTop: spacing.base,
    marginBottom: spacing.md,
    backgroundColor: colors.bg.surface,
    borderRadius: 12,
    borderTopWidth: 3,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  heroTitle: { ...typography.title3, textAlign: 'center', marginBottom: spacing.sm },
  heroBody: { ...typography.callout, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },

  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
    paddingHorizontal: spacing.base,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: spacing.sm,
  },
  rowIcon: { marginTop: 1 },
  locationText: { ...typography.body, color: colors.text.primary, flex: 1 },

  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  driverInfo: { flex: 1 },
  driverName: { ...typography.bodyBold, color: colors.text.primary, marginBottom: 4 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
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
    alignSelf: 'flex-start',
  },

  divider: { height: 1, backgroundColor: colors.border.subtle },

  callRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    minHeight: 52,
  },
  callRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  callRowRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowLabel: { ...typography.body, fontWeight: '600', color: colors.text.primary },
  phoneText: { ...typography.caption, color: colors.text.secondary },

  cancelBtn: { marginHorizontal: spacing.base, marginTop: spacing.xl },
});
