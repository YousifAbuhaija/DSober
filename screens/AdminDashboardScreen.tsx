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
          user: mapUser(r.users), event: mapEvent(r.events),
        }))
      );

      const { data: alerts } = await supabase
        .from('admin_alerts')
        .select('*, users!admin_alerts_user_id_fkey(*), events!admin_alerts_event_id_fkey(*), sep_attempts!admin_alerts_sep_attempt_id_fkey(*)')
        .eq('type', 'SEP_FAIL')
        .is('resolved_at', null)
        .eq('events.group_id', user.groupId)
        .order('created_at', { ascending: false });

      const withBaseline: AdminAlertWithDetails[] = await Promise.all(
        (alerts || []).map(async (a) => {
          const { data: baseline } = await supabase
            .from('sep_baselines').select('*').eq('user_id', a.user_id).single();
          return {
            id: a.id, type: a.type, userId: a.user_id, eventId: a.event_id,
            sepAttemptId: a.sep_attempt_id, createdAt: new Date(a.created_at),
            resolvedByAdminId: a.resolved_by_admin_id,
            resolvedAt: a.resolved_at ? new Date(a.resolved_at) : undefined,
            user: mapUser(a.users), event: mapEvent(a.events),
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
      setSepAlerts(withBaseline);
    } catch { /* silent */ } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.groupId]);

  useFocusEffect(useCallback(() => { fetchAll(); }, [user?.groupId]));

  const approveRequest = async (req: DDRequestWithDetails) => {
    setProcessingId(req.id);
    try {
      if (req.user.ddStatus === 'revoked') {
        await supabase.from('dd_requests').update({ status: 'rejected' }).eq('id', req.id);
        setPendingRequests((p) => p.filter((r) => r.id !== req.id));
        Alert.alert('Cannot Approve', `${req.user.name} has a revoked DD status.`);
        return;
      }
      await supabase.from('dd_assignments').upsert(
        { event_id: req.eventId, user_id: req.userId, status: 'assigned', updated_at: new Date().toISOString() },
        { onConflict: 'event_id,user_id' }
      );
      await supabase.from('dd_requests').update({ status: 'approved' }).eq('id', req.id);
      setPendingRequests((p) => p.filter((r) => r.id !== req.id));
    } finally { setProcessingId(null); }
  };

  const rejectRequest = async (req: DDRequestWithDetails) => {
    setProcessingId(req.id);
    try {
      await supabase.from('dd_requests').update({ status: 'rejected' }).eq('id', req.id);
      setPendingRequests((p) => p.filter((r) => r.id !== req.id));
    } finally { setProcessingId(null); }
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
      setSepAlerts((p) => p.filter((a) => a.userId !== alert.userId));
    } finally { setProcessingId(null); }
  };

  const keepRevoked = async (alert: AdminAlertWithDetails) => {
    if (!user?.id) return;
    setProcessingId(alert.id);
    try {
      await supabase.from('admin_alerts')
        .update({ resolved_at: new Date().toISOString(), resolved_by_admin_id: user.id })
        .eq('user_id', alert.userId).eq('event_id', alert.eventId).is('resolved_at', null);
      setSepAlerts((p) => p.filter((a) => !(a.userId === alert.userId && a.eventId === alert.eventId)));
    } finally { setProcessingId(null); }
  };

  if (user?.role !== 'admin') {
    return <EmptyState icon="shield-outline" title="Admin Access Required" subtitle="This section is only available to admins." />;
  }
  if (loading && !pendingRequests.length && !sepAlerts.length) return <LoadingScreen message="Loading dashboard…" />;

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchAll(); }}
          tintColor={colors.brand.primary}
        />
      }
    >
      {/* ── Ride log shortcut ── */}
      <View style={s.logBtnWrap}>
        <Button
          label="View Ride Activity Log"
          leftIcon={<Ionicons name="bar-chart-outline" size={16} color="#fff" />}
          onPress={() => navigation.navigate('AdminRideLog')}
          fullWidth
        />
      </View>

      {/* ── DD Requests ── */}
      <SectionHeader
        title="Pending DD Requests"
        rightLabel={pendingRequests.length > 0 ? String(pendingRequests.length) : undefined}
      />

      {pendingRequests.length === 0 ? (
        <EmptyState icon="checkmark-circle-outline" title="No pending requests" subtitle="DD requests will appear here." />
      ) : (
        <View style={s.block}>
          {pendingRequests.map((req, i) => (
            <DDRequestRow
              key={req.id}
              req={req}
              isLast={i === pendingRequests.length - 1}
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
          ))}
        </View>
      )}

      {/* ── SEP Alerts ── */}
      <SectionHeader
        title="SEP Alerts"
        rightLabel={sepAlerts.length > 0 ? String(sepAlerts.length) : undefined}
      />

      {sepAlerts.length === 0 ? (
        <EmptyState icon="shield-checkmark-outline" title="No alerts" subtitle="Failed SEP verifications will appear here." />
      ) : (
        <View style={s.block}>
          {sepAlerts.map((alert, i) => (
            <SEPAlertRow
              key={alert.id}
              alert={alert}
              isLast={i === sepAlerts.length - 1}
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
          ))}
        </View>
      )}

      <View style={{ height: spacing['3xl'] }} />
    </ScrollView>
  );
}

