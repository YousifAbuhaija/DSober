import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SEPBaseline } from '../types/database.types';
import { uploadImage } from '../utils/storage';
import Avatar from '../components/ui/Avatar';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import InfoRow from '../components/ui/InfoRow';
import StatusPill from '../components/ui/StatusPill';
import SheetModal from '../components/ui/SheetModal';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type NavigationProp = StackNavigationProp<any>;

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

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut, refreshUser } = useAuth();

  const [groupName, setGroupName] = useState<string | null>(null);
  const [sepBaseline, setSepBaseline] = useState<SEPBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [editVisible, setEditVisible] = useState(false);
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setFetchError(false);
    try {
      if (user.groupId) {
        const { data: gd } = await supabase.from('groups').select('name').eq('id', user.groupId).single();
        if (gd) setGroupName(gd.name);
      }
      const { data: bd } = await supabase.from('sep_baselines').select('*').eq('user_id', user.id).single();
      if (bd) {
        setSepBaseline({
          id: bd.id, userId: bd.user_id,
          reactionAvgMs: bd.reaction_avg_ms,
          phraseDurationSec: bd.phrase_duration_sec,
          selfieUrl: bd.selfie_url,
          createdAt: new Date(bd.created_at),
        });
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(useCallback(() => { fetchData(); }, [user?.id]));

  const openEdit = () => {
    setEditMake(user?.carMake ?? '');
    setEditModel(user?.carModel ?? '');
    setEditPlate(user?.carPlate ?? '');
    setEditError('');
    setEditVisible(true);
  };

  const saveDriverInfo = async () => {
    if (!editMake.trim() || !editModel.trim() || !editPlate.trim()) {
      setEditError('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      await supabase.from('users').update({
        car_make: editMake.trim(),
        car_model: editModel.trim(),
        car_plate: editPlate.trim(),
      }).eq('id', user!.id);
      await refreshUser();
      setEditVisible(false);
    } catch {
      setEditError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleEditPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Photo library access is needed to update your profile photo.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploadingPhoto(true);
    try {
      const uri = result.assets[0].uri;
      const url = await uploadImage(uri, 'profile-photos', `${user!.id}/profile.jpg`);
      await supabase.from('users').update({ profile_photo_url: url }).eq('id', user!.id);
      await refreshUser();
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not update profile photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = () => {
    Alert.alert(
      'Change Password',
      `A password reset link will be sent to ${user?.email}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Link',
          onPress: async () => {
            try {
              await supabase.auth.resetPasswordForEmail(user!.email);
              Alert.alert('Email Sent', 'Check your inbox for the password reset link.');
            } catch {
              Alert.alert('Error', 'Failed to send reset email. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Your rides, DD history, and profile will be deleted permanently.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', user!.id);
                      await signOut();
                    } catch {
                      Alert.alert('Error', 'Could not delete account. Please contact support.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          setLoggingOut(true);
          try { await signOut(); } finally { setLoggingOut(false); }
        },
      },
    ]);
  };

  if (!user || loading) return <LoadingScreen />;

  const ddStatusPill = user.isDD
    ? (user.ddStatus === 'revoked' ? 'revoked' : 'active')
    : null;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {fetchError && (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color={colors.ui.warning} style={{ marginRight: spacing.sm }} />
            <Text style={styles.errorBannerText}>Some profile data failed to load.</Text>
            <TouchableOpacity onPress={fetchData} style={styles.retryBtn}>
              <Text style={styles.retryBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.name}>{user.name}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.pillRow}>
                <StatusPill
                  status={user.role === 'admin' ? 'admin' as any : 'member' as any}
                  label={user.role === 'admin' ? 'Admin' : 'Member'}
                />
                {ddStatusPill && (
                  <StatusPill
                    status={ddStatusPill as any}
                    label={ddStatusPill === 'revoked' ? 'DD Revoked' : 'Active DD'}
                  />
                )}
              </View>
            </View>
            <TouchableOpacity onPress={handleEditPhoto} style={styles.avatarWrapper} activeOpacity={0.8} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <View style={styles.avatarLoading}>
                  <ActivityIndicator color={colors.brand.primary} />
                </View>
              ) : (
                <>
                  <Avatar uri={user.profilePhotoUrl} name={user.name} size={64} />
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera" size={12} color={colors.text.primary} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Account */}
        <SectionLabel title="Account" />
        <View style={styles.section}>
          {groupName ? (
            <>
              <InfoRow icon="people-outline" label="Chapter" value={groupName} />
              <Divider />
            </>
          ) : null}
          <InfoRow icon="calendar-outline" label="Age" value={String(user.age)} />
          <Divider />
          <InfoRow icon="person-outline" label="Gender" value={user.gender ?? '—'} />
          {user.phoneNumber ? (
            <>
              <Divider />
              <InfoRow icon="phone-portrait-outline" label="Phone" value={user.phoneNumber} />
            </>
          ) : null}
        </View>

        {/* Driver Info */}
        {user.isDD && (
          <>
            <View style={styles.sectionLabelRow}>
              <Text style={styles.sectionLabelText}>Driver Info</Text>
              <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.section}>
              {user.carMake && user.carModel ? (
                <>
                  <InfoRow icon="car-outline" label="Vehicle" value={`${user.carMake} ${user.carModel}`} />
                  <Divider />
                </>
              ) : null}
              {user.carPlate ? (
                <InfoRow icon="card-outline" label="License Plate" value={user.carPlate} />
              ) : null}
            </View>
          </>
        )}

        {/* SEP Baseline */}
        {sepBaseline && (
          <>
            <SectionLabel title="SEP Baseline" />
            <View style={styles.section}>
              <InfoRow
                icon="flash-outline"
                label="Reaction Time"
                subtitle="Measured during onboarding"
                value={`${sepBaseline.reactionAvgMs} ms`}
              />
              <Divider />
              <InfoRow
                icon="mic-outline"
                label="Phrase Duration"
                value={`${sepBaseline.phraseDurationSec.toFixed(2)} s`}
              />
            </View>
          </>
        )}

        {/* Settings */}
        <SectionLabel title="Settings" />
        <View style={styles.section}>
          <InfoRow
            icon="notifications-outline"
            label="Notification Settings"
            onPress={() => navigation.navigate('NotificationPreferences')}
          />
          <Divider />
          <InfoRow
            icon="shield-checkmark-outline"
            label="Help & Safety"
            onPress={() => navigation.navigate('SafetyCenter')}
          />
          <Divider />
          <InfoRow
            icon="key-outline"
            label="Change Password"
            onPress={handleChangePassword}
          />
          <Divider />
          <InfoRow
            icon="document-text-outline"
            label="Privacy & Terms"
            onPress={() => Linking.openURL('https://dsober.app/privacy')}
          />
        </View>

        {/* Danger Zone */}
        <SectionLabel title="Account" />
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.dangerRow}
            onPress={handleDeleteAccount}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={20} color={colors.ui.error} style={styles.dangerIcon} />
            <Text style={styles.dangerText}>Delete Account</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutRow}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={colors.ui.error} style={styles.logoutIcon} />
          <Text style={styles.logoutText}>{loggingOut ? 'Logging out…' : 'Log Out'}</Text>
        </TouchableOpacity>

        <Text style={styles.version}>DSober v1.0.0</Text>
      </ScrollView>

      <SheetModal visible={editVisible} onClose={() => setEditVisible(false)} title="Edit Driver Info">
        <Input label="Car Make" value={editMake} onChangeText={setEditMake} placeholder="e.g. Toyota" />
        <Input label="Car Model" value={editModel} onChangeText={setEditModel} placeholder="e.g. Camry" style={styles.inputGap} />
        <Input
          label="License Plate"
          value={editPlate}
          onChangeText={setEditPlate}
          placeholder="e.g. ABC123"
          autoCapitalize="characters"
          error={editError}
          style={styles.inputGap}
        />
        <View style={styles.sheetActions}>
          <Button variant="secondary" label="Cancel" onPress={() => setEditVisible(false)} style={styles.halfBtn} />
          <Button label="Save" onPress={saveDriverInfo} loading={saving} style={styles.halfBtn} />
        </View>
      </SheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg.canvas,
  },
  content: {
    paddingBottom: 48,
  },

  // Error banner
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg.elevated,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
  },
  retryBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.brand.primary,
  },

  // Header
  header: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flex: 1,
    marginRight: spacing.base,
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  email: {
    ...typography.callout,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  pillRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },

  // Avatar
  avatarWrapper: {
    position: 'relative',
  },
  avatarLoading: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.bg.elevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg.canvas,
  },

  // Sections
  sectionLabel: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionLabelText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.tertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  editBtn: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.brand.primary,
  },
  section: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginLeft: 16 + 32 + 12,
  },

  // Danger row
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
  },
  dangerIcon: {
    marginRight: spacing.md + 4,
  },
  dangerText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ui.error,
  },

  // Logout
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    marginTop: spacing.lg,
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
  logoutIcon: {
    marginRight: spacing.md + 4,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.ui.error,
  },

  version: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },

  // Sheet
  inputGap: { marginTop: spacing.md },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  halfBtn: { flex: 1 },
});
