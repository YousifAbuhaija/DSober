import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { SEPBaseline } from '../types/database.types';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import InfoRow from '../components/ui/InfoRow';
import StatusPill from '../components/ui/StatusPill';
import SheetModal from '../components/ui/SheetModal';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type NavigationProp = StackNavigationProp<any>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user, signOut, refreshUser } = useAuth();

  const [groupName, setGroupName] = useState<string | null>(null);
  const [sepBaseline, setSepBaseline] = useState<SEPBaseline | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Edit sheet state
  const [editVisible, setEditVisible] = useState(false);
  const [editMake, setEditMake] = useState('');
  const [editModel, setEditModel] = useState('');
  const [editPlate, setEditPlate] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
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
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Avatar uri={user.profilePhotoUrl} name={user.name} size={80} />
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.pillRow}>
            <StatusPill status={user.role === 'admin' ? 'admin' as any : 'member' as any} label={user.role === 'admin' ? 'Admin' : 'Member'} />
            {ddStatusPill && (
              <StatusPill status={ddStatusPill as any} label={ddStatusPill === 'revoked' ? 'DD Revoked' : 'Active DD'} />
            )}
          </View>
        </View>

        {/* Account */}
        <Card elevated style={styles.card}>
          <Text style={styles.cardTitle}>Account</Text>
          {groupName ? <InfoRow label="Chapter" value={groupName} /> : null}
          <InfoRow label="Age" value={String(user.age)} />
          <InfoRow label="Gender" value={user.gender ?? '—'} />
        </Card>

        {/* DD Info */}
        {user.isDD && (
          <Card elevated style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardTitle}>Driver Info</Text>
              <Button variant="ghost" label="Edit" size="sm" onPress={openEdit} />
            </View>
            {user.carMake && user.carModel ? (
              <InfoRow label="Vehicle" value={`${user.carMake} ${user.carModel}`} />
            ) : null}
            {user.carPlate ? (
              <InfoRow label="Plate" value={user.carPlate} />
            ) : null}
          </Card>
        )}

        {/* SEP Baseline */}
        {sepBaseline && (
          <Card elevated style={styles.card}>
            <Text style={styles.cardTitle}>SEP Baseline</Text>
            <Text style={styles.cardSub}>Measurements from your onboarding session</Text>
            <InfoRow label="Reaction Time" value={`${sepBaseline.reactionAvgMs} ms`} />
            <InfoRow label="Phrase Duration" value={`${sepBaseline.phraseDurationSec.toFixed(2)} s`} />
          </Card>
        )}

        {/* Settings */}
        <Card elevated style={styles.card}>
          <InfoRow
            label="Notification Settings"
            value=""
            onPress={() => navigation.navigate('NotificationPreferences')}
          />
        </Card>

        {/* Logout */}
        <Button
          variant="danger"
          label="Log Out"
          onPress={handleLogout}
          loading={loggingOut}
          fullWidth
          style={styles.logoutBtn}
        />

        <Text style={styles.version}>DSober v1.0.0</Text>
      </ScrollView>

      {/* Edit Driver Info Sheet */}
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
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.xl,
  },
  name: { ...typography.title2, color: colors.text.primary, marginTop: spacing.md },
  email: { ...typography.callout, color: colors.text.secondary, marginTop: spacing.xs, marginBottom: spacing.md },
  pillRow: { flexDirection: 'row', gap: spacing.sm },
  card: { marginBottom: spacing.md },
  cardTitle: { ...typography.bodyBold, color: colors.text.primary, marginBottom: spacing.md },
  cardTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  cardSub: { ...typography.caption, color: colors.text.tertiary, marginTop: -spacing.sm, marginBottom: spacing.md },
  logoutBtn: { marginTop: spacing.md },
  version: {
    ...typography.caption,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  inputGap: { marginTop: spacing.md },
  sheetActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl },
  halfBtn: { flex: 1 },
});