// ─── DD Request Row ───────────────────────────────────────────────────────────

function DDRequestRow({ req, isLast, processing, onApprove, onReject }: {
  req: DDRequestWithDetails;
  isLast: boolean;
  processing: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <View style={[r.wrap, !isLast && r.divider]}>
      {/* Person row */}
      <View style={r.personRow}>
        <Avatar name={req.user.name} size={38} />
        <View style={r.personInfo}>
          <Text style={r.name}>{req.user.name}</Text>
          <Text style={r.meta}>{fmtDate(req.createdAt)}</Text>
        </View>
      </View>

      {/* Detail rows */}
      <View style={r.details}>
        <DetailLine icon="calendar-outline" text={req.event.name} />
        {req.user.carMake && req.user.carModel && (
          <DetailLine
            icon="car-outline"
            text={`${req.user.carMake} ${req.user.carModel}${req.user.carPlate ? ` · ${req.user.carPlate}` : ''}`}
          />
        )}
      </View>

      {/* Actions */}
      <View style={r.actions}>
        <Button variant="danger"   size="sm" label="Reject"  onPress={onReject}  loading={processing} disabled={processing} style={r.btn} />
        <Button variant="success"  size="sm" label="Approve" onPress={onApprove} loading={processing} disabled={processing} style={r.btn} />
      </View>
    </View>
  );
}

// ─── SEP Alert Row ────────────────────────────────────────────────────────────

