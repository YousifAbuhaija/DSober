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
import CircularPhotoCropper from '../components/ui/CircularPhotoCropper';
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
  const [cropperUri, setCropperUri] = useState<string | null>(null);

  const [editVisible, setEditVisible] = useState(false);
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteSheetVisible, setDeleteSheetVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteConfirmError, setDeleteConfirmError] = useState('');
  const [deleting, setDeleting] = useState(false);

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
      allowsEditing: false,
      quality: 1,
    });

    if (result.canceled || !result.assets[0]) return;
    setCropperUri(result.assets[0].uri);
  };

  const handleCropConfirm = async (croppedUri: string) => {
    setCropperUri(null);
    setUploadingPhoto(true);
    try {
      const url = await uploadImage(croppedUri, 'profile-photos', `${user!.id}/profile.jpg`);
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

  const CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

  const handleDeleteAccount = () => {
    setDeleteConfirmText('');
    setDeleteConfirmError('');
    setDeleteSheetVisible(true);
  };

  const confirmDelete = async () => {
    if (deleteConfirmText.trim() !== CONFIRM_PHRASE) {
      setDeleteConfirmError(`Type "${CONFIRM_PHRASE}" exactly to confirm.`);
      return;
    }
    setDeleting(true);
    try {
      await supabase.from('users').update({ deleted_at: new Date().toISOString() }).eq('id', user!.id);
      await signOut();
    } catch {
      setDeleteConfirmError('Could not delete account. Please contact support.');
    } finally {
      setDeleting(false);
    }
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

        {/* Session */}
        <SectionLabel title="Session" />
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.sessionRow}
            onPress={handleLogout}
            disabled={loggingOut}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={20} color={colors.ui.error} style={styles.rowIconLeft} />
            <Text style={styles.sessionText}>{loggingOut ? 'Logging out…' : 'Log Out'}</Text>
          </TouchableOpacity>
        </View>

        {/* Danger Zone — buried at the bottom, behind a clear visual gate */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneLabel}>DANGER ZONE</Text>
          <View style={styles.dangerBlock}>
            <View style={styles.dangerBlockInner}>
              <View style={styles.dangerWarningRow}>
                <Ionicons name="warning-outline" size={18} color={colors.ui.error} style={{ marginRight: spacing.sm }} />
                <Text style={styles.dangerWarningText}>
                  Permanently deletes your account, all rides, DD history, and personal data. This cannot be undone.
                </Text>
              </View>
              <View style={styles.dangerDivider} />
              <TouchableOpacity
                style={styles.dangerRow}
                onPress={handleDeleteAccount}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={colors.ui.error} style={styles.rowIconLeft} />
                <Text style={styles.dangerRowText}>Delete My Account</Text>
                <Ionicons name="chevron-forward" size={14} color={`${colors.ui.error}80`} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <Text style={styles.version}>DSober v1.0.0</Text>
      </ScrollView>

      {/* Edit Driver Info Sheet */}
      <SheetModal visible={editVisible} onClose={() => setEditVisible(false)} title="Edit Driver Info">
        <Input label="Car Make" value={editMake} onChangeText={setEditMake} placeholder="e.g. Toyota" />
        <Input label="Car Model" value={editModel} onChangeText={setEditModel} placeholder="e.g. Camry" containerStyle={styles.inputGap} />
        <Input
          label="License Plate"
          value={editPlate}
          onChangeText={setEditPlate}
          placeholder="e.g. ABC123"
          autoCapitalize="characters"
          error={editError}
          containerStyle={styles.inputGap}
        />
        <View style={styles.sheetActions}>
          <Button variant="secondary" label="Cancel" onPress={() => setEditVisible(false)} style={styles.halfBtn} />
          <Button label="Save" onPress={saveDriverInfo} loading={saving} style={styles.halfBtn} />
        </View>
      </SheetModal>

      {/* Delete Account Confirmation Sheet */}
      <SheetModal
        visible={deleteSheetVisible}
        onClose={() => { if (!deleting) setDeleteSheetVisible(false); }}
        title="Delete Account"
      >
        <View style={styles.deleteWarningBox}>
          <Ionicons name="warning" size={22} color={colors.ui.error} />
          <Text style={styles.deleteWarningBoxText}>
            This will permanently delete your account and all associated data. There is no recovery.
          </Text>
        </View>
        <Input
          label={`Type "DELETE MY ACCOUNT" to confirm`}
          value={deleteConfirmText}
          onChangeText={(t) => { setDeleteConfirmText(t); setDeleteConfirmError(''); }}
          placeholder="DELETE MY ACCOUNT"
          autoCapitalize="characters"
          error={deleteConfirmError}
          containerStyle={styles.inputGap}
        />
        <View style={styles.sheetActions}>
          <Button
            variant="secondary"
            label="Cancel"
            onPress={() => setDeleteSheetVisible(false)}
            style={styles.halfBtn}
            disabled={deleting}
          />
          <Button
            variant="danger"
            label="Delete"
            onPress={confirmDelete}
            loading={deleting}
            disabled={deleteConfirmText.trim() !== 'DELETE MY ACCOUNT'}
            style={styles.halfBtn}
          />
        </View>
      </SheetModal>

      {cropperUri && (
        <CircularPhotoCropper
          uri={cropperUri}
          onCrop={handleCropConfirm}
          onCancel={() => setCropperUri(null)}
        />
      )}
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

  rowIconLeft: { marginRight: spacing.md + 4 },

  // Session (Log Out)
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  sessionText: { fontSize: 16, fontWeight: '600', color: colors.ui.error },

  // Danger Zone
  dangerZone: {
    marginTop: spacing.xl * 2,
    marginBottom: spacing.lg,
  },
  dangerZoneLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: `${colors.ui.error}80`,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.sm,
  },
  dangerBlock: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: `${colors.ui.error}30`,
  },
  dangerBlockInner: {
    backgroundColor: `${colors.ui.error}08`,
  },
  dangerWarningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  dangerWarningText: {
    flex: 1,
    fontSize: 13,
    color: `${colors.ui.error}AA`,
    lineHeight: 19,
  },
  dangerDivider: {
    height: 1,
    backgroundColor: `${colors.ui.error}20`,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.base,
    minHeight: 52,
  },
  dangerRowText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.ui.error,
  },

  version: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },

  // Delete warning box
  deleteWarningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: `${colors.ui.error}12`,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: `${colors.ui.error}30`,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  deleteWarningBoxText: {
    flex: 1,
    fontSize: 13,
    color: `${colors.ui.error}CC`,
    lineHeight: 19,
  },

  // Sheet
  inputGap: { marginTop: spacing.md },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  halfBtn: { flex: 1 },
});
