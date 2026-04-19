import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DDRequest, Event, User, AdminAlert, SEPAttempt, SEPBaseline } from '../types/database.types';
import { mapUser, mapEvent } from '../utils/mappers';
import Avatar from '../components/ui/Avatar';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import SectionHeader from '../components/ui/SectionHeader';
import EmptyState from '../components/ui/EmptyState';
import LoadingScreen from '../components/ui/LoadingScreen';
import { colors, spacing, typography, radii } from '../theme';

type NavigationProp = StackNavigationProp<any>;

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

const fmtDate = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function AdminDashboardScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [pendingRequests, setPendingRequests] = useState<DDRequestWithDetails[]>([]);
  const [sepAlerts, setSepAlerts] = useState<AdminAlertWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user?.groupId || user.role !== 'admin') { setLoading(false); return; }
    try {
      // Pending DD requests
      const { data: reqs } = await supabase
        .from('dd_requests')
        .select('*, users!dd_requests_user_id_fkey(*), events!dd_requests_event_id_fkey(*)')
        .eq('status', 'pending')
        .eq('events.group_id', user.groupId)
        .order('created_at', { ascending: false });

      setPendingRequests(
        (reqs || []).map((r) => ({
          id: r.id, eventId: r.event_id, userId: r.user_id, status: r.status,
          createdAt: new Date(r.created_at),
          user: mapUser(r.users),
          event: mapEvent(r.events),
        }))
      );

      // SEP alerts
      const { data: alerts } = await supabase
        .from('admin_alerts')
        .select('*, users!admin_alerts_user_id_fkey(*), events!admin_alerts_event_id_fkey(*), sep_attempts!admin_alerts_sep_attempt_id_fkey(*)')
        .eq('type', 'SEP_FAIL')
        .is('resolved_at', null)
        .eq('events.group_id', user.groupId)
        .order('created_at', { ascending: false });

      const alertsWithBaseline: AdminAlertWithDetails[] = await Promise.all(
        (alerts || []).map(async (a) => {
          const { data: baseline } = await supabase
            .from('sep_baselines').select('*').eq('user_id', a.user_id).single();
          return {
            id: a.id, type: a.type, userId: a.user_id, eventId: a.event_id,
            sepAttemptId: a.sep_attempt_id, createdAt: new Date(a.created_at),
            resolvedByAdminId: a.resolved_by_admin_id,
            resolvedAt: a.resolved_at ? new Date(a.resolved_at) : undefined,
            user: mapUser(a.users),
            event: mapEvent(a.events),
            sepAttempt: {
              id: a.sep_attempts.id, userId: a.sep_attempts.user_id,
              eventId: a.sep_attempts.event_id,
              reactionAvgMs: a.sep_attempts.reaction_avg_ms,
              phraseDurationSec: a.sep_attempts.phrase_duration_sec,
              selfieUrl: a.sep_attempts.selfie_url,
              result: a.sep_attempts.result,
              createdAt: new Date(a.sep_attempts.created_at),
            },
            sepBaseline: baseline ? {
              id: baseline.id, userId: baseline.user_id,
              reactionAvgMs: baseline.reaction_avg_ms,
              phraseDurationSec: baseline.phrase_duration_sec,
              selfieUrl: baseline.selfie_url,
              createdAt: new Date(baseline.created_at),
            } : undefined,
          };
        })
      );
      setSepAlerts(alertsWithBaseline);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.groupId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [user?.groupId]));

  const approveRequest = async (req: DDRequestWithDetails) => {
    setProcessingId(req.id);
    try {
      if (req.user.ddStatus === 'revoked') {
        await supabase.from('dd_requests').update({ status: 'rejected' }).eq('id', req.id);
        setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
        Alert.alert('Cannot Approve', `${req.user.name} has a revoked DD status.`);
        return;
      }
      await supabase.from('dd_assignments').upsert(
        { event_id: req.eventId, user_id: req.userId, status: 'assigned', updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' }
      );
      await supabase.from('dd_requests').update({ status: 'approved' }).eq('id', req.id);
      setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
    } finally {
      setProcessingId(null);
    }
  };

  const rejectRequest = async (req: DDRequestWithDetails) => {
    setProcessingId(req.id);
    try {
      await supabase.from('dd_requests').update({ status: 'rejected' }).eq('id', req.id);
      setPendingRequests((prev) => prev.filter((r) => r.id !== req.id));
    } finally {
      setProcessingId(null);
    }
  };

  const reinstateDD = async (alert: AdminAlertWithDetails) => {
    if (!user?.id) return;
    setProcessingId(alert.id);
    try {
      await supabase.from('users').update({ dd_status: 'active' }).eq('id', alert.userId);
      await supabase.from('dd_assignments').delete().eq('user_id', alert.userId);
      await supabase.from('admin_alerts')
        .update({ resolved_at: new Date().toISOString(), resolved_by_admin_id: user.id })
        .eq('user_id', alert.userId).is('resolved_at', null);
      setSepAlerts((prev) => prev.filter((a) => a.userId !== alert.userId));
    } finally {
      setProcessingId(null);
    }
  };

  const keepRevoked = async (alert: AdminAlertWithDetails) => {
    if (!user?.id) return;
    setProcessingId(alert.id);
    try {
      await supabase.from('admin_alerts')
        .update({ resolved_at: new Date().toISOString(), resolved_by_admin_id: user.id })
        .eq('user_id', alert.userId).eq('event_id', alert.eventId).is('resolved_at', null);
      setSepAlerts((prev) => prev.filter((a) => !(a.userId === alert.userId && a.eventId === alert.eventId)));
    } finally {
      setProcessingId(null);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <EmptyState icon="shield-outline" title="Admin Access Required" subtitle="This section is only available to admins." />
    );
  }

  if (loading && !pendingRequests.length && !sepAlerts.length) return <LoadingScreen message="Loading dashboard…" />;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchAll(); }}
          tintColor={colors.brand.primary}
        />
      }
    >
      {/* Quick action */}
      <Button
        label="View Ride Activity Log"
        leftIcon={<Ionicons name="bar-chart-outline" size={18} color="#fff" />}
        onPress={() => navigation.navigate('AdminRideLog')}
        fullWidth
        style={styles.logBtn}
      />

      {/* DD Requests */}
      <View style={styles.section}>
        <SectionHeader
          title="Pending DD Requests"
          rightLabel={pendingRequests.length > 0 ? String(pendingRequests.length) : undefined}
        />
        {pendingRequests.length === 0 ? (
          <EmptyState icon="checkmark-circle-outline" title="No pending requests" subtitle="DD requests will appear here." />
        ) : (
          pendingRequests.map((req) => (
            <DDRequestCard
              key={req.id}
              req={req}
              processing={processingId === req.id}
              onApprove={() => Alert.alert('Approve', `Approve ${req.user.name} for ${req.event.name}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Approve', onPress: () => approveRequest(req) },
              ])}
              onReject={() => Alert.alert('Reject', `Reject ${req.user.name}'s request?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reject', style: 'destructive', onPress: () => rejectRequest(req) },
              ])}
            />
          ))
        )}
      </View>

      {/* SEP Alerts */}
      <View style={styles.section}>
        <SectionHeader
          title="SEP Alerts"
          rightLabel={sepAlerts.length > 0 ? String(sepAlerts.length) : undefined}
        />
        {sepAlerts.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No alerts" subtitle="Failed SEP verifications will appear here." />
        ) : (
          sepAlerts.map((alert) => (
            <SEPAlertCard
              key={alert.id}
              alert={alert}
              processing={processingId === alert.id}
              onReinstate={() => Alert.alert('Reinstate', `Reinstate ${alert.user.name} as DD?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Reinstate', onPress: () => reinstateDD(alert) },
              ])}
              onKeepRevoked={() => Alert.alert('Keep Revoked', `Keep ${alert.user.name} revoked?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', style: 'destructive', onPress: () => keepRevoked(alert) },
              ])}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function DDRequestCard({
  req, processing, onApprove, onReject,
}: {
  req: DDRequestWithDetails;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <Card elevated style={styles.card}>
      <View style={styles.cardHeader}>
        <Avatar name={req.user.name} size={40} />
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.userName}>{req.user.name}</Text>
          <Text style={styles.metaText}>{fmtDate(req.createdAt)}</Text>
        </View>
      </View>
      <View style={styles.eventRow}>
        <Ionicons name="calendar-outline" size={13} color={colors.text.tertiary} />
        <Text style={styles.eventName} numberOfLines={1}>{req.event.name}</Text>
      </View>
      {req.user.carMake && req.user.carModel ? (
        <View style={styles.carRow}>
          <Ionicons name="car-outline" size={13} color={colors.text.tertiary} />
          <Text style={styles.carText}>{req.user.carMake} {req.user.carModel}{req.user.carPlate ? ` • ${req.user.carPlate}` : ''}</Text>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button variant="danger" label="Reject" onPress={onReject} loading={processing} disabled={processing} style={styles.halfBtn} />
        <Button variant="success" label="Approve" onPress={onApprove} loading={processing} disabled={processing} style={styles.halfBtn} />
      </View>
    </Card>
  );
}

function SEPAlertCard({
  alert, processing, onReinstate, onKeepRevoked,
}: {
  alert: AdminAlertWithDetails;
  processing: boolean;
  onReinstate: () => void;
  onKeepRevoked: () => void;
}) {
  const baseline = alert.sepBaseline;
  const attempt = alert.sepAttempt;
  const rxFail = baseline && attempt.reactionAvgMs > baseline.reactionAvgMs + 150;
  const phFail = baseline && attempt.phraseDurationSec > baseline.phraseDurationSec + 2;

  return (
    <Card style={styles.alertCard} elevated>
      <View style={styles.alertHeader}>
        <Ionicons name="warning-outline" size={16} color={colors.ui.warning} />
        <Text style={styles.alertTitle}>SEP Verification Failed</Text>
        <Text style={styles.metaText}>{fmtDate(alert.createdAt)}</Text>
      </View>

      <View style={styles.cardHeader}>
        <Avatar name={alert.user.name} size={40} />
        <View style={styles.cardHeaderInfo}>
          <Text style={styles.userName}>{alert.user.name}</Text>
          <View style={styles.eventRow}>
            <Ionicons name="calendar-outline" size={12} color={colors.text.tertiary} />
            <Text style={styles.eventName} numberOfLines={1}>{alert.event.name}</Text>
          </View>
        </View>
      </View>

      {baseline && (
        <View style={styles.metricsBlock}>
          <MetricRow
            label="Reaction Time"
            baseline={`${baseline.reactionAvgMs}ms`}
            attempt={`${attempt.reactionAvgMs}ms`}
            failed={rxFail}
          />
          <MetricRow
            label="Phrase Duration"
            baseline={`${baseline.phraseDurationSec.toFixed(1)}s`}
            attempt={`${attempt.phraseDurationSec.toFixed(1)}s`}
            failed={phFail}
          />
        </View>
      )}

      <View style={styles.actions}>
        <Button variant="secondary" label="Keep Revoked" onPress={onKeepRevoked} loading={processing} disabled={processing} style={styles.halfBtn} />
        <Button label="Reinstate DD" onPress={onReinstate} loading={processing} disabled={processing} style={styles.halfBtn} />
      </View>
    </Card>
  );
}

function MetricRow({ label, baseline, attempt, failed }: {
  label: string; baseline: string; attempt: string; failed?: boolean;
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={styles.metricLabel}>{label}</Text>
      <View style={styles.metricValues}>
        <Text style={styles.metricBase}>{baseline}</Text>
        <Ionicons name="arrow-forward" size={11} color={colors.border.default} />
        <Text style={[styles.metricAttempt, failed && styles.metricFail]}>{attempt}</Text>
        {failed ? <Ionicons name="close-circle" size={13} color={colors.ui.error} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing['3xl'] },
  logBtn: { marginBottom: spacing.xl },
  section: { marginBottom: spacing.xl },
  card: { marginBottom: spacing.md },
  alertCard: { marginBottom: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.ui.warning },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  cardHeaderInfo: { flex: 1 },
  userName: { ...typography.bodyBold, color: colors.text.primary },
  metaText: { ...typography.caption, color: colors.text.tertiary },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs },
  eventName: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  carRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.md },
  carText: { ...typography.caption, color: colors.text.tertiary },
  actions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  halfBtn: { flex: 1 },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  alertTitle: { ...typography.caption, color: colors.ui.warning, fontWeight: '600', flex: 1 },
  metricsBlock: {
    backgroundColor: colors.bg.muted,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { ...typography.caption, color: colors.text.secondary },
  metricValues: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metricBase: { ...typography.caption, color: colors.ui.success },
  metricAttempt: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  metricFail: { color: colors.ui.error },
});