function SEPAlertRow({ alert, isLast, processing, onReinstate, onKeepRevoked }: {
  alert: AdminAlertWithDetails;
  isLast: boolean;
  processing: boolean;
  onReinstate: () => void;
  onKeepRevoked: () => void;
}) {
  const baseline = alert.sepBaseline;
  const attempt  = alert.sepAttempt;
  const rxFail   = baseline && attempt.reactionAvgMs   > baseline.reactionAvgMs   + 150;
  const phFail   = baseline && attempt.phraseDurationSec > baseline.phraseDurationSec + 2;

  return (
    <View style={[a.wrap, !isLast && a.divider]}>
      {/* Warning banner */}
      <View style={a.banner}>
        <Ionicons name="warning-outline" size={13} color={colors.ui.warning} />
        <Text style={a.bannerText}>SEP VERIFICATION FAILED</Text>
        <Text style={a.bannerTime}>{fmtDate(alert.createdAt)}</Text>
      </View>

      {/* Person row */}
      <View style={a.personRow}>
        <Avatar name={alert.user.name} size={38} />
        <View style={a.personInfo}>
          <Text style={a.name}>{alert.user.name}</Text>
          <DetailLine icon="calendar-outline" text={alert.event.name} />
        </View>
      </View>

      {/* Metrics comparison */}
      {baseline && (
        <View style={a.metrics}>
          <MetricRow
            label="Reaction"
            baseline={`${baseline.reactionAvgMs}ms`}
            attempt={`${attempt.reactionAvgMs}ms`}
            failed={rxFail}
          />
          <View style={a.metricDivider} />
          <MetricRow
            label="Phrase"
            baseline={`${baseline.phraseDurationSec.toFixed(1)}s`}
            attempt={`${attempt.phraseDurationSec.toFixed(1)}s`}
            failed={phFail}
          />
        </View>
      )}

      {/* Actions */}
      <View style={a.actions}>
        <Button variant="secondary" size="sm" label="Keep Revoked" onPress={onKeepRevoked} loading={processing} disabled={processing} style={a.btn} />
        <Button size="sm" label="Reinstate DD" onPress={onReinstate} loading={processing} disabled={processing} style={a.btn} />
      </View>
    </View>
  );
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function DetailLine({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={dl.row}>
      <Ionicons name={icon} size={12} color={colors.text.tertiary} />
      <Text style={dl.text} numberOfLines={1}>{text}</Text>
    </View>
  );
}

const dl = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { ...typography.caption, color: colors.text.secondary, flex: 1 },
});

function MetricRow({ label, baseline, attempt, failed }: {
  label: string; baseline: string; attempt: string; failed?: boolean;
}) {
  return (
    <View style={m.row}>
      <Text style={m.label}>{label}</Text>
      <View style={m.values}>
        <Text style={m.base}>{baseline}</Text>
        <Ionicons name="arrow-forward" size={10} color={colors.border.default} />
        <Text style={[m.attempt, failed && m.fail]}>{attempt}</Text>
        {failed && <Ionicons name="close-circle" size={12} color={colors.ui.error} />}
      </View>
    </View>
  );
}

const m = StyleSheet.create({
  row:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label:   { ...typography.caption, color: colors.text.secondary },
  values:  { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  base:    { ...typography.caption, color: colors.ui.success },
  attempt: { ...typography.caption, color: colors.text.secondary, fontWeight: '600' },
  fail:    { color: colors.ui.error },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root:       { flex: 1, backgroundColor: colors.bg.canvas },
  content:    { paddingTop: spacing.base },
  logBtnWrap: { paddingHorizontal: spacing.base, marginBottom: spacing.base },
  block: {
    backgroundColor: colors.bg.surface,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.subtle,
  },
});

// DD request row styles
const r = StyleSheet.create({
  wrap:      { paddingHorizontal: spacing.base, paddingVertical: spacing.base, gap: spacing.md },
  divider:   { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  personInfo:{ flex: 1 },
  name:      { ...typography.bodyBold, color: colors.text.primary },
  meta:      { ...typography.caption, color: colors.text.tertiary, marginTop: 1 },
  details:   { gap: spacing.xs },
  actions:   { flexDirection: 'row', gap: spacing.sm },
  btn:       { flex: 1 },
});

// SEP alert row styles
const a = StyleSheet.create({
  wrap:       { paddingVertical: spacing.base, gap: spacing.md, borderLeftWidth: 3, borderLeftColor: colors.ui.warning },
  divider:    { borderBottomWidth: 1, borderBottomColor: colors.border.subtle },
  banner:     { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.base },
  bannerText: { ...typography.label, color: colors.ui.warning, flex: 1 },
  bannerTime: { ...typography.caption, color: colors.text.tertiary },
  personRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.base },
  personInfo: { flex: 1, gap: spacing.xs },
  name:       { ...typography.bodyBold, color: colors.text.primary },
  metrics: {
    marginHorizontal: spacing.base,
    backgroundColor: colors.bg.muted,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  metricDivider: { height: 1, backgroundColor: colors.border.subtle },
  actions:    { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.base },
  btn:        { flex: 1 },
});
